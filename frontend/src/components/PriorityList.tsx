import { useMemo } from 'react'
import { type Detection, TONE, CLASS_SHORT } from '../utils/helpers'

function PriorityRow({
  d,
  selected,
  trend,
  onClick,
}: {
  d: Detection
  selected: boolean
  trend?: 'up' | 'down' | 'stable'
  onClick: () => void
}) {
  const tone = TONE[d.classification]
  return (
    <button className={`prio-row tone-${tone} ${selected ? 'selected' : ''}`} onClick={onClick}>
      <span className="prio-dot" />
      <span className="prio-id mono">#{d.id.toString().padStart(3, '0')}</span>
      <span className="prio-class mono">{CLASS_SHORT[d.classification]}</span>
      <span className="prio-conf mono">{Math.round(d.confidence * 100)}</span>
      <span className={`prio-trend mono ${trend === 'up' ? 'trend-up' : trend === 'down' ? 'trend-down' : 'trend-flat'}`}>
        {trend === 'up' ? '↑' : trend === 'down' ? '↓' : '—'}
      </span>
    </button>
  )
}

export function PriorityList({
  detections,
  selectedId,
  onSelect,
  confTrends,
}: {
  detections: Detection[]
  selectedId: number | null
  onSelect: (id: number) => void
  confTrends: Map<number, 'up' | 'down' | 'stable'>
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
                <span className="section-label mono critical-label">CRITICAL</span>
                <span className="section-line" />
              </div>
              {critical.map(d => (
                <PriorityRow key={d.id} d={d} selected={selectedId === d.id} trend={confTrends.get(d.id)} onClick={() => onSelect(d.id)} />
              ))}
            </>
          )}
          {rest.length > 0 && (
            <>
              <div className="priority-section">
                <span className="section-label mono">LOCATED</span>
                <span className="section-line" />
              </div>
              {rest.map(d => (
                <PriorityRow key={d.id} d={d} selected={selectedId === d.id} trend={confTrends.get(d.id)} onClick={() => onSelect(d.id)} />
              ))}
            </>
          )}
        </div>
      )}
    </aside>
  )
}
