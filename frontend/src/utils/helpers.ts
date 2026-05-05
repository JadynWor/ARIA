export type VideoMode = 'selecting' | 'streaming'

export type Classification = 'WAVING' | 'LYING_DOWN' | 'STATIONARY' | 'OBSCURED' | 'UNKNOWN'

export interface Detection {
  id: number
  bbox: [number, number, number, number]
  confidence: number
  class_id: number
  classification: Classification
  priority_score: number
  first_seen: number
}

export interface Briefing {
  report: string
  timestamp: number
}

export interface ParsedBriefing {
  situation: string
  changes: string
  next: string
}

export interface HistoryEntry {
  id: number
  lastGrid: string
  lastSeen: number
  classification: Classification
}

export const IMG_W = 640
export const IMG_H = 640
export const COLS = ['A', 'B', 'C', 'D', 'E']
export const ROWS = ['1', '2', '3', '4', '5', '6', '7', '8']

export const TONE: Record<Classification, string> = {
  WAVING:     'waving',
  LYING_DOWN: 'lying',
  STATIONARY: 'station',
  OBSCURED:   'obscure',
  UNKNOWN:    'station',
}

export const CLASS_SHORT: Record<Classification, string> = {
  WAVING:     'WAVE',
  LYING_DOWN: 'CRIT',
  STATIONARY: 'STAT',
  OBSCURED:   'OBSC',
  UNKNOWN:    'STAT',
}

export const CLASS_LABEL: Record<Classification, string> = {
  WAVING:     'Waving',
  LYING_DOWN: 'Lying down',
  STATIONARY: 'Stationary',
  OBSCURED:   'Obscured',
  UNKNOWN:    'Stationary',
}

export const STATUS_LABEL: Record<Classification, string> = {
  WAVING:     'SIGNALING',
  LYING_DOWN: 'CRITICAL',
  STATIONARY: 'STATIONARY',
  OBSCURED:   'OBSCURED',
  UNKNOWN:    'STATIONARY',
}

export const CLASSIFICATION_WEIGHTS: Record<Classification, number> = {
  LYING_DOWN: 0.85,
  STATIONARY: 0.5,
  OBSCURED:   0.7,
  WAVING:     0.85,
  UNKNOWN:    0.5,
}

export function bboxToGrid(bbox: number[]): string {
  const cx = (bbox[0] + bbox[2]) / 2
  const cy = (bbox[1] + bbox[3]) / 2
  const c = Math.min(Math.floor((cx / IMG_W) * COLS.length), COLS.length - 1)
  const r = Math.min(Math.floor((cy / IMG_H) * ROWS.length), ROWS.length - 1)
  return `${COLS[c]}${ROWS[r]}`
}

export function estimateDistance(bbox: number[]): 'CLOSE' | 'MED' | 'FAR' {
  const area = (bbox[2] - bbox[0]) * (bbox[3] - bbox[1])
  if (area > 5000) return 'CLOSE'
  if (area > 1500) return 'MED'
  return 'FAR'
}

export function fmtTime(s: number): string {
  const h = Math.floor(s / 3600).toString().padStart(2, '0')
  const m = Math.floor((s % 3600) / 60).toString().padStart(2, '0')
  const sec = Math.floor(s % 60).toString().padStart(2, '0')
  return `${h}:${m}:${sec}`
}

export function recommendedAction(d: Detection): string {
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

export function parseBriefing(report: string): ParsedBriefing {
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
