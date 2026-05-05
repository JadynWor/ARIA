import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import './App.css'

type VideoMode = 'selecting' | 'streaming'

// ─────────────────────────────────────────────────────────────────────────────
// ARIA — live backend edition
//   Video: MJPEG at http://localhost:8000/video_feed (bboxes drawn by backend)
//   Data:  WebSocket at ws://localhost:8000/stream
// ─────────────────────────────────────────────────────────────────────────────

type Classification = 'WAVING' | 'LYING_DOWN' | 'STATIONARY' | 'OBSCURED' | 'UNKNOWN'

interface Detection {
  id: number
  bbox: [number, number, number, number]
  confidence: number
  class_id: number
  classification: Classification
  priority_score: number
  first_seen: number
}

interface Briefing {
  report: string
  timestamp: number
}

const IMG_W = 640
const IMG_H = 640
const COLS = ['A', 'B', 'C', 'D', 'E']
const ROWS = ['1', '2', '3', '4', '5', '6', '7', '8']

// ─── Helpers ────────────────────────────────────────────────────────────────

function bboxToGrid(bbox: number[]): string {
  const cx = (bbox[0] + bbox[2]) / 2
  const cy = (bbox[1] + bbox[3]) / 2
  const c = Math.min(Math.floor((cx / IMG_W) * COLS.length), COLS.length - 1)
  const r = Math.min(Math.floor((cy / IMG_H) * ROWS.length), ROWS.length - 1)
  return `${COLS[c]}${ROWS[r]}`
}

function estimateDistance(bbox: number[]): 'CLOSE' | 'MED' | 'FAR' {
  const area = (bbox[2] - bbox[0]) * (bbox[3] - bbox[1])
  if (area > 5000) return 'CLOSE'
  if (area > 1500) return 'MED'
  return 'FAR'
}

function fmtTime(s: number): string {
  const h = Math.floor(s / 3600).toString().padStart(2, '0')
  const m = Math.floor((s % 3600) / 60).toString().padStart(2, '0')
  const sec = Math.floor(s % 60).toString().padStart(2, '0')
  return `${h}:${m}:${sec}`
}

// UNKNOWN maps to the same visual treatment as STATIONARY
const TONE: Record<Classification, string> = {
  WAVING:     'waving',
  LYING_DOWN: 'lying',
  STATIONARY: 'station',
  OBSCURED:   'obscure',
  UNKNOWN:    'station',
}

const CLASS_SHORT: Record<Classification, string> = {
  WAVING:     'WAVE',
  LYING_DOWN: 'CRIT',
  STATIONARY: 'STAT',
  OBSCURED:   'OBSC',
  UNKNOWN:    'STAT',
}

const CLASS_LABEL: Record<Classification, string> = {
  WAVING:     'Waving',
  LYING_DOWN: 'Lying down',
  STATIONARY: 'Stationary',
  OBSCURED:   'Obscured',
  UNKNOWN:    'Stationary',
}

const STATUS_LABEL: Record<Classification, string> = {
  WAVING:     'SIGNALING',
  LYING_DOWN: 'CRITICAL',
  STATIONARY: 'STATIONARY',
  OBSCURED:   'OBSCURED',
  UNKNOWN:    'STATIONARY',
}

function recommendedAction(d: Detection): string {
  const grid = bboxToGrid(d.bbox)
  switch (d.classification) {
    case 'LYING_DOWN':
      return `Deploy nearest ground unit to sector ${grid} for assessment. Possible casualty — extraction priority.`
    case 'WAVING':
      return `Subject in sector ${grid} is conscious and signaling. Coordinate verbal contact on next pass.`
    case 'STATIONARY':
    case 'UNKNOWN':
      return `Schedule closer pass over sector ${grid} to confirm condition.`
    case 'OBSCURED':
      return `Visibility limited. Re-scan sector ${grid} from alternate angle.`
  }
}

// ─── Briefing parsing ────────────────────────────────────────────────────────

interface ParsedBriefing {
  situation: string
  changes: string
  next: string
}

