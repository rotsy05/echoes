import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { fetchEchoes } from '../services/supabase.js'
import './Archive.css'

function formatDate(iso) {
  if (!iso) return ''
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

function EchoCard({ echo }) {
  return (
    <Link to={`/echo/${echo.id}`} className="echo-card">
      <div className="echo-card__top">
        <span className="echo-card__type mono">{echo.content_type}</span>
        <span className="echo-card__date mono">{formatDate(echo.created_at)}</span>
      </div>
      <h2 className="echo-card__language">{echo.language}</h2>
      <p className="echo-card__community">{echo.community}</p>
      {echo.location_label && (
        <p className="echo-card__location mono">📍 {echo.location_label}</p>
      )}
      {echo.description && (
        <p className="echo-card__description">{echo.description}</p>
      )}
      <div className="echo-card__footer">
        <span className="echo-card__listen">Listen →</span>
      </div>
    </Link>
  )
}

export default function Archive() {
  const [echoes, setEchoes] = useState([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')

  useEffect(() => {
    fetchEchoes()
      .then(setEchoes)
      .finally(() => setLoading(false))
  }, [])

  const filtered = echoes.filter(e => {
    if (!query) return true
    const q = query.toLowerCase()
    return (
      e.language?.toLowerCase().includes(q) ||
      e.community?.toLowerCase().includes(q) ||
      e.location_label?.toLowerCase().includes(q)
    )
  })

  return (
    <main className="archive">
      <div className="archive-header">
        <div className="archive-header-inner">
          <p className="section-label mono">Archive</p>
          <h1>The Global Echo Archive</h1>
          <p className="archive-subhead">
            Browse and listen to oral traditions preserved from communities around the world.
          </p>
        </div>
      </div>

      <div className="archive-content">
        <div className="archive-inner">
          <div className="archive-controls">
            <input
              type="search"
              className="archive-search"
              placeholder="Search by language or community…"
              aria-label="Search echoes"
              value={query}
              onChange={e => setQuery(e.target.value)}
            />
            {!loading && (
              <span className="archive-count mono">
                {filtered.length} echo{filtered.length !== 1 ? 's' : ''}
              </span>
            )}
          </div>

          {loading && (
            <div className="archive-loading">
              <span className="archive-loading__dot" />
              <span className="archive-loading__dot" />
              <span className="archive-loading__dot" />
            </div>
          )}

          {!loading && filtered.length === 0 && (
            <p className="archive-empty">
              {query ? 'No echoes match your search.' : 'No echoes archived yet. Be the first.'}
            </p>
          )}

          {!loading && filtered.length > 0 && (
            <div className="archive-grid">
              {filtered.map(echo => <EchoCard key={echo.id} echo={echo} />)}
            </div>
          )}
        </div>
      </div>
    </main>
  )
}
