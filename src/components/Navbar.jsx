import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import './Navbar.css'

export default function Navbar({ onPinModeActivate }) {
  const [menuOpen, setMenuOpen] = useState(false)
  const location = useLocation()
  const navigate = useNavigate()

  function scrollToSection(id) {
    setMenuOpen(false)
    if (location.pathname !== '/') {
      navigate('/')
      // After navigation, the section scroll is handled by Home mounting
      sessionStorage.setItem('scrollTo', id)
      return
    }
    const el = document.getElementById(id)
    if (el) el.scrollIntoView({ behavior: 'smooth' })
  }

  return (
    <nav className="navbar" role="navigation" aria-label="Main navigation">
      <div className="navbar-inner">
        <Link to="/" className="navbar-logo" aria-label="Echoes home">
          <span className="logo-wordmark">Echoes</span>
          <span className="logo-sat" aria-label="Satellite connected">SAT</span>
        </Link>

        <div className={`navbar-links${menuOpen ? ' navbar-links--open' : ''}`}>
          <button className="nav-link" onClick={() => scrollToSection('how-it-works')}>
            How It Works
          </button>
          <Link
            to="/archive"
            className="nav-link"
            onClick={() => setMenuOpen(false)}
          >
            Archive
          </Link>
          <button
            className="nav-cta"
            onClick={() => {
              scrollToSection('record-section')
              onPinModeActivate?.()
            }}
          >
            Record a Voice
          </button>
        </div>

        <button
          className={`nav-mobile-toggle${menuOpen ? ' nav-mobile-toggle--open' : ''}`}
          aria-label={menuOpen ? 'Close menu' : 'Open menu'}
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((v) => !v)}
        >
          <span />
          <span />
          <span />
        </button>
      </div>
    </nav>
  )
}