function parseBriefing(report: string): ParsedBriefing {
  const text = report.trim()

  const sectionRegex = /(SITUATION|UPDATE|CURRENT|STATUS|KEY CHANGES|PRIORITY TARGETS|CHANGES|NEXT ACTION|NEXT|ACTION|RECOMMENDED):\s*/gi
  const parts: Array<{ label: string; body: string }> = []
  let match: RegExpExecArray | null
  const matches: Array<{ idx: number; label: string }> = []
  while ((match = sectionRegex.exec(text)) !== null) {
    matches.push({ idx: match.index, label: match[1].toUpperCase() })
  }

  if (matches.length > 0) {
    matches.forEach((m, i) => {
      const labelEnd = text.indexOf(':', m.idx) + 1
      const end = i + 1 < matches.length ? matches[i + 1].idx : text.length
      const body = text.slice(labelEnd, end).trim()
      parts.push({ label: m.label, body })
    })
  }

  let situation = ''
  let changes = ''
  let next = ''

  parts.forEach(p => {
    if (/SITUATION|CURRENT|STATUS/.test(p.label)) situation = situation ? `${situation} ${p.body}` : p.body
    else if (/UPDATE|KEY CHANGES|PRIORITY TARGETS|CHANGES/.test(p.label)) changes = changes ? `${changes} ${p.body}` : p.body
    else if (/NEXT|ACTION|RECOMMENDED/.test(p.label)) next = next ? `${next} ${p.body}` : p.body
  })

  if (!situation && !changes && !next) {
    situation = text
  }

  if (situation && !next) {
    const sentences = situation.split(/(?<=[.!?])\s+/).filter(Boolean)
    if (sentences.length >= 3) {
      next = sentences[sentences.length - 1]
      situation = sentences.slice(0, -1).join(' ')
    }
  }

  if (situation && next && !changes) {
    const sentences = situation.split(/(?<=[.!?])\s+/).filter(Boolean)
    if (sentences.length >= 3) {
      situation = sentences[0]
      changes = sentences.slice(1).join(' ')
    }
  }

  return {
    situation: situation.trim(),
    changes: changes.trim(),
    next: next.trim(),
  }
}

// ─── Live WebSocket hook ─────────────────────────────────────────────────────

function useLiveFeed() {
  const [connected, setConnected] = useState(false)
  const [tick, setTick] = useState(0)
  const [detections, setDetections] = useState<Detection[]>([])
  const [coverage, setCoverage] = useState<Set<string>>(new Set())
  const [briefings, setBriefings] = useState<Briefing[]>([])
  const startRef = useRef<number>(0)
  const seenRef = useRef<Map<number, number>>(new Map())

  useEffect(() => {
    const ws = new WebSocket('ws://localhost:8000/stream')

    ws.onopen = () => {
      setConnected(true)
      startRef.current = Date.now()
    }

    ws.onmessage = (e) => {
      const msg = JSON.parse(e.data)
      const elapsed = (Date.now() - startRef.current) / 1000

      if (msg.type === 'frame') {
        setDetections(
          (msg.detections as any[]).map((d) => {
            if (!seenRef.current.has(d.id)) seenRef.current.set(d.id, elapsed)
            const cls: Classification = (['WAVING', 'LYING_DOWN', 'STATIONARY', 'OBSCURED', 'UNKNOWN'] as const).includes(d.classification)
              ? d.classification
              : 'UNKNOWN'
            return {
              id: d.id,
              bbox: d.bbox as [number, number, number, number],
              confidence: d.confidence ?? 0,
              class_id: d.class_id ?? 0,
              classification: cls,
              priority_score: d.priority_score ?? 0,
              first_seen: seenRef.current.get(d.id)!,
            }
          })
        )
      }

      if (msg.type === 'briefing') {
        setBriefings(prev => [...prev, { report: msg.report, timestamp: parseFloat(msg.timestamp) }])
      }

      if (msg.type === 'coverage') {
        setCoverage(new Set(msg.searched as string[]))
      }
    }

    ws.onclose = () => setConnected(false)
    ws.onerror = () => setConnected(false)

    return () => ws.close()
  }, [])

  useEffect(() => {
    if (!connected) return
    const id = setInterval(() => setTick((Date.now() - startRef.current) / 1000), 200)
    return () => clearInterval(id)
  }, [connected])

  return { connected, tick, detections, coverage, briefings }
}

// ─── Header ─────────────────────────────────────────────────────────────────

