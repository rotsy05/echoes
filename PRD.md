# Echoes — Product Requirements Document
> Version 2.0 · SHP 2026 Hackathon · Theme: ORBIT

---

## 1. Vision

**Echoes** is a cultural heritage platform that helps isolated communities
archive their language, stories, and oral knowledge — forever.

> *"We don't translate cultures. We preserve voices."*

---

## 2. Problem Statement

- 3,000+ languages are at risk of disappearing by 2100
- Most endangered languages belong to isolated communities with no internet infrastructure
- When the last speaker dies, the language and all its embedded knowledge is lost forever
- Existing archiving tools assume stable connectivity and translation capabilities
- No platform lets communities precisely locate their dialect on a globe — Breton is not
  French, Sicilian is not Italian, Kerneveg is not standard Breton

---

## 3. Solution

Echoes provides a web platform where community members record audio (stories, songs,
poems, proverbs, ceremonies) and archive it permanently in a public global database.

Users place a precise pin on a 3D interactive globe to mark the exact geographic origin
of their language or dialect. Claude AI moderates content safety and enriches each
recording with cultural tags and phonetic approximations when none are provided.

---

## 4. Hackathon Alignment

| Requirement | How Echoes responds |
|-------------|---------------------|
| Systems connecting humanity | Global archive connecting isolated communities to the world |
| Beyond Earth perspective | 3D globe as the primary interface — humanity seen from space |
| AI Tools | Claude API for moderation and linguistic enrichment |
| Tech for good | Preserving languages at risk of extinction |

---

## 5. Target Users

| User | Need |
|------|------|
| Community elder / member | Record and preserve their voice and knowledge |
| Researcher / linguist | Access rare language recordings with precise location data |
| Educator | Use archived content for cultural education |
| NGO / humanitarian org | Identify and support at-risk linguistic communities |

---

## 6. Core Features

### 6.1 Interactive 3D Globe (MVP)
- Full-screen Globe.gl with real Earth texture (continents, countries visible)
- Pulsing teal markers on exact recording locations
- Background star field, atmosphere glow, auto-rotation when idle
- Click-to-pin: user clicks anywhere on the globe to place their recording location
  - Cursor changes to crosshair in pin mode
  - Dropped pin shows an amber marker with coordinates
  - Reverse-geocoded label when possible (e.g. "Quimper, Finistere, France")
  - Pin can be repositioned before submitting
  - Required first step before recording

### 6.2 Recording Interface — 3 Steps (MVP)
- Step 1: Place Pin on Globe (required before continuing)
- Step 2: Fill Linguistic Fiche
- Step 3: Record Audio + AI Review

### 6.3 Linguistic Fiche (MVP — core differentiator)

| Field | Required | Notes |
|-------|----------|-------|
| Language name | Yes | "Breton (Kerneveg)" not just "French" |
| ISO 639-3 code | No | Optional, helps researchers |
| Community / Region | Yes | "Pays de Cornouaille, Bretagne, France" |
| Content type | Yes | Story / Song / Poem / Proverb / Knowledge / Ceremony / Prayer / Other |
| Title | No | Optional title in original language |
| Description / Context | No | When is this recited? Who taught you? |
| Transcription | No | Written form in original language |
| Phonetics | No | IPA or any approximation — Claude AI will assist |
| Translation | No | Translation text if available |
| Translation language | No | Language of the translation |
| Translation note | No | Community-provided / Approximate / Literal |

### 6.4 Claude AI — Two Calls (MVP)

Call 1 — Safety Moderation (blocks submission if failed):
- Triggered automatically after recording stops
- Sends form metadata to Claude API (never the audio)
- Returns 4 checks: harmful content / personal data / cultural sensitivity / appropriate
- Animated status dots: pending to pass or fail with 800ms stagger
- Submit button unlocks only when all checks pass

Call 2 — Linguistic Enrichment (async, after submission):
- Generates cultural context note and thematic tags
- If no phonetics provided: generates approximate phonetic (marked as AI-generated)
- If no translation: notes original language preserved
- Never overwrites contributor-provided data

### 6.5 Voice Fiche — Detail Page (MVP)
- Custom audio player with waveform visualization
- Complete linguistic fiche display (each section only shows if data exists)
- Transcription in original script with teal left border
- Phonetics in DM Mono, with amber AI badge if AI-generated
- Translation with language label and honesty disclaimer
- AI cultural note with Claude badge and disclaimer
- Tags as teal pills
- Exact pin coordinates and location label
- Share button (copy URL to clipboard)

### 6.6 Public Archive (MVP)
- Grid of Voice Cards
- Filter by: All / Story / Song / Poem / Proverb / Knowledge / Ceremony / Prayer
- Search by language name or community
- Each card: language badge, type emoji, title, location, play button
- Translation available badge when translation exists

---

## 7. Technical Architecture

```
BROWSER (React + Vite)
      |
      |-- Globe.jsx ................. Globe.gl, real texture, click-to-pin
      |-- RecordPanel.jsx ........... 3-step recording flow
      |-- VoiceCard.jsx ............. archive grid cards
      |-- VoiceDetail.jsx ........... full linguistic fiche page
      |
      +--- src/services/claude.js ... Claude API calls
      +--- src/services/supabase.js . database + storage
```

