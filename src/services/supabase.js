const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY

function isConfigured() {
  return SUPABASE_URL && SUPABASE_URL !== 'your_supabase_url'
}

export async function fetchEchoById(id) {
  if (!isConfigured()) return null
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/echoes?id=eq.${id}&select=*&limit=1`,
    {
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      },
    },
  )
  if (!res.ok) return null
  const data = await res.json()
  return data[0] ?? null
}

export async function fetchEchoes() {
  if (!isConfigured()) return []
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/echoes?select=*&order=created_at.desc`,
    {
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      },
    },
  )
  if (!res.ok) return []
  return res.json()
}

export async function uploadAudio(audioBlob, tempId) {
  if (!isConfigured()) {
    return { url: null }
  }
  const filename = `recordings/${tempId}.webm`
  const res = await fetch(
    `${SUPABASE_URL}/storage/v1/object/echoes-audio/${filename}`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        'Content-Type': audioBlob.type || 'audio/webm',
      },
      body: audioBlob,
    },
  )
  if (!res.ok) return { url: null }
  return { url: `${SUPABASE_URL}/storage/v1/object/public/echoes-audio/${filename}` }
}

const CONTENT_TYPE_MAP = {
  'Story':                'story',
  'Song':                 'song',
  'Poem':                 'poem',
  'Proverb':              'proverb',
  'Traditional Knowledge':'knowledge',
  'Ceremony':             'ceremony',
  'Prayer':               'prayer',
  'Other':                'other',
}

function toDbSchema(data) {
  return {
    language:          data.language          || null,
    language_code:     data.iso               || null,
    community:         data.community         || null,
    content_type:      CONTENT_TYPE_MAP[data.contentType ?? data.content_type] ?? null,
    title:             data.title             || null,
    lat:               data.lat,
    lon:               data.lon,
    location_label:    data.location_label    || null,
    audio_url:         data.audio_url         || null,
    description:       data.description       || null,
    phonetic:          data.phonetics         || data.phonetic_approximation || null,
    transcription:     data.transcription     || null,
    translation:       data.translation       || null,
    translation_lang:  data.translationLanguage ?? data.translation_language ?? null,
    translation_note:  data.translationType   ?? data.translation_type ?? null,
    ai_tags:           data.cultural_tags?.length ? data.cultural_tags : null,
    ai_cultural_note:  data.enrichment_notes  || null,
    ai_phonetic:       data.phonetic_approximation || null,
    moderation_passed: true,
  }
}

export async function saveEcho(echoData) {
  if (!isConfigured()) {
    return { id: `echo-${Date.now()}`, ...echoData }
  }
  const payload = toDbSchema(echoData)
  const res = await fetch(`${SUPABASE_URL}/rest/v1/echoes`, {
    method: 'POST',
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
    },
    body: JSON.stringify(payload),
  })
  if (!res.ok) {
    const errBody = await res.json().catch(() => ({}))
    console.error('[Supabase] saveEcho 400 — payload sent:', payload)
    console.error('[Supabase] error response:', errBody)
    throw new Error(`Failed to save echo: ${errBody.message || errBody.error || res.status}`)
  }
  const data = await res.json()
  return data[0]
}