function Header({ connected, tick, onChangeVideo }: { connected: boolean; tick: number; onChangeVideo?: () => void }) {
  return (
    <header className="aria-header">
      <div className="header-brand">
        <div className="logo-mark" aria-hidden>
          <svg viewBox="0 0 32 32" width="28" height="28">
            <circle cx="16" cy="16" r="14" fill="none" stroke="var(--amber)" strokeWidth="1.5" />
            <circle cx="16" cy="16" r="9"  fill="none" stroke="var(--amber)" strokeWidth="1" opacity="0.5" />
            <circle cx="16" cy="16" r="2.5" fill="var(--amber-hot)" />
            <line x1="16" y1="2"  x2="16" y2="7"  stroke="var(--amber)" strokeWidth="1.5" />
            <line x1="16" y1="25" x2="16" y2="30" stroke="var(--amber)" strokeWidth="1.5" />
            <line x1="2"  y1="16" x2="7"  y2="16" stroke="var(--amber)" strokeWidth="1.5" />
            <line x1="25" y1="16" x2="30" y2="16" stroke="var(--amber)" strokeWidth="1.5" />
          </svg>
        </div>
        <div className="brand-text">
          <h1>ARIA</h1>
          <p>Aerial Rescue Intelligence &amp; Analysis</p>
        </div>
      </div>

      <div className="header-mission">
        <span className="mission-label mono">Mission</span>
        <span className="mission-name mono">Search &amp; Rescue · Active Scan</span>
      </div>

      <div className="header-right">
        {onChangeVideo && (
          <button className="change-video-btn mono" onClick={onChangeVideo}>CHANGE VIDEO</button>
        )}
        <div className={`live ${connected ? 'on' : 'off'}`}>
          <span className="live-dot" />
          <span className="live-label">{connected ? 'LIVE' : 'CONNECTING'}</span>
        </div>
        <span className="timer mono">T+{fmtTime(tick)}</span>
      </div>
    </header>
  )
}

// ─── Video feed (MJPEG img + selection ring overlay) ────────────────────────

function VideoFeed({
  detections,
  selectedId,
  onClickAway,
}: {
  detections: Detection[]
  selectedId: number | null
  onClickAway: () => void
}) {
  const critical = detections.filter(d => d.classification === 'LYING_DOWN').length
  const selected = selectedId !== null ? detections.find(d => d.id === selectedId) : null

  return (
    <div className="feed-container">
      <div className="feed-canvas" onClick={onClickAway}>
        <img
          src="http://localhost:8000/video_feed"
          alt="Drone feed"
          style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
        />

        {/* Selection ring — frontend-only since MJPEG doesn't know current selection */}
        {selected && (() => {
          const d = selected
          const left   = (d.bbox[0] / IMG_W) * 100
          const top    = (d.bbox[1] / IMG_H) * 100
          const width  = ((d.bbox[2] - d.bbox[0]) / IMG_W) * 100
          const height = ((d.bbox[3] - d.bbox[1]) / IMG_H) * 100
          return (
            <div
              className={`bbox bbox-${TONE[d.classification]} selected`}
              style={{ position: 'absolute', left: `${left}%`, top: `${top}%`, width: `${width}%`, height: `${height}%`, pointerEvents: 'none' }}
            >
              <div className="bbox-corner tl" />
              <div className="bbox-corner tr" />
              <div className="bbox-corner bl" />
              <div className="bbox-corner br" />
            </div>
          )
        })()}

        <div className="feed-stat">
          <div className="feed-stat-num mono">{detections.length.toString().padStart(2, '0')}</div>
          <div className="feed-stat-meta">
            <span className="feed-stat-label mono">Persons Located</span>
            {critical > 0 && (
              <span className="critical-pill">
                <span className="critical-dot" />
                {critical} CRITICAL
              </span>
            )}
          </div>
        </div>

        <div className="rec-overlay mono">
          <span className="rec-dot" />
          REC
        </div>
      </div>
    </div>
  )
}

// ─── Video source selector ──────────────────────────────────────────────────

