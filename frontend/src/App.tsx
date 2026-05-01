import { useState, useEffect, useRef } from 'react'
import './App.css'

/* ─── Types ─── */
interface Detection {
  id: number
  bbox: number[]
  confidence: number
  class_id: number
  classification?: string
  priority_score?: number
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

interface FrameMessage {
  type: 'frame'
  detections: Detection[]
}

type WSMessage = FrameMessage | BriefingMessage | CoverageMessage

/* ─── Helpers ─── */
function bboxToGrid(bbox: number[], imageWidth = 640, imageHeight = 640): string {
  const cols = ['A', 'B', 'C', 'D', 'E']
  const rows = ['1', '2', '3', '4', '5', '6', '7', '8']
  const cx = (bbox[0] + bbox[2]) / 2
  const cy = (bbox[1] + bbox[3]) / 2
  const colIdx = Math.min(Math.floor((cx / imageWidth) * cols.length), cols.length - 1)
  const rowIdx = Math.min(Math.floor((cy / imageHeight) * rows.length), rows.length - 1)
  return `${cols[colIdx]}${rows[rowIdx]}`
}

function confidenceColor(conf: number): string {
  if (conf >= 0.7) return '#ff3b3b'
  if (conf >= 0.5) return '#ff8c3b'
  if (conf >= 0.3) return '#ffd03b'
  return '#888'
}

function estimateDistance(bbox: number[]): { label: string; color: string } {
  const w = bbox[2] - bbox[0]
  const h = bbox[3] - bbox[1]
  const area = w * h
  if (area > 5000) return { label: 'CLOSE', color: '#22c55e' }
  if (area > 1500) return { label: 'MED', color: '#ffd03b' }
  return { label: 'FAR', color: '#ff8c3b' }
}

function classificationColor(cls: string): string {
  switch (cls) {
    case 'WAVING': return '#ff3b3b'
    case 'LYING_DOWN': return '#ff8c3b'
    case 'STATIONARY': return '#ffd03b'
    case 'OBSCURED': return '#888'
    default: return '#3b8bff'
  }
}

/* ─── App ─── */
function App() {
  const [detections, setDetections] = useState<Detection[]>([])
  const [briefing, setBriefing] = useState<string>('')
  const [briefingTime, setBriefingTime] = useState<string>('')
  const [briefingHistory, setBriefingHistory] = useState<string[]>([])
  const [coverage, setCoverage] = useState<string[]>([])
  const [coveragePercent, setCoveragePercent] = useState<number>(0)
  const [connected, setConnected] = useState<boolean>(false)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  const gridCols = ['A', 'B', 'C', 'D', 'E']
  const gridRows = ['1', '2', '3', '4', '5', '6', '7', '8']

  /* ─── WebSocket ─── */
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

  /* ─── Overhead Map Canvas ─── */
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const w = canvas.width
    const h = canvas.height
    const cellW = w / gridCols.length
    const cellH = h / gridRows.length

    ctx.fillStyle = '#0a0f14'
    ctx.fillRect(0, 0, w, h)

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

        ctx.fillStyle = 'rgba(255,255,255,0.15)'
        ctx.font = '9px "IBM Plex Mono", monospace'
        ctx.fillText(cellId, x + 4, y + 12)
      })
    })

    detections.forEach((det) => {
      if (!det.bbox || det.bbox.length < 4) return

      const grid = bboxToGrid(det.bbox)
      const col = grid[0]
      const row = grid.slice(1)
      const ci = gridCols.indexOf(col)
      const ri = gridRows.indexOf(row)
      if (ci === -1 || ri === -1) return

      const cx = ci * cellW + cellW / 2
      const cy = ri * cellH + cellH / 2
      const color = confidenceColor(det.confidence)

      ctx.beginPath()
      ctx.arc(cx, cy, 14, 0, Math.PI * 2)
      ctx.strokeStyle = color
      ctx.lineWidth = 1
      ctx.globalAlpha = 0.3
      ctx.stroke()
      ctx.globalAlpha = 1

      ctx.beginPath()
      ctx.arc(cx, cy, 6, 0, Math.PI * 2)
      ctx.fillStyle = color
      ctx.fill()

      ctx.fillStyle = '#fff'
      ctx.font = 'bold 10px "IBM Plex Mono", monospace'
      ctx.textAlign = 'center'
      ctx.fillText(`P${det.id}`, cx, cy - 18)

      ctx.font = '8px "IBM Plex Mono", monospace'
      ctx.fillStyle = color
      ctx.fillText(`${(det.confidence * 100).toFixed(0)}%`, cx, cy + 24)
      ctx.textAlign = 'start'
    })
  }, [detections, coverage])

  /* ─── Sorted Detections ─── */
  const sortedDetections = [...detections].sort(
    (a, b) => b.confidence - a.confidence
  )

  /* ─── Render ─── */
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
          <div className="aria-det-count">
            {detections.length} TARGETS
          </div>
        </div>
      </header>

      {/* Main Grid */}
      <div className="aria-grid">
        {/* Left — Video Feed + Detections */}
        <div className="aria-panel video-panel">
          <div className="panel-header">
            <span className="panel-label">LIVE FEED</span>
            <span className="panel-meta">{detections.length} detections</span>
          </div>
          <div className="video-container">
            <img
              src="http://localhost:8000/video_feed"
              alt="Drone feed"
              className="video-feed"
            />
          </div>

          {/* Detection list */}
          <div className="detection-list">
            <div className="detection-header">
              <span className="dh-pri">PRI</span>
              <span className="dh-id">ID</span>
              <span className="dh-grid">GRID</span>
              <span className="dh-class">STATUS</span>
              <span className="dh-dist">DIST</span>
              <span className="dh-conf">CONF</span>
            </div>
            {sortedDetections.map((det, i) => {
              const dist = estimateDistance(det.bbox)
              return (
                <div
                  key={det.id}
                  className="detection-item"
                  style={{ borderLeftColor: confidenceColor(det.confidence) }}
                >
                  <span className="det-priority">P{i + 1}</span>
                  <span className="det-id">ID-{det.id}</span>
                  <span className="det-grid">{bboxToGrid(det.bbox)}</span>
                  <span className="det-class" style={{ color: classificationColor(det.classification || 'HUMAN') }}>
                    {det.classification || 'HUMAN'}
                  </span>
                  <span className="det-dist" style={{ color: dist.color }}>{dist.label}</span>
                  <span className="det-conf">{(det.confidence * 100).toFixed(0)}%</span>
                </div>
              )
            })}
          </div>
        </div>

        {/* Right — Map + Briefing */}
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
                {briefingTime ? `Updated ${new Date(parseFloat(briefingTime) * 1000).toLocaleTimeString()}` : 'Awaiting report'}
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