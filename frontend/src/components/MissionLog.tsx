import { useMemo, useState } from 'react'
import { HistoryEntry, CLASS_SHORT } from '../utils/helpers'

export function MissionLog({
  history,
  currentIds,
  tick,
}: {
  history: Map<number, HistoryEntry>
  currentIds: Set<number>
  tick: number
}) {
  const [collapsed, setCollapsed] = useState(false)

  const departed = useMemo(() => {
    const entries: HistoryEntry[] = []
    for (const [id, entry] of history) {
      if (!currentIds.has(id)) entries.push(entry)
    }
    return entries.sort((a, b) => b.lastSeen - a.lastSeen)
  }, [history, currentIds])

  return (
    <div className="panel panel-mission-log">
      <button className="panel-head-tight mission-log-header" onClick={() => setCollapsed(c => !c)}>
        <h2>
          <span className={`chevron-sm ${collapsed ? 'right' : 'down'}`} aria-hidden>▾</span>
          Mission Log
        </h2>
        <span className="head-count mono">{departed.length}</span>
      </button>

      {!collapsed && (
        <div className="mission-log-body">
          {departed.length === 0 ? (
            <p className="mission-log-empty mono">No departed detections yet</p>
          ) : (
            departed.map(entry => {
              const ago = Math.max(0, Math.floor(tick - entry.lastSeen))
              return (
                <div key={entry.id} className="mission-log-row mono">
                  <span className="ml-id">#{entry.id.toString().padStart(3, '0')}</span>
                  <span className="ml-sep">·</span>
                  <span className="ml-grid">{entry.lastGrid}</span>
                  <span className="ml-sep">·</span>
                  <span className="ml-class">{CLASS_SHORT[entry.classification]}</span>
                  <span className="ml-sep">·</span>
                  <span className="ml-ago">left {ago}s ago</span>
                </div>
              )
            })
          )}
        </div>
      )}
    </div>
  )
}