function VideoSourceSelector({ onVideoReady }: { onVideoReady: () => void }) {
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const [dragOver, setDragOver] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const handleFile = useCallback(async (file: File) => {
    setError('')
    setUploading(true)
    try {
      const form = new FormData()
      form.append('file', file)
      const res = await fetch('http://localhost:8000/upload_video', { method: 'POST', body: form })
      if (!res.ok) throw new Error(`Upload failed (${res.status})`)
      onVideoReady()
    } catch (e: any) {
      setError(e.message || 'Upload failed')
      setUploading(false)
    }
  }, [onVideoReady])

  const handleDemo = useCallback(async () => {
    setError('')
    setUploading(true)
    try {
      const res = await fetch('http://localhost:8000/start_demo', { method: 'POST' })
      if (!res.ok) throw new Error(`Failed (${res.status})`)
      onVideoReady()
    } catch (e: any) {
      setError(e.message || 'Failed to start demo')
      setUploading(false)
    }
  }, [onVideoReady])

  return (
    <div className="video-selector">
      <div
        className={`video-selector-drop ${dragOver ? 'drag-over' : ''}`}
        onDragOver={e => { e.preventDefault(); setDragOver(true) }}
        onDragLeave={() => setDragOver(false)}
        onDrop={e => {
          e.preventDefault()
          setDragOver(false)
          const file = e.dataTransfer.files[0]
          if (file) handleFile(file)
        }}
        onClick={() => inputRef.current?.click()}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".mp4,video/mp4"
          style={{ display: 'none' }}
          onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f) }}
        />
        <div className="selector-icon" aria-hidden>
          <svg viewBox="0 0 48 48" width="48" height="48" fill="none">
            <rect x="6" y="10" width="36" height="28" rx="3" stroke="var(--amber)" strokeWidth="1.5" />
            <path d="M20 20l8 6-8 6z" fill="var(--amber)" opacity="0.6" />
          </svg>
        </div>
        {uploading
          ? <p className="selector-status mono">UPLOADING…</p>
          : <p className="selector-hint mono">DROP .MP4 HERE OR CLICK TO UPLOAD</p>
        }
      </div>

      <div className="selector-divider">
        <span className="selector-divider-line" />
        <span className="selector-divider-text mono">OR</span>
        <span className="selector-divider-line" />
      </div>

      <button className="selector-demo-btn mono" onClick={handleDemo} disabled={uploading}>
        USE SAMPLE DEMO
      </button>

      {error && <p className="selector-error mono">{error}</p>}
    </div>
  )
}

// ─── Priority list ──────────────────────────────────────────────────────────

function PriorityList({
  detections,
  selectedId,
  onSelect,
}: {
  detections: Detection[]
  selectedId: number | null
  onSelect: (id: number) => void
}) {
  const sorted = useMemo(
    () => [...detections].sort((a, b) => b.priority_score - a.priority_score),
    [detections],
  )
  const critical = sorted.filter(d => d.classification === 'LYING_DOWN')
  const rest     = sorted.filter(d => d.classification !== 'LYING_DOWN')

  return (
    <aside className="panel panel-priority">
      <header className="panel-head-tight">
        <h2>Priority</h2>
        <span className="head-count mono">{detections.length}</span>
      </header>

      {detections.length === 0 ? (
        <div className="priority-empty">
          <span className="empty-pulse" />
          <p className="mono">SCANNING…</p>
        </div>
      ) : (
        <div className="priority-list">
          {critical.length > 0 && (
            <>
              <div className="priority-section">
                <span className="section-label mono">Critical</span>
                <span className="section-line" />
              </div>
              {critical.map(d => (
                <PriorityRow key={d.id} d={d} selected={selectedId === d.id} onClick={() => onSelect(d.id)} />
              ))}
            </>
          )}
          {rest.length > 0 && (
            <>
              <div className="priority-section">
                <span className="section-label mono">Located</span>
                <span className="section-line" />
              </div>
              {rest.map(d => (
                <PriorityRow key={d.id} d={d} selected={selectedId === d.id} onClick={() => onSelect(d.id)} />
              ))}
            </>
          )}
        </div>
      )}
    </aside>
  )
}

function PriorityRow({
  d,
  selected,
  onClick,
}: {
  d: Detection
  selected: boolean
  onClick: () => void
}) {
  const tone = TONE[d.classification]
  return (
    <button className={`prio-row tone-${tone} ${selected ? 'selected' : ''}`} onClick={onClick}>
      <span className="prio-dot" />
      <span className="prio-id mono">#{d.id.toString().padStart(3, '0')}</span>
      <span className="prio-class mono">{CLASS_SHORT[d.classification]}</span>
      <span className="prio-conf mono">{Math.round(d.confidence * 100)}</span>
    </button>
  )
}

// ─── Coverage panel ──────────────────────────────────────────────────────────

