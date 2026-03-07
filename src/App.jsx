import { useState } from 'react'
import { Routes, Route } from 'react-router-dom'
import Navbar from './components/Navbar.jsx'
import Home from './pages/Home.jsx'
import Archive from './pages/Archive.jsx'
import EchoDetail from './pages/EchoDetail.jsx'

async function reverseGeocode(lat, lon) {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json`,
      { headers: { 'User-Agent': 'Echoes/1.0 (SHP 2026 Hackathon)' } },
    )
    const data = await res.json()
    const parts = [
      data.address?.city || data.address?.town || data.address?.village,
      data.address?.state || data.address?.region,
      data.address?.country,
    ].filter(Boolean)
    return parts.length ? parts.join(', ') : null
  } catch {
    return null
  }
}

function App() {
  const [pinMode, setPinMode] = useState(false)
  const [pin, setPin] = useState(null)

  function handlePinModeActivate() {
    setPin(null)
    setPinMode(true)
  }

  async function handlePinPlaced(lat, lon) {
    setPinMode(false)
    setPin({ lat, lon, location_label: null })
    const location_label = await reverseGeocode(lat, lon)
    setPin({ lat, lon, location_label })
  }

  function handlePinClose() {
    setPin(null)
  }

  return (
    <>
      <Navbar onPinModeActivate={handlePinModeActivate} />
      <Routes>
        <Route
          path="/"
          element={
            <Home
              pinMode={pinMode}
              pin={pin}
              onPinPlaced={handlePinPlaced}
              onPinClose={handlePinClose}
            />
          }
        />
        <Route path="/archive" element={<Archive />} />
        <Route path="/echo/:id" element={<EchoDetail />} />
      </Routes>
    </>
  )
}

export default App
