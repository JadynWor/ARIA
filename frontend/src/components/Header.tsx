import { fmtTime } from '../utils/helpers'
import { ThemeToggle } from './ThemeToggle'
import { useTheme } from '../hooks/useTheme'

export function Header({ connected, tick, onChangeVideo }: { connected: boolean; tick: number; onChangeVideo?: () => void }) {
  const { theme, toggle } = useTheme()

  return (
    <header className="aria-header">
      <div className="header-brand">
        <div className="logo-mark" aria-hidden>
          <svg viewBox="0 0 32 32" width="28" height="28" fill="none">
            <path d="M6 27 L16 5 L26 27" stroke="var(--logo-stroke)" strokeWidth="2.2" strokeLinecap="square" strokeLinejoin="miter" />
            <line x1="11" y1="19" x2="21" y2="19" stroke="var(--logo-stroke)" strokeWidth="1.6" />
            <line x1="12.5" y1="22" x2="19.5" y2="22" stroke="var(--logo-stroke)" strokeWidth="1.2" opacity="0.55" />
            <circle cx="16" cy="14.5" r="1.6" fill="var(--amber-hot)" />
          </svg>
        </div>
        <div className="brand-text">
          <h1>ARIA</h1>
          <p>Aerial Rescue Intelligence &amp; Analysis</p>
        </div>
      </div>

      <div className="header-mission">
        <span className="mission-label mono">Mission</span>
        <span className="mission-name mono">Active Scan · Grid Alpha · Local Processing</span>
      </div>

      <div className="header-right">
        {onChangeVideo && (
          <button className="change-video-btn mono" onClick={onChangeVideo}>CHANGE VIDEO</button>
        )}
        <ThemeToggle theme={theme} onToggle={toggle} />
        <div className={`live ${connected ? 'on' : 'off'}`}>
          <span className="live-dot" />
          <span className="live-label">{connected ? 'LIVE' : 'CONNECTING'}</span>
        </div>
        <span className="timer mono">T+{fmtTime(tick)}</span>
      </div>
    </header>
  )
}
