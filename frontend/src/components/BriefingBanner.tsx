import { useEffect, useRef, useState } from 'react'
import { type Briefing, fmtTime, parseBriefing } from '../utils/helpers'

const LANGUAGES: { code: string; full: string }[] = [
  { code: 'EN', full: 'English' },
  { code: 'ES', full: 'Spanish' },
  { code: 'FR', full: 'French' },
  { code: 'AR', full: 'Arabic' },
]

export function BriefingBanner({ briefings, tick }: { briefings: Briefing[]; tick: number }) {
  const latest = briefings[briefings.length - 1]
  const [expanded, setExpanded] = useState(true)
  const lastSeenTimestamp = useRef<number | null>(null)
  const [showNew, setShowNew] = useState(false)
  const [activeLang, setActiveLang] = useState('EN')

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

  const handleLang = (code: string, full: string) => {
    setActiveLang(code)
    fetch(`http://localhost:8000/set_language?language=${full}`, { method: 'POST' }).catch(() => {})
  }

  if (!latest) {
    return (
      <section className="briefing-banner awaiting">
        <span className="briefing-icon-pulse" />
        <span className="briefing-banner-title serif italic">Awaiting first briefing</span>
        <span className="model-badge mono">
          <span className="model-badge-dot" />
          GEMMA 4B · ON-DEVICE
        </span>
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
        <span className="model-badge mono">
          <span className="model-badge-dot" />
          GEMMA 4B · ON-DEVICE
        </span>

        <span className="lang-group" onClick={e => e.stopPropagation()}>
          {LANGUAGES.map(l => (
            <button
              key={l.code}
              className={`lang-btn mono ${activeLang === l.code ? 'active' : ''}`}
              onClick={() => handleLang(l.code, l.full)}
            >
              {l.code}
            </button>
          ))}
        </span>

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
            {parsed.rescuePlan && (
              <div className="briefing-section briefing-section-rescue">
                <div className="briefing-section-label mono">Rescue Plan</div>
                <p className="briefing-section-text serif">{parsed.rescuePlan}</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  )
}