function CoveragePanel({ coverage, detections }: { coverage: Set<string>; detections: Detection[] }) {
  const total = COLS.length * ROWS.length
  const pct = Math.round((coverage.size / total) * 100)

  // Cells that currently have a detection on them
  const activeCells = new Set(detections.map(d => bboxToGrid(d.bbox)))

  // Last searched cell (for "ACTIVE" indicator)
  const activeCell = activeCells.size > 0 ? [...activeCells][0] : null

  return (
    <section className="panel panel-coverage">
      <header className="panel-head-tight">
        <h2>Coverage</h2>
        <span className="cov-pct mono">{pct}%</span>
      </header>

      <div className="coverage-grid-wrap">
        <div className="coverage-grid-labeled">
          <div className="cov-corner" />
          {COLS.map(c => <div key={`col-${c}`} className="cov-col-label mono">{c}</div>)}
          {ROWS.flatMap(r => [
            <div key={`row-${r}`} className="cov-row-label mono">{r}</div>,
            ...COLS.map(c => {
              const cell = `${c}${r}`
              const searched = coverage.has(cell)
              const isActive = activeCells.has(cell)
              return (
                <div
                  key={cell}
                  className={`cov-cell ${searched ? 'searched' : ''} ${isActive ? 'latest' : ''}`}
                  title={cell}
                />
              )
            }),
          ])}
        </div>

        <div className="cov-legend mono">
          <span className="cov-legend-item">
            <span className="cov-legend-dot unsearched" />
            Unsearched
          </span>
          <span className="cov-legend-item">
            <span className="cov-legend-dot searched" />
            Searched
          </span>
          <span className="cov-legend-item">
            <span className="cov-legend-dot active" />
            Active
          </span>
        </div>
      </div>

      <div className="cov-meta">
        <div className="cov-meta-row mono">
          <span className="cov-meta-key">Searched</span>
          <span className="cov-meta-val">{coverage.size}/{total}</span>
        </div>
        {activeCell && (
          <div className="cov-meta-row mono">
            <span className="cov-meta-key">Active</span>
            <span className="cov-meta-val accent">{activeCell}</span>
          </div>
        )}
      </div>
    </section>
  )
}

// ─── Subject Detail panel ────────────────────────────────────────────────────

function SubjectDetailPanel({
  detection,
  onClose,
}: {
  detection: Detection
  onClose: () => void
}) {
  const tone = TONE[detection.classification]
  const grid = bboxToGrid(detection.bbox)
  const distance = estimateDistance(detection.bbox)

  return (
    <section className={`panel panel-subject tone-${tone}`}>
      <header className="panel-head-tight">
        <h2>Subject Detail</h2>
        <button className="subject-close mono" onClick={onClose} aria-label="Close detail">×</button>
      </header>

      <div className="subject-body">
        <div className="subject-id-row">
          <span className="subject-id mono">#{detection.id.toString().padStart(3, '0')}</span>
          <span className={`subject-status status-${tone} mono`}>
            <span className="subject-status-dot" />
            {STATUS_LABEL[detection.classification]}
          </span>
        </div>

        <dl className="subject-fields">
          <div className="subject-field">
            <dt className="mono">Confidence</dt>
            <dd className="mono">{Math.round(detection.confidence * 100)}%</dd>
          </div>
          <div className="subject-field">
            <dt className="mono">Grid Sector</dt>
            <dd className="mono accent">{grid}</dd>
          </div>
          <div className="subject-field">
            <dt className="mono">Classification</dt>
            <dd className="mono">{CLASS_LABEL[detection.classification]}</dd>
          </div>
          <div className="subject-field">
            <dt className="mono">Distance</dt>
            <dd className="mono">{distance}</dd>
          </div>
          <div className="subject-field">
            <dt className="mono">Priority Score</dt>
            <dd className="mono">{detection.priority_score.toFixed(2)}</dd>
          </div>
        </dl>

        <div className="subject-action">
          <div className="subject-action-label mono">Recommended Action</div>
          <p className="subject-action-text">{recommendedAction(detection)}</p>
        </div>
      </div>
    </section>
  )
}

// ─── Briefing banner ─────────────────────────────────────────────────────────

