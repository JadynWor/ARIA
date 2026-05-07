import { fmtTime } from '../utils/helpers'

export function Header({ connected, tick, onChangeVideo }: { connected: boolean; tick: number; onChangeVideo?: () => void }) {
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
