import { type Detection, IMG_W, IMG_H, TONE } from '../utils/helpers'

export function VideoFeed({
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
