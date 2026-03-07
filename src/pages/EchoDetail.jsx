import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { fetchEchoById } from '../services/supabase.js'
import './EchoDetail.css'

function formatDate(iso) {
  if (!iso) return ''
  return new Date(iso).toLocaleDateString('en-GB', {
    day: 'numeric', month: 'long', year: 'numeric',
  })
}

function Field({ label, value }) {
  if (!value) return null
  return (
    <div className="ed-field">
      <span className="ed-field__label mono">{label}</span>
      <span className="ed-field__value">{value}</span>
    </div>
  )
}

export default function EchoDetail() {
  const { id } = useParams()
  const [echo, setEcho] = useState(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  useEffect(() => {
    fetchEchoById(id)
      .then(data => {
        if (!data) setNotFound(true)
        else setEcho(data)
      })
      .finally(() => setLoading(false))
  }, [id])

  return (
    <main className="echo-detail">
      <div className="echo-detail-inner">
        <Link to="/archive" className="echo-back">
          ← Back to Archive
        </Link>

        {loading && (
          <div className="ed-loading">
            <span className="ed-loading__dot" />
            <span className="ed-loading__dot" />
            <span className="ed-loading__dot" />
          </div>
        )}

        {notFound && (
          <p className="ed-not-found">This echo could not be found.</p>
        )}

        {echo && (
          <div className="ed-content">
            {/* Header */}
            <div className="ed-header">
              <div className="ed-header__meta">
                {echo.content_type && (
                  <span className="ed-badge mono">{echo.content_type}</span>
                )}
                <span className="ed-date mono">{formatDate(echo.created_at)}</span>
              </div>
              <h1 className="ed-title">
                {echo.title || echo.language}
              </h1>
              {echo.title && (
                <p className="ed-language">{echo.language}</p>
              )}
              {echo.location_label && (
                <p className="ed-location mono">📍 {echo.location_label}</p>
              )}
            </div>

            {/* Audio player */}
            {echo.audio_url && (
              <div className="ed-audio">
                <p className="ed-audio__label mono">Recording</p>
                <audio controls src={echo.audio_url} className="ed-audio__player" />
              </div>
            )}

            {/* About */}
            <div className="ed-section">
              <h2 className="ed-section__title">About this echo</h2>
              <div className="ed-fields">
                <Field label="Language"      value={echo.language} />
                <Field label="ISO 639-3"     value={echo.language_code} />
                <Field label="Community"     value={echo.community} />
                <Field label="Coordinates"   value={echo.lat != null ? `${Number(echo.lat).toFixed(4)}, ${Number(echo.lon).toFixed(4)}` : null} />
              </div>
              {echo.description && (
                <p className="ed-description">{echo.description}</p>
              )}
            </div>

            {/* Linguistic data */}
            {(echo.transcription || echo.phonetic || echo.translation) && (
              <div className="ed-section">
                <h2 className="ed-section__title">Linguistic data</h2>
                <div className="ed-fields">
                  <Field label="Transcription"      value={echo.transcription} />
                  <Field label="Phonetics"          value={echo.phonetic} />
                  <Field label="Translation"        value={echo.translation} />
                  <Field label="Translation lang"   value={echo.translation_lang} />
                  <Field label="Translation type"   value={echo.translation_note} />
                </div>
              </div>
            )}

            {/* AI enrichment */}
            {(echo.ai_cultural_note || echo.ai_phonetic || echo.ai_tags?.length) && (
              <div className="ed-section ed-section--ai">
                <div className="ed-section__heading">
                  <h2 className="ed-section__title">AI enrichment</h2>
                  <span className="ed-ai-badge mono">Claude AI</span>
                </div>
                <div className="ed-fields">
                  <Field label="Cultural note"   value={echo.ai_cultural_note} />
                  <Field label="Phonetic (AI)"   value={echo.ai_phonetic} />
                </div>
                {echo.ai_tags?.length > 0 && (
                  <div className="ed-tags">
                    {echo.ai_tags.map(tag => (
                      <span key={tag} className="ed-tag mono">{tag}</span>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </main>
  )
}
