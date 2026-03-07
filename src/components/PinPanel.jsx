import { useState, useRef, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { moderateContent, enrichContent } from '../services/claude.js'
import { transcribeAudio } from '../services/transcription.js'
import { uploadAudio, saveEcho } from '../services/supabase.js'
import './PinPanel.css'

const NUM_BARS = 36
const CONTENT_TYPES = ['Story', 'Song', 'Poem', 'Proverb', 'Traditional Knowledge', 'Ceremony', 'Prayer', 'Other']
const TRANSLATION_TYPES = ['Community-provided', 'Approximate', 'Literal', 'Unknown']

const CHECK_LABELS = [
  'No harmful content',
  'No hate speech',
  'Language matches location',
  'Appropriate for heritage archive',
]
const CHECK_KEYS = ['noHarmfulContent', 'noHateSpeech', 'linguisticCoherence', 'culturallyAppropriate']

const ANALYSIS_STEP_LABELS = {
  transcribing: 'Transcribing your recording with Whisper AI...',
  warming:      'Model is warming up, please wait',
  moderating:   'Analysing content and location with Claude AI...',
}

const EMPTY_FORM = {
  language: '', iso: '', community: '', contentType: '',
  title: '', description: '', transcription: '', phonetics: '',
  translation: '', translationLanguage: '', translationType: 'Unknown',
}

export default function PinPanel({ pin, onClose, onEchoSubmitted }) {
  // Core flow
  const [step, setStep]         = useState('record')
  // Recording
  const [recording, setRecording]     = useState(false)
  const [audioBlob, setAudioBlob]     = useState(null)
  const [timer, setTimer]             = useState(0)
  const [bars, setBars]               = useState(Array(NUM_BARS).fill(4))
  const [frozenBars, setFrozenBars]   = useState(null)
  // Analysis
  const [analysisStep, setAnalysisStep]           = useState('idle')
  const [transcriptionResult, setTranscriptionResult] = useState(null)
  const [moderationResult, setModerationResult]   = useState(null)
  // Form
  const [linguisticOpen, setLinguisticOpen] = useState(false)
  const [form, setForm]                     = useState(EMPTY_FORM)
  // Submit
  const [savedEcho, setSavedEcho]   = useState(null)
  const [submitError, setSubmitError] = useState(null)

  const audioContextRef  = useRef(null)
  const analyserRef      = useRef(null)
  const mediaRecorderRef = useRef(null)
  const chunksRef        = useRef([])
  const timerIntervalRef = useRef(null)
  const animFrameRef     = useRef(null)
  const streamRef        = useRef(null)
  const barsRef          = useRef(Array(NUM_BARS).fill(4))
  const pinRef           = useRef(pin)

  useEffect(() => { pinRef.current = pin }, [pin])

  // Auto-close after success
  useEffect(() => {
    if (step !== 'success') return
    const t = setTimeout(() => handleClose(), 3500)
    return () => clearTimeout(t)
  }, [step]) // eslint-disable-line react-hooks/exhaustive-deps

  // Reset when a new pin is placed
  useEffect(() => {
    if (!pin) return
    stopRecordingResources()
    setStep('record')
    setRecording(false)
    setAudioBlob(null)
    setTimer(0)
    setBars(Array(NUM_BARS).fill(4))
    setFrozenBars(null)
    setAnalysisStep('idle')
    setTranscriptionResult(null)
    setModerationResult(null)
    setLinguisticOpen(false)
    setForm(EMPTY_FORM)
    setSavedEcho(null)
    setSubmitError(null)
  }, [pin?.lat, pin?.lon]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { return () => stopRecordingResources() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-advance to form when moderation passes and no warnings
  useEffect(() => {
    if (!moderationResult || !moderationResult.safe) return
    if (moderationResult.warnings?.length > 0) return
    const t = setTimeout(() => setStep('form'), 1800)
    return () => clearTimeout(t)
  }, [moderationResult])

  function stopRecordingResources() {
    clearInterval(timerIntervalRef.current)
    cancelAnimationFrame(animFrameRef.current)
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop())
      streamRef.current = null
    }
  }

  function drawWaveform() {
    if (!analyserRef.current) return
    const data = new Uint8Array(analyserRef.current.frequencyBinCount)
    analyserRef.current.getByteFrequencyData(data)
    const step = Math.floor(data.length / NUM_BARS)
    const newBars = Array.from({ length: NUM_BARS }, (_, i) => {
      const val = data[i * step] / 255
      return Math.max(4, Math.round(val * 60))
    })
    barsRef.current = newBars
    setBars(newBars)
    animFrameRef.current = requestAnimationFrame(drawWaveform)
  }

  async function toggleRecording() {
    if (!recording) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
        streamRef.current = stream

        const audioContext = new AudioContext()
        audioContextRef.current = audioContext
        const source = audioContext.createMediaStreamSource(stream)
        const analyser = audioContext.createAnalyser()
        analyser.fftSize = 256
        source.connect(analyser)
        analyserRef.current = analyser

        chunksRef.current = []
        const mediaRecorder = new MediaRecorder(stream)
        mediaRecorderRef.current = mediaRecorder

        mediaRecorder.ondataavailable = e => chunksRef.current.push(e.data)
        mediaRecorder.onstop = () => {
          cancelAnimationFrame(animFrameRef.current)
          analyserRef.current = null
          audioContextRef.current?.close()
          audioContextRef.current = null

          const blob = new Blob(chunksRef.current, { type: 'audio/webm' })
          setAudioBlob(blob)
          setFrozenBars([...barsRef.current])
          runAnalysis(blob)
        }

        mediaRecorder.start()
        setRecording(true)
        setTimer(0)
        timerIntervalRef.current = setInterval(() => setTimer(t => t + 1), 1000)
        animFrameRef.current = requestAnimationFrame(drawWaveform)
      } catch (err) {
        console.error('Microphone error:', err)
      }
    } else {
      clearInterval(timerIntervalRef.current)
      cancelAnimationFrame(animFrameRef.current)
      if (mediaRecorderRef.current) mediaRecorderRef.current.stop()
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop())
        streamRef.current = null
      }
      setRecording(false)
    }
  }

  async function runAnalysis(blob) {
    const currentPin = pinRef.current
    setStep('analysing')
    setAnalysisStep('uploading')
    setTranscriptionResult(null)
    setModerationResult(null)

    console.group('[Echoes] Analysis pipeline started')
    console.log('Pin:', currentPin)

    // Step 1 + 2: transcribe via AssemblyAI
    const txResult = await transcribeAudio(blob, step => {
      console.log('[Echoes] Transcription step:', step)
      setAnalysisStep(step === 'done' ? 'moderating' : step)
    })
    setTranscriptionResult(txResult)
    console.log('[Echoes] Transcription result:', txResult)

    // Step 3: moderate with Claude
    setAnalysisStep('moderating')
    const modResult = await moderateContent(
      { lat: currentPin.lat, lon: currentPin.lon, location_label: currentPin.location_label },
      txResult,
    )
    console.log('[Echoes] Moderation result:', modResult)
    setAnalysisStep('done')
    setModerationResult(modResult)
    console.groupEnd()

    // If passes, pre-fill form
    if (modResult.safe) {
      setForm(f => ({
        ...f,
        language:      modResult.suggested_language  || '',
        iso:           modResult.suggested_iso        || '',
        community:     modResult.suggested_community  || '',
        transcription: txResult.text                  || '',
        translation:   modResult.suggested_translation|| '',
      }))
    }
  }

  async function handleSubmit() {
    setStep('submitting')
    setSubmitError(null)
    const currentPin = pinRef.current
    try {
      const tempId = `echo-${Date.now()}`
      const [enrichment, audioUpload] = await Promise.all([
        enrichContent(
          { ...form, lat: currentPin.lat, lon: currentPin.lon, location_label: currentPin.location_label },
          transcriptionResult,
        ),
        uploadAudio(audioBlob, tempId),
      ])
      const echoData = {
        ...form,
        lat:            currentPin.lat,
        lon:            currentPin.lon,
        location_label: currentPin.location_label,
        audio_url:      audioUpload.url,
        duration_sec:   transcriptionResult?.duration ? Math.round(transcriptionResult.duration / 1000) : null,
        ...enrichment,
        created_at:     new Date().toISOString(),
      }
      const saved = await saveEcho(echoData)
      setSavedEcho(saved)
      setStep('success')
      onEchoSubmitted?.(saved)
    } catch {
      setSubmitError('Failed to archive. Please try again.')
      setStep('form')
    }
  }

  function handleReRecord() {
    setAnalysisStep('idle')
    setTranscriptionResult(null)
    setModerationResult(null)
    setAudioBlob(null)
    setFrozenBars(null)
    setBars(Array(NUM_BARS).fill(4))
    setTimer(0)
    setStep('record')
  }

  function handleClose() {
    stopRecordingResources()
    onClose?.()
  }

  function formatTime(s) {
    return `${Math.floor(s / 60).toString().padStart(2, '0')}:${(s % 60).toString().padStart(2, '0')}`
  }

  function setField(field, value) {
    setForm(f => ({ ...f, [field]: value }))
  }

  if (!pin) return null

  const displayBars = frozenBars || bars
  const formValid   = form.language && form.community && form.contentType

  return (
    <div className={`pin-panel${pin ? ' pin-panel--open' : ''}`}>

      {/* Header */}
      <div className="pp-header">
        <div className="pp-header__left">
          <span className="pp-header__icon">📍</span>
          <div>
            <div className="pp-header__coords mono">
              {pin.lat.toFixed(4)}, {pin.lon.toFixed(4)}
            </div>
            {pin.location_label && (
              <div className="pp-header__location mono">{pin.location_label}</div>
            )}
          </div>
        </div>
        <button className="pp-header__close" onClick={handleClose} aria-label="Close panel">✕</button>
      </div>

      <div className="pp-body">

        {/* ── STEP: record ── */}
        {step === 'record' && (
          <div className="pp-step pp-step--record">
            <h2 className="pp-title">Record your voice</h2>
            <p className="pp-subtitle">
              We'll transcribe and analyse your recording, then pre-fill what we can.
            </p>

            <div className="pp-waveform">
              {displayBars.map((h, i) => (
                <div key={i} className="pp-bar" style={{ height: `${h}px` }} />
              ))}
            </div>

            <div className={`pp-timer mono${recording ? ' pp-timer--active' : ''}`}>
              {formatTime(timer)}
            </div>

            <button
              className={`pp-record-btn${recording ? ' pp-record-btn--active' : ''}`}
              onClick={toggleRecording}
              aria-label={recording ? 'Stop recording' : 'Start recording'}
            >
              {recording ? (
                <svg width="36" height="36" viewBox="0 0 24 24" fill="currentColor">
                  <rect x="6" y="6" width="12" height="12" rx="2" />
                </svg>
              ) : (
                <svg width="36" height="36" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 1a4 4 0 0 1 4 4v6a4 4 0 0 1-8 0V5a4 4 0 0 1 4-4zm6 9a1 1 0 0 1 2 0 8 8 0 0 1-7 7.938V20h2a1 1 0 0 1 0 2H9a1 1 0 0 1 0-2h2v-2.062A8 8 0 0 1 4 10a1 1 0 0 1 2 0 6 6 0 0 0 12 0z" />
                </svg>
              )}
            </button>

            <div className={`pp-status${recording ? ' pp-status--recording' : audioBlob ? ' pp-status--saved' : ''}`}>
              {recording ? '● Recording...' : audioBlob ? '✓ Recording saved' : 'Click to record'}
            </div>
          </div>
        )}

        {/* ── STEP: analysing ── */}
        {step === 'analysing' && (
          <div className="pp-step pp-step--analysing">
            <div className="pp-claude-badge">
              <span className="pp-claude-dot" />
              Whisper + Claude AI
            </div>

            {/* Loading indicator */}
            {analysisStep !== 'done' && analysisStep !== 'idle' && (
              <div className="pp-analysis-loading">
                <div className="pp-analysis-spinner" />
                <div>
                  <p className="pp-analysing-text">
                    {ANALYSIS_STEP_LABELS[analysisStep]}
                    {analysisStep === 'warming' && <span className="pp-analysis-dots" />}
                  </p>
                  {analysisStep === 'transcribing' && (
                    <p className="pp-analysis-hint">This may take 20–30 seconds on first use.</p>
                  )}
                </div>
              </div>
            )}

            {/* Transcription preview */}
            {transcriptionResult?.text && (
              <div className="pp-transcript-preview">
                <span className="pp-transcript-preview__label mono">Transcript</span>
                <p className="pp-transcript-preview__text">"{transcriptionResult.text}"</p>
                {transcriptionResult.detected_language && (
                  <span className="pp-transcript-preview__lang mono">
                    detected: {transcriptionResult.detected_language}
                    {transcriptionResult.confidence != null && ` · ${Math.round(transcriptionResult.confidence * 100)}%`}
                  </span>
                )}
              </div>
            )}

            {/* Check results */}
            {moderationResult && (
              <div className="pp-checks">
                {CHECK_LABELS.map((label, i) => {
                  const passed = moderationResult.checks[CHECK_KEYS[i]]
                  return (
                    <div key={i} className={`pp-check pp-check--${passed ? 'pass' : 'fail'}`}>
                      <span className="pp-check__icon">{passed ? '✓' : '✗'}</span>
                      <span className="pp-check__label">{label}</span>
                    </div>
                  )
                })}
              </div>
            )}

            {/* Fail */}
            {moderationResult && !moderationResult.safe && (
              <div className="pp-error-box">
                <p className="pp-error-msg">{moderationResult.message}</p>
                <button className="pp-btn pp-btn--secondary" onClick={handleReRecord}>
                  Re-record
                </button>
              </div>
            )}

            {/* Warnings */}
            {moderationResult?.safe && moderationResult.warnings?.length > 0 && (
              <div className="pp-warning-box">
                <p className="pp-warning-box__title">⚠ Please review</p>
                <ul className="pp-warning-box__list">
                  {moderationResult.warnings.map((w, i) => <li key={i}>{w}</li>)}
                </ul>
                <p className="pp-warning-box__note">You can still submit. These are informational only.</p>
                <button className="pp-btn pp-btn--primary" onClick={() => setStep('form')}>
                  Continue anyway
                </button>
              </div>
            )}

            {/* Language note (pass or warning) */}
            {moderationResult?.safe && moderationResult.language_note && (
              <div className="pp-language-note">
                <span className="pp-language-note__icon">🌐</span>
                <p className="pp-language-note__text">{moderationResult.language_note}</p>
              </div>
            )}
          </div>
        )}

        {/* ── STEP: form / submitting ── */}
        {(step === 'form' || step === 'submitting') && (
          <div className="pp-step pp-step--form">
            <div className="pp-form-header">
              <div className="pp-claude-badge pp-claude-badge--amber">Claude AI</div>
              <p className="pp-form-title">Claude AI has pre-filled what it can</p>
              <p className="pp-form-sub">Review and complete the form. Your words always take priority.</p>
            </div>

            {/* Section A — Language info */}
            <div className="pp-section">
              <div className="pp-field">
                <label className="pp-label">
                  Language name <span className="pp-req">*</span>
                  {moderationResult?.suggested_language && <span className="pp-ai-pill">AI suggestion</span>}
                </label>
                <input
                  className="pp-input"
                  value={form.language}
                  onChange={e => setField('language', e.target.value)}
                  placeholder="e.g. Breton (Kerneveg), Sicilian, Piraha"
                />
                <p className="pp-helper">Be specific — name the dialect, not just the national language</p>
              </div>

              <div className="pp-field">
                <label className="pp-label">
                  ISO 639-3 code
                  {moderationResult?.suggested_iso && <span className="pp-ai-pill">AI suggestion</span>}
                </label>
                <input
                  className="pp-input"
                  value={form.iso}
                  onChange={e => setField('iso', e.target.value)}
                  placeholder="e.g. bre, scn, myp (optional)"
                />
              </div>

              <div className="pp-field">
                <label className="pp-label">
                  Community and region <span className="pp-req">*</span>
                  {moderationResult?.suggested_community && <span className="pp-ai-pill">AI suggestion</span>}
                </label>
                <input
                  className="pp-input"
                  value={form.community}
                  onChange={e => setField('community', e.target.value)}
                  placeholder="e.g. Pays de Cornouaille, Bretagne, France"
                />
              </div>

              <div className="pp-field">
                <label className="pp-label">Content type <span className="pp-req">*</span></label>
                <select
                  className="pp-select"
                  value={form.contentType}
                  onChange={e => setField('contentType', e.target.value)}
                >
                  <option value="">Select a type...</option>
                  {CONTENT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>

              <div className="pp-field">
                <label className="pp-label">Title</label>
                <input
                  className="pp-input"
                  value={form.title}
                  onChange={e => setField('title', e.target.value)}
                  placeholder="Optional title in the original language"
                />
              </div>

              <div className="pp-field">
                <label className="pp-label">Description and context</label>
                <textarea
                  className="pp-textarea"
                  value={form.description}
                  onChange={e => setField('description', e.target.value)}
                  placeholder="When is this recited? Who taught you? What occasion?"
                  rows={3}
                />
              </div>

              {moderationResult?.language_note && (
                <div className="pp-location-note">
                  <span className="pp-location-note__icon">🌐</span>
                  <div>
                    <p className="pp-location-note__text">{moderationResult.language_note}</p>
                    <span className="pp-location-note__label">Geographic context from Claude AI</span>
                  </div>
                </div>
              )}
            </div>

            {/* Section B — Transcription + translation, always visible */}
            <div className="pp-section">
              <div className="pp-field">
                <label className="pp-label">
                  Transcription
                  {transcriptionResult?.text && <span className="pp-ai-pill">AI suggestion</span>}
                </label>
                <textarea
                  className="pp-textarea"
                  value={form.transcription}
                  onChange={e => setField('transcription', e.target.value)}
                  placeholder="Written form in the original language"
                  rows={2}
                />
              </div>

              <div className="pp-field">
                <label className="pp-label">
                  Translation
                  {moderationResult?.suggested_translation && <span className="pp-ai-pill">AI suggestion</span>}
                </label>
                <textarea
                  className="pp-textarea"
                  value={form.translation}
                  onChange={e => setField('translation', e.target.value)}
                  placeholder="Translation in any language if available"
                  rows={2}
                />
              </div>
            </div>

            {/* Section C — Extra details, collapsible */}
            <div className="pp-section">
              <button className="pp-toggle" onClick={() => setLinguisticOpen(o => !o)}>
                {linguisticOpen ? 'Hide additional details −' : 'Add phonetics or translation details +'}
              </button>

              {linguisticOpen && (
                <div className="pp-linguistic">
                  <div className="pp-field">
                    <label className="pp-label">Phonetics</label>
                    <textarea
                      className="pp-textarea"
                      value={form.phonetics}
                      onChange={e => setField('phonetics', e.target.value)}
                      placeholder="How it sounds — IPA or any approximation"
                      rows={2}
                    />
                    <p className="pp-helper">Claude AI will attempt to approximate this if left empty</p>
                  </div>
                  <div className="pp-field">
                    <label className="pp-label">Translation language</label>
                    <input
                      className="pp-input"
                      value={form.translationLanguage}
                      onChange={e => setField('translationLanguage', e.target.value)}
                      placeholder="e.g. French, English, Spanish"
                    />
                  </div>
                  <div className="pp-field">
                    <label className="pp-label">Translation type</label>
                    <select
                      className="pp-select"
                      value={form.translationType}
                      onChange={e => setField('translationType', e.target.value)}
                    >
                      {TRANSLATION_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>
                </div>
              )}
            </div>

            {submitError && <p className="pp-error-msg pp-error-msg--inline">{submitError}</p>}

            <button
              className="pp-submit"
              disabled={!formValid || step === 'submitting'}
              onClick={handleSubmit}
            >
              {step === 'submitting' ? 'Archiving...' : 'Archive this Echo'}
            </button>
          </div>
        )}

        {/* ── STEP: success ── */}
        {step === 'success' && savedEcho && (
          <div className="pp-step pp-step--success">
            <div className="pp-success__globe">🌍</div>
            <h2 className="pp-success__title">
              Your voice is now part of humanity's archive.
            </h2>
            <p className="pp-success__meta">
              {form.language}{pin.location_label ? ` · ${pin.location_label}` : ''}
            </p>
            <div className="pp-success__actions">
              <Link to={`/echo/${savedEcho.id}`} className="pp-btn pp-btn--primary">
                View your Echo
              </Link>
              <button className="pp-btn pp-btn--secondary" onClick={handleClose}>
                Record another
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  )
}
