import { useState } from 'react'
import { type MissionEvent } from '../hooks/useLiveFeed'

export function MissionLog({ events }: { events: MissionEvent[] }) {
  const [collapsed, setCollapsed] = useState(false)

  return (
    <div className="panel panel-mission-log">
      <button className="panel-head-tight mission-log-header" onClick={() => setCollapsed(c => !c)}>
        <h2>
          <span className={`chevron-sm ${collapsed ? 'right' : 'down'}`} aria-hidden>▾</span>
          Mission Log
        </h2>
        <span className="head-count mono">{events.length}</span>
      </button>

      {!collapsed && (
        <div className="mission-log-body">
          {events.length === 0 ? (
            <p className="mission-log-empty mono">Awaiting events</p>
          ) : (
            events.map(evt => (
              <div key={evt.id} className="mission-log-row mono">
                <span className="ml-time">{evt.time}</span>
                <span className="ml-text">{evt.text}</span>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  )
}
