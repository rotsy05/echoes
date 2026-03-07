import { useRef, useEffect } from 'react'
import Globe from 'globe.gl'

// Suppress THREE.Clock deprecation warning from globe.gl's bundled Three.js (fixed in future releases)
const _warn = console.warn
console.warn = (...args) => {
  if (typeof args[0] === 'string' && args[0].includes('THREE.Clock')) return
  _warn.apply(console, args)
}

const DEFAULT_ECHOES = [
  { lat: -3.4,  lon: -65.7,  language: 'Pirahã',    contentType: 'story'     },
  { lat: -4.2,  lon: -75.3,  language: 'Yagua',      contentType: 'song'      },
  { lat: -3.5,  lon:  35.0,  language: 'Hadza',      contentType: 'ceremony'  },
  { lat:  27.5, lon:  89.6,  language: 'Dzongkha',   contentType: 'proverb'   },
  { lat:  60.0, lon: 152.0,  language: 'Itelmen',    contentType: 'story'     },
  { lat: -8.5,  lon: 115.3,  language: 'Balinese',   contentType: 'song'      },
  { lat:  18.0, lon: -92.0,  language: 'Chontal',    contentType: 'knowledge' },
  { lat:   9.0, lon:  38.7,  language: 'Oromo',      contentType: 'story'     },
  { lat: -20.0, lon:  24.0,  language: 'Khoisan',    contentType: 'song'      },
  { lat:  65.0, lon: -18.0,  language: 'Icelandic',  contentType: 'proverb'   },
  { lat:   4.0, lon: 114.0,  language: 'Iban',       contentType: 'ceremony'  },
  { lat: -23.0, lon: 130.0,  language: 'Arrernte',   contentType: 'knowledge' },
]

function buildTooltip(d) {
  return `
    <div style="
      background: #0a1020;
      border: 1px solid #2dd4a0;
      padding: 8px 12px;
      border-radius: 6px;
      font-family: 'DM Mono', monospace;
      font-size: 12px;
      color: #e8eeff;
      line-height: 1.5;
      pointer-events: none;
    ">
      <strong style="display:block;margin-bottom:2px">${d.language}</strong>
      <span style="color:#6b7fa3;text-transform:uppercase;font-size:10px;letter-spacing:0.08em">${d.contentType}</span>
    </div>
  `
}

export default function GlobeComponent({ echoes, newEcho, pinMode, pin, onPinPlaced }) {
  const containerRef   = useRef(null)
  const globeRef       = useRef(null)
  const arcTimerRef    = useRef(null)
  // Refs so the onGlobeClick closure always reads the latest prop values
  const pinModeRef     = useRef(false)
  const onPinPlacedRef = useRef(null)

  // ── Mount / unmount ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!containerRef.current) return

    const globe = Globe()(containerRef.current)
    globeRef.current = globe

    globe
      .globeImageUrl('//unpkg.com/three-globe/example/img/earth-blue-marble.jpg')
      .bumpImageUrl('//unpkg.com/three-globe/example/img/earth-topology.png')
      .backgroundImageUrl('//unpkg.com/three-globe/example/img/night-sky.png')
      .atmosphereColor('#4f8ef7')
      .atmosphereAltitude(0.15)
      // Points
      .pointsData(echoes ?? DEFAULT_ECHOES)
      .pointLat('lat')
      .pointLng('lon')
      .pointColor(d => d._isPin ? '#f0a952' : '#2dd4a0')
      .pointAltitude(0.01)
      .pointRadius(d => d._isPin ? 0.8 : 0.4)
      .pointsMerge(false)
      .pointLabel(d => d._isPin ? '' : buildTooltip(d))
      // Arcs (empty until newEcho arrives)
      .arcsData([])
      .arcStartLat('startLat')
      .arcStartLng('startLng')
      .arcEndLat('endLat')
      .arcEndLng('endLng')
      .arcColor(() => '#2dd4a0')
      .arcAltitude(0.4)
      .arcStroke(0.5)
      .arcDashLength(0.4)
      .arcDashGap(0.2)
      .arcDashAnimateTime(2000)

    // Click handler — only fires the callback when in pinMode
    globe.onGlobeClick(({ lat, lng }) => {
      if (pinModeRef.current && onPinPlacedRef.current) {
        onPinPlacedRef.current(lat, lng)
      }
    })

    globe.controls().autoRotate      = true
    globe.controls().autoRotateSpeed = 0.4

    globe.pointOfView({ lat: 20, lng: 0, altitude: 2.2 })

    // Resize handler
    function onResize() {
      globe.width(window.innerWidth).height(window.innerHeight)
    }
    window.addEventListener('resize', onResize)

    return () => {
      window.removeEventListener('resize', onResize)
      clearTimeout(arcTimerRef.current)
      // Remove the canvas globe.gl injected
      if (containerRef.current) {
        containerRef.current.innerHTML = ''
      }
      globeRef.current = null
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Sync echoes + pin into single points layer ───────────────────────────
  useEffect(() => {
    if (!globeRef.current) return
    const pinPoint = pin ? [{ lat: pin.lat, lon: pin.lon, _isPin: true }] : []
    globeRef.current.pointsData([...(echoes ?? DEFAULT_ECHOES), ...pinPoint])
  }, [echoes, pin])

  // ── pinMode: toggle auto-rotate + crosshair cursor ───────────────────────
  useEffect(() => {
    pinModeRef.current     = pinMode ?? false
    onPinPlacedRef.current = onPinPlaced ?? null

    if (!globeRef.current) return
    globeRef.current.controls().autoRotate = !pinMode
    if (containerRef.current) {
      containerRef.current.style.cursor = pinMode ? 'crosshair' : 'default'
    }
  }, [pinMode, onPinPlaced])

  // ── Satellite arc on new submission ───────────────────────────────────────
  useEffect(() => {
    if (!newEcho || !globeRef.current) return

    clearTimeout(arcTimerRef.current)

    // Arc from recording location up toward a satellite position (lat +30°)
    const satLat = Math.min(newEcho.lat + 30, 85)
    const arc = {
      startLat: newEcho.lat,
      startLng: newEcho.lon,
      endLat:   satLat,
      endLng:   newEcho.lon,
    }

    globeRef.current.arcsData([arc])

    // Fly camera to the new echo location
    globeRef.current.pointOfView(
      { lat: newEcho.lat, lng: newEcho.lon, altitude: 2.0 },
      1200,
    )

    // Clear arc after 4 s
    arcTimerRef.current = setTimeout(() => {
      if (globeRef.current) {
        globeRef.current.arcsData([])
      }
    }, 4000)

    return () => clearTimeout(arcTimerRef.current)
  }, [newEcho])

  return (
    <div
      ref={containerRef}
      style={{
        position: 'fixed',
        top:      0,
        left:     0,
        width:    '100vw',
        height:   '100vh',
        zIndex:   0,
      }}
    />
  )
}
