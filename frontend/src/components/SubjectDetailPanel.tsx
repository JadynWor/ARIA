import {
  type Detection, TONE, CLASS_LABEL, STATUS_LABEL,
  CLASSIFICATION_WEIGHTS, bboxToGrid, estimateDistance, recommendedAction,
} from '../utils/helpers'

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
  const distance = estimateDistance(detection.bbox)
  const weight = CLASSIFICATION_WEIGHTS[detection.classification]

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

        <div className="subject-reasoning">
          <div className="subject-reasoning-label mono">Why This Ranking</div>
          <p className="subject-reasoning-text mono">
            {detection.classification} (weight × {weight}) × {Math.round(detection.confidence * 100)}% = {detection.priority_score.toFixed(2)}.
            Ranked #{rank} of {total}.
          </p>
        </div>
      </div>
    </section>
  )
}
