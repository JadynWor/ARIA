import {
  type Detection, TONE, STATUS_LABEL,
  bboxToGrid, recommendedAction,
} from '../utils/helpers'

const POSTURE_DESC: Record<string, string> = {
  LYING_DOWN:  'Prone or collapsed — possible casualty',
  WAVING:      'Upright and signaling — conscious, responsive',
  STATIONARY:  'Stationary — no visible movement',
  OBSCURED:    'Partially obscured near tree line or structure',
  UNKNOWN:     'Posture indeterminate at current distance',
}

function riskReason(d: Detection, rank: number, total: number): string {
  if (d.classification === 'LYING_DOWN')
    return `Critical posture detected. Ranked #${rank} of ${total} — immediate assessment recommended.`
  if (d.classification === 'WAVING')
    return `Active signal from subject. Ranked #${rank} of ${total} — high confidence of survivorship.`
  if (rank === 1)
    return `Highest priority subject in current scan cluster. Ranked #${rank} of ${total}.`
  return `Ranked #${rank} of ${total} by confidence and classification weight.`
}

export function SubjectDetailPanel({
  detection,
  rank,
  total,
  onClose,
}: {
  detection: Detection
  rank: number
  total: number
  onClose: () => void
}) {
  const tone = TONE[detection.classification]
  const grid = bboxToGrid(detection.bbox)

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
            <dt className="mono">Sector</dt>
            <dd className="mono accent">{grid}</dd>
          </div>
          <div className="subject-field">
            <dt className="mono">Posture / Motion</dt>
            <dd className="mono">{POSTURE_DESC[detection.classification] ?? 'Unknown'}</dd>
          </div>
          <div className="subject-field">
            <dt className="mono">Last Seen</dt>
            <dd className="mono">0s ago</dd>
          </div>
        </dl>

        <div className="subject-reasoning">
          <div className="subject-reasoning-label mono">Risk Assessment</div>
          <p className="subject-reasoning-text mono">{riskReason(detection, rank, total)}</p>
        </div>

        <div className="subject-action">
          <div className="subject-action-label mono">Recommended Next Step</div>
          <p className="subject-action-text">{recommendedAction(detection)}</p>
        </div>

        <button className="subject-back mono" onClick={onClose}>← Back to coverage</button>
      </div>
    </section>
  )
}
