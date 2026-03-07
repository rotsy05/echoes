const API_KEY = import.meta.env.VITE_ANTHROPIC_API_KEY
const API_URL = 'https://api.anthropic.com/v1/messages'

async function callClaude(systemPrompt, userMessage) {
  console.log('[Claude] POST', API_URL, '| user message:', userMessage)
  const t0 = performance.now()
  const res = await fetch(API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': API_KEY,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      system: systemPrompt,
      messages: [{ role: 'user', content: userMessage }],
    }),
  })
  if (!res.ok) {
    console.error(`[Claude] HTTP ${res.status}`, await res.text().catch(() => ''))
    throw new Error(`Claude API error: ${res.status}`)
  }
  const data = await res.json()
  const raw = data.content[0].text
  console.log(`[Claude] Response in ${(performance.now() - t0).toFixed(0)}ms:`, raw)
  const stripped = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim()
  return stripped
}

export async function moderateContent(formData, transcriptionResult) {
  const system = `You are a content moderator for Echoes, a cultural heritage platform dedicated to preserving endangered and minority languages from isolated communities worldwide. Your role is to verify that each submission meets these criteria:
1. Safe — no harmful, hateful, violent, or discriminatory content
2. No hate speech — no content targeting any group based on ethnicity, religion, gender, or any other characteristic
3. Linguistically coherent — the detected language matches the pin location
4. Appropriate for a heritage archive — genuine cultural content

LINGUISTIC COHERENCE RULES — apply these carefully:

ALWAYS PASS:
- Any regional, minority, indigenous, or endangered language native to the area
- Creole, pidgin, or mixed languages native to the region
- Any indigenous language anywhere in the world
- If BOTH transcription_text AND detected_language_code are null — no audio content to evaluate, give benefit of the doubt

IMPORTANT — if transcription_text is provided but detected_language_code is null:
- Do NOT automatically pass. Instead, identify the language yourself from the transcription text.
- Even a few words are enough to identify major languages (French, English, Spanish, etc.).
- Apply the same PASS / WARNING / FAIL rules based on your identification.

PASS WITH WARNING (submit allowed, but flag it):
- A major national or colonial language detected at a location where a minority language would be expected. Examples:
  French detected in Brittany (Breton is the heritage language)
  French detected in Madagascar (Malagasy is the heritage language)
  French detected in Algeria (Tamazight or Darija would be heritage)
  Spanish detected in Peru or Bolivia (Quechua or Aymara would be heritage)
  English detected in Ireland (Irish is the heritage language)
  Portuguese detected in the Amazon (indigenous languages expected)
  Standard Arabic detected in Morocco (Darija or Tamazight expected)

FAIL:
- A language with absolutely no plausible heritage connection to the location. Examples:
  English in rural Argentina with no indigenous connection
  Mandarin in rural Brazil
  German in rural Senegal
- Genuinely harmful, hateful, or violent content
- Content that appears to be spam or completely unrelated to cultural heritage

Language code reference (ISO 639-1): fr=French, en=English, es=Spanish, pt=Portuguese, ar=Arabic, zh=Chinese, de=German, br=Breton, cy=Welsh, ga=Irish, eu=Basque, ca=Catalan, oc=Occitan, co=Corsican, mg=Malagasy, qu=Quechua, gn=Guarani, sw=Swahili

Return ONLY valid JSON, no markdown, no explanation:
{
  "safe": boolean,
  "checks": {
    "noHarmfulContent": boolean,
    "noHateSpeech": boolean,
    "linguisticCoherence": boolean,
    "culturallyAppropriate": boolean
  },
  "warnings": string[],
  "message": string,
  "language_note": string,
  "suggested_language": string or null,
  "suggested_community": string or null,
  "suggested_iso": string or null,
  "suggested_translation": string or null
}

safe: true only if ALL four checks are true.
warnings: non-blocking observations shown to the user. Can be empty array.
message: one clear sentence explaining the overall result.
language_note: one educational sentence about the detected language and its relationship to the pin location. Be specific and informative.
suggested_language: the most likely endangered/regional language for this location, or the detected language if appropriate. Full name.
suggested_community: community name and region description.
suggested_iso: ISO 639-3 code (3-letter) if confident, else null.
suggested_translation: if transcription text exists and the language is widely known, provide English translation. Else null.`

  try {
    const text = await callClaude(system, JSON.stringify({
      transcription_text:     transcriptionResult?.text              ?? null,
      detected_language_code: transcriptionResult?.detected_language ?? null,
      pin_location:           formData.location_label,
      pin_lat:                formData.lat,
      pin_lon:                formData.lon,
      stated_language:        formData.language,
      content_type:           formData.contentType,
      community:              formData.community,
      description:            formData.description,
    }))
    return JSON.parse(text)
  } catch {
    return {
      safe: false,
      checks: { noHarmfulContent: false, noHateSpeech: false, linguisticCoherence: false, culturallyAppropriate: false },
      warnings: [],
      message: 'Moderation service unavailable. Please try again.',
      language_note: '',
      suggested_language: null, suggested_community: null, suggested_iso: null, suggested_translation: null,
    }
  }
}

export async function enrichContent(formData, transcriptionResult) {
  const system = `You are a linguistic data enrichment AI for Echoes. Given a form submission about a voice recording of a regional or endangered language, enrich the data. If transcription_text is provided, use it to generate a more accurate ai_phonetic approximation and more relevant ai_tags. Return ONLY valid JSON, no markdown: { "phonetic_approximation": string or null, "cultural_tags": string[], "preservation_priority": "critical" | "endangered" | "vulnerable" | "safe", "enrichment_notes": string or null }`
  try {
    const text = await callClaude(system, JSON.stringify({
      ...formData,
      transcription_text: transcriptionResult?.text ?? null,
    }))
    return JSON.parse(text)
  } catch {
    return { phonetic_approximation: null, cultural_tags: [], preservation_priority: 'endangered', enrichment_notes: null }
  }
}