---

## 8. Data Model

### echoes table (Supabase)

```sql
CREATE TABLE echoes (
  id                uuid DEFAULT gen_random_uuid() PRIMARY KEY,

  -- Identity
  community         text NOT NULL,
  language          text NOT NULL,
  language_code     text,
  content_type      text CHECK (content_type IN (
                      'story','song','poem','proverb',
                      'knowledge','ceremony','prayer','other')),
  title             text,

  -- Location (from globe click)
  lat               float NOT NULL,
  lon               float NOT NULL,
  location_label    text,

  -- Audio
  audio_url         text,
  duration_sec      integer,

  -- Linguistic data (contributor-provided)
  description       text,
  phonetic          text,
  transcription     text,
  translation       text,
  translation_lang  text,
  translation_note  text,

  -- AI generated
  ai_tags           jsonb,
  ai_cultural_note  text,
  ai_phonetic       text,

  -- Moderation
  moderation_passed boolean DEFAULT false,
  moderation_checks jsonb,

  created_at        timestamp DEFAULT now()
);
```

---

## 9. API Integrations

### Claude API
- Model: claude-sonnet-4-20250514
- Call 1: Content safety moderation — 4 checks, returns JSON
- Call 2: Cultural enrichment — tags, cultural note, phonetic approximation
- Input: form metadata only (never audio)

### Supabase
- Database: Postgres for echo records
- Storage: audio files in echoes-audio bucket
- Free tier: 500MB storage, 2GB bandwidth per month

---

## 10. Design System

### Colors
```
--space:   #050810    background
--deep:    #0a1020    cards, panels
--surface: #111827    inputs
--border:  rgba(100, 160, 255, 0.15)
--blue:    #4f8ef7    primary accent
--teal:    #2dd4a0    success, echo markers
--amber:   #f0a952    pin marker, AI badge
--danger:  #f87171    errors, record button
--text:    #e8eeff    primary text
--muted:   #6b7fa3    secondary text
```

### Typography
- Headings: Playfair Display (serif, Google Fonts)
- Labels / Mono: DM Mono (Google Fonts)
- Body: DM Sans (Google Fonts)

---

## 11. Pages and Routes

| Route | Component | Description |
|-------|-----------|-------------|
| / | Home.jsx | Globe hero + How It Works + Record + Latest |
| /archive | Archive.jsx | Full searchable archive |
| /echo/:id | VoiceDetail.jsx | Full linguistic fiche |

---

## 12. MVP Scope

### Must have
- 3D globe with real continents and click-to-pin
- 3-step recording flow with full linguistic fiche
- Real microphone capture via Web Audio API
- Claude AI moderation (4 checks)
- Claude AI enrichment (tags, cultural note, phonetic)
- Voice Fiche detail page
- Supabase database and audio storage
- Archive page with filter and search
- Deployed on Vercel

### Nice to have
- Reverse geocoding of pin coordinates
- ISO 639-3 autocomplete suggestions
- Share echo as link
- Animated arc on globe when new echo is submitted

### Out of scope
- Satellite integration of any kind
- User authentication
- Mobile app
- Multilingual UI

---

## 13. Environment Variables

```
VITE_ANTHROPIC_API_KEY=    Claude API key
VITE_SUPABASE_URL=         Supabase project URL
VITE_SUPABASE_ANON_KEY=    Supabase anon key
```

---

## 14. Hackathon Checklist (SHP 2026)

- [ ] Project Description 200-500 words
- [ ] Public GitHub repository
- [ ] Team members listed in README
- [ ] AI Tools Disclosure: Claude API + Claude Code
- [ ] Post-event survey completed
- [ ] Discord joined: https://discord.gg/Wf6YmKgMnu

---

## 15. Project Description (ready to submit)

More than 3,000 languages are at risk of disappearing this century. Most belong
to isolated communities — their stories, songs, and knowledge existing only in
the memories of their last speakers. When those speakers are gone, a world
disappears with them.

Echoes is a cultural heritage platform built around a 3D interactive globe.
Community members place a precise pin on the globe to mark the exact origin of
their language or dialect — because Breton is not French, Sicilian is not Italian,
and every dialect deserves its own place on the map.

Contributors record audio directly in the browser and fill a linguistic fiche:
language name and dialect, transcription in original script, phonetic approximation,
and a translation if available. Claude AI reviews each submission for content safety
and enriches it with cultural context tags and phonetic approximations when none
are provided — without ever overwriting what the community itself contributed.

The result is a permanent, publicly accessible global archive explorable through
the globe. Researchers can find recordings by language, region, or content type.
Each Voice Fiche displays the full linguistic record alongside the audio.

Echoes connects humanity across the cosmos by ensuring the voices of isolated
communities reach the entire world — and survive long after their speakers are gone.

Built for SHP 2026. Theme: ORBIT. Connecting humanity across the cosmos.

---

*Echoes — SHP 2026*
*"We don't translate cultures. We preserve voices."*
