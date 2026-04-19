import { useState, useEffect, useRef } from 'react'
import './App.css'

interface Detection {
  id: number
  grid: string
  classification: string
  confidence: number
}

interface FrameMessage {
  type: 'frame'
  image: string
  detections: Detection[]
}

interface BriefingMessage {
  type: 'briefing'
  report: string
  timestamp: string
}

interface CoverageMessage {
  type: 'coverage'
  searched: string[]
  percentage: number
}

type WSMessage = FrameMessage | BriefingMessage | CoverageMessage

function App() {
  const [detections, setDetections] = useState<Detection[]>([])
  const [briefing, setBriefing] = useState<string>('')
  const [briefingTime, setBriefingTime] = useState<string>('')
  const [briefingHistory, setBriefingHistory] = useState<string[]>([])
  const [coverage, setCoverage] = useState<string[]>([])
  const [coveragePercent, setCoveragePercent] = useState<number>(0)
  const [connected, setConnected] = useState<boolean>(false)
  const [frameImage, setFrameImage] = useState<string>('')
  const canvasRef = useRef<HTMLCanvasElement>(null)

  // Grid configuration
  const gridCols = ['A', 'B', 'C', 'D', 'E']
  const gridRows = ['1', '2', '3', '4', '5', '6', '7', '8']

  const classificationColor = (cls: string): string => {
    switch (cls) {
      case 'WAVING': return '#ff3b3b'
      case 'LYING_DOWN': return '#ff8c3b'
      case 'STATIONARY': return '#ffd03b'
      case 'OBSCURED': return '#888'
      default: return '#666'
    }
  }

  const priorityFromClassification = (cls: string, conf: number): number => {
    const weights: Record<string, number> = {
      'WAVING': 1.0,
      'LYING_DOWN': 0.85,
      'OBSCURED': 0.7,
      'STATIONARY': 0.5,
    }
    return (weights[cls] || 0.5) * conf
  }

  useEffect(() => {
    const socket = new WebSocket('ws://localhost:8000/stream')

    socket.onopen = () => {
      console.log('ARIA connected')
      setConnected(true)
    }

    socket.onmessage = (event) => {
      const data: WSMessage = JSON.parse(event.data)

      if (data.type === 'frame') {
        setDetections(data.detections)
        setFrameImage(data.image)
      }

      if (data.type === 'briefing') {
        setBriefingHistory(prev => [data.report, ...prev].slice(0, 10))
        setBriefing(data.report)
        setBriefingTime(data.timestamp)
      }

      if (data.type === 'coverage') {
        setCoverage(data.searched)
        setCoveragePercent(data.percentage)
      }
    }

    socket.onerror = () => setConnected(false)
    socket.onclose = () => setConnected(false)

    return () => socket.close()
  }, [])

  // Draw overhead map on canvas
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const w = canvas.width
    const h = canvas.height
    const cellW = w / gridCols.length
    const cellH = h / gridRows.length

    // Clear
    ctx.fillStyle = '#0a0f14'
    ctx.fillRect(0, 0, w, h)

    // Draw grid
    gridCols.forEach((col, ci) => {
      gridRows.forEach((row, ri) => {
        const cellId = `${col}${row}`
        const x = ci * cellW
        const y = ri * cellH
        const isSearched = coverage.includes(cellId)

        ctx.fillStyle = isSearched ? 'rgba(34, 197, 94, 0.12)' : 'rgba(255,255,255,0.02)'
        ctx.fillRect(x + 1, y + 1, cellW - 2, cellH - 2)

        ctx.strokeStyle = 'rgba(255,255,255,0.08)'
        ctx.lineWidth = 0.5
        ctx.strokeRect(x, y, cellW, cellH)

        // Cell label
        ctx.fillStyle = 'rgba(255,255,255,0.15)'
        ctx.font = '9px "IBM Plex Mono", monospace'
        ctx.fillText(cellId, x + 4, y + 12)
      })
    })

    // Draw detections on map
    detections
      .sort((a, b) => priorityFromClassification(b.classification, b.confidence) - priorityFromClassification(a.classification, a.confidence))
      .forEach((det) => {
        const col = det.grid[0]
        const row = det.grid.slice(1)
        const ci = gridCols.indexOf(col)
        const ri = gridRows.indexOf(row)
        if (ci === -1 || ri === -1) return

        const cx = ci * cellW + cellW / 2
        const cy = ri * cellH + cellH / 2
        const color = classificationColor(det.classification)

        // Pulse ring
        ctx.beginPath()
        ctx.arc(cx, cy, 14, 0, Math.PI * 2)
        ctx.strokeStyle = color
        ctx.lineWidth = 1
        ctx.globalAlpha = 0.3
        ctx.stroke()
        ctx.globalAlpha = 1

        // Detection dot
        ctx.beginPath()
        ctx.arc(cx, cy, 6, 0, Math.PI * 2)
        ctx.fillStyle = color
        ctx.fill()

        // ID label
        ctx.fillStyle = '#fff'
        ctx.font = 'bold 10px "IBM Plex Mono", monospace'
        ctx.textAlign = 'center'
        ctx.fillText(`P${det.id}`, cx, cy - 18)

        // Classification label
        ctx.font = '8px "IBM Plex Mono", monospace'
        ctx.fillStyle = color
        ctx.fillText(det.classification, cx, cy + 24)
        ctx.textAlign = 'start'
      })
  }, [detections, coverage])

  const sortedDetections = [...detections].sort(
    (a, b) => priorityFromClassification(b.classification, b.confidence) - priorityFromClassification(a.classification, a.confidence)
  )

  return (
    <div className="aria-root">
      {/* Header */}
      <header className="aria-header">
        <div className="aria-header-left">
          <div className="aria-logo">ARIA</div>
          <div className="aria-subtitle">Aerial Rescue Intelligence & Analysis</div>
        </div>
        <div className="aria-header-right">
          <div className={`aria-status ${connected ? 'connected' : 'disconnected'}`}>
            <span className="status-dot"></span>
            {connected ? 'LIVE' : 'DISCONNECTED'}
          </div>
          <div className="aria-coverage-badge">
            COVERAGE {coveragePercent}%
          </div>
        </div>
      </header>

      {/* Main Grid */}
      <div className="aria-grid">
        {/* Left — Video Feed */}
        <div className="aria-panel video-panel">
          <div className="panel-header">
            <span className="panel-label">LIVE FEED</span>
            <span className="panel-meta">{detections.length} detections</span>
          </div>
          <div className="video-container">
            {frameImage && frameImage !== 'base64_fake_image_data' ? (
              <img src={`data:image/jpeg;base64,${frameImage}`} alt="Drone feed" className="video-feed" />
            ) : (
              <div className="video-placeholder">
                <div className="placeholder-grid">
                  {Array.from({ length: 12 }).map((_, i) => (
                    <div key={i} className="placeholder-cell" />
                  ))}
                </div>
                <span>AWAITING VIDEO FEED</span>
              </div>
            )}
          </div>

          {/* Detection list under video */}
          <div className="detection-list">
            {sortedDetections.map((det, i) => (
              <div key={det.id} className="detection-item" style={{ borderLeftColor: classificationColor(det.classification) }}>
                <span className="det-priority">P{i + 1}</span>
                <span className="det-id">ID-{det.id}</span>
                <span className="det-grid">{det.grid}</span>
                <span className="det-class" style={{ color: classificationColor(det.classification) }}>
                  {det.classification}
                </span>
                <span className="det-conf">{(det.confidence * 100).toFixed(0)}%</span>
              </div>
            ))}
          </div>
        </div>

        {/* Right — Map + Briefing stacked */}
        <div className="aria-right">
          {/* Overhead Map */}
          <div className="aria-panel map-panel">
            <div className="panel-header">
              <span className="panel-label">OVERHEAD MAP</span>
              <span className="panel-meta">{coveragePercent}% searched</span>
            </div>
            <canvas
              ref={canvasRef}
              width={400}
              height={400}
              className="overhead-canvas"
            />
          </div>

          {/* Briefing Panel */}
          <div className="aria-panel briefing-panel">
            <div className="panel-header">
              <span className="panel-label">RESCUE BRIEFING</span>
              <span className="panel-meta">
                {briefingTime ? `Updated ${briefingTime}` : 'Awaiting report'}
              </span>
            </div>
            <div className="briefing-content">
              {briefing ? (
                <pre className="briefing-text">{briefing}</pre>
              ) : (
                <div className="briefing-waiting">
                  <span>Gemma 4B generating situation report...</span>
                </div>
              )}
            </div>
            {briefingHistory.length > 1 && (
              <div className="briefing-history">
                <span className="history-label">Previous reports ({briefingHistory.length - 1})</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default App