function BriefingBanner({ briefings, tick }: { briefings: Briefing[]; tick: number }) {
  const latest = briefings[briefings.length - 1]
  const [expanded, setExpanded] = useState(true)
  const lastSeenTimestamp = useRef<number | null>(null)
  const [showNew, setShowNew] = useState(false)

  useEffect(() => {
    if (!latest) return
    if (latest.timestamp !== lastSeenTimestamp.current) {
      lastSeenTimestamp.current = latest.timestamp
      setExpanded(true)
      setShowNew(true)
      const t = setTimeout(() => setShowNew(false), 5000)
      return () => clearTimeout(t)
    }
  }, [latest])

  const age = latest ? Math.floor(Date.now() / 1000 - latest.timestamp) : 0
  const isFresh = age >= 0 && age < 12

  if (!latest) {
    return (
      <section className="briefing-banner awaiting">
        <span className="briefing-icon-pulse" />
        <span className="briefing-banner-title serif italic">Awaiting first briefing</span>
        <span className="briefing-banner-stamp mono">Gemma 4B · on-device</span>
        <span className="briefing-banner-spacer" />
      </section>
    )
  }

  const parsed = parseBriefing(latest.report)
  const previewText = parsed.situation || parsed.changes || parsed.next || latest.report

  return (
    <section className={`briefing-banner ${expanded ? 'expanded' : 'collapsed'} ${isFresh ? 'fresh' : ''}`}>
      <button className="briefing-bar" onClick={() => setExpanded(e => !e)}>
        <span className={`chevron ${expanded ? 'down' : 'right'}`} aria-hidden>▾</span>
        <span className="briefing-banner-title serif italic">Field Briefing</span>
        <span className="briefing-banner-stamp mono">T+{fmtTime(tick)}</span>
        {showNew && <span className="new-badge mono">NEW</span>}
        {!expanded && (
          <span className="briefing-preview mono">
            {previewText.slice(0, 110)}…
          </span>
        )}
        <span className="briefing-banner-spacer" />
        <span className="briefing-banner-meta mono">
          GEMMA 4B · ON-DEVICE · UPDATED {age < 0 || isNaN(age) ? 'JUST NOW' : `${age}S AGO`}
        </span>
      </button>

      <div className="briefing-banner-body">
        <div className="briefing-banner-inner">
          <div className="briefing-sections">
            {parsed.situation && (
              <div className="briefing-section">
                <div className="briefing-section-label mono">Situation</div>
                <p className="briefing-section-text serif">{parsed.situation}</p>
              </div>
            )}
            {parsed.changes && (
              <div className="briefing-section">
                <div className="briefing-section-label mono">Key Changes</div>
                <p className="briefing-section-text serif">{parsed.changes}</p>
              </div>
            )}
            {parsed.next && (
              <div className="briefing-section briefing-section-action">
                <div className="briefing-section-label mono">Next Action</div>
                <p className="briefing-section-text serif">{parsed.next}</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  )
}

// ─── Footer ─────────────────────────────────────────────────────────────────

function FooterStrip() {
  return (
    <footer className="aria-footer">
      <span className="mono">YOLO V9C</span>
      <span className="footer-divider">·</span>
      <span className="mono">BYTETRACK</span>
      <span className="footer-divider">·</span>
      <span className="mono">EFFICIENTNET</span>
      <span className="footer-divider">·</span>
      <span className="mono">GEMMA 4B · OLLAMA</span>
      <span className="footer-spacer" />
      <span className="mono footer-tagline">EVERY DETECTION IS A PERSON</span>
    </footer>
  )
}

// ─── Main ────────────────────────────────────────────────────────────────────

export default function App() {
  const { connected, tick, detections, coverage, briefings } = useLiveFeed()
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [videoMode, setVideoMode] = useState<VideoMode>('selecting')

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get('autostart') === 'true') {
      fetch('http://localhost:8000/start_demo', { method: 'POST' })
        .then(() => setVideoMode('streaming'))
        .catch(() => {})
    }
  }, [])

  useEffect(() => {
    if (selectedId !== null && !detections.find(d => d.id === selectedId)) {
      setSelectedId(null)
    }
  }, [detections, selectedId])

  const selected = selectedId !== null
    ? detections.find(d => d.id === selectedId) ?? null
    : null

  return (
    <div className="aria-app">
      <Header
        connected={connected}
        tick={tick}
        onChangeVideo={videoMode === 'streaming' ? () => {
          fetch('http://localhost:8000/stop_video', { method: 'POST' })
          setVideoMode('selecting')
        } : undefined}
      />

      <main className="aria-main">
        <PriorityList
          detections={detections}
          selectedId={selectedId}
          onSelect={(id) => setSelectedId(prev => prev === id ? null : id)}
        />
        {videoMode === 'selecting'
          ? <VideoSourceSelector onVideoReady={() => setVideoMode('streaming')} />
          : <VideoFeed
              detections={detections}
              selectedId={selectedId}
              onClickAway={() => setSelectedId(null)}
            />
        }
        {selected
          ? <SubjectDetailPanel detection={selected} onClose={() => setSelectedId(null)} />
          : <CoveragePanel coverage={coverage} detections={detections} />}
      </main>

      <BriefingBanner briefings={briefings} tick={tick} />

      <FooterStrip />
    </div>
  )
}
