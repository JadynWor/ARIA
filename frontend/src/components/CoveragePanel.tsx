import { useMemo } from 'react'
import { type Detection, COLS, ROWS, bboxToGrid } from '../utils/helpers'

function heatClass(count: number): string {
  if (count >= 6) return 'heat-high'
  if (count >= 3) return 'heat-med'
  if (count >= 1) return 'heat-low'
  return ''
}

function computeGuidance(coverage: Set<string>): { direction: string; cells: string[] } | null {
  const allCells = new Set<string>()
  for (const c of COLS) for (const r of ROWS) allCells.add(`${c}${r}`)

  const unsearched = new Set<string>()
  for (const cell of allCells) {
    if (!coverage.has(cell)) unsearched.add(cell)
  }
  if (unsearched.size === 0) return null

  const adjacent = new Set<string>()
  for (const cell of coverage) {
    const ci = COLS.indexOf(cell[0])
    const ri = ROWS.indexOf(cell.slice(1))
    const neighbors = [
      [ci - 1, ri], [ci + 1, ri], [ci, ri - 1], [ci, ri + 1],
    ]
    for (const [nc, nr] of neighbors) {
      if (nc >= 0 && nc < COLS.length && nr >= 0 && nr < ROWS.length) {
        const neighbor = `${COLS[nc]}${ROWS[nr]}`
        if (unsearched.has(neighbor)) adjacent.add(neighbor)
      }
    }
  }

  const target = adjacent.size > 0 ? adjacent : unsearched

  const dirCounts: Record<string, string[]> = { North: [], South: [], East: [], West: [] }
  for (const cell of target) {
    const ci = COLS.indexOf(cell[0])
    const ri = ROWS.indexOf(cell.slice(1))
    if (ri <= 2) dirCounts.North.push(cell)
    else if (ri >= 5) dirCounts.South.push(cell)
    if (ci <= 1) dirCounts.West.push(cell)
    else if (ci >= 3) dirCounts.East.push(cell)
  }

  let best = 'North'
  let bestCount = 0
  for (const [dir, cells] of Object.entries(dirCounts)) {
    if (cells.length > bestCount) {
      bestCount = cells.length
      best = dir
    }
  }

  const cells = dirCounts[best].slice(0, 4)
  if (cells.length === 0) {
    const first = [...target].slice(0, 4)
    return { direction: best, cells: first }
  }
  return { direction: best, cells }
}

export function CoveragePanel({
  coverage,
  detections,
  cellHeat,
  tick,
}: {
  coverage: Set<string>
  detections: Detection[]
  cellHeat: Map<string, number>
  tick: number
}) {
  const total = COLS.length * ROWS.length
  const pct = Math.round((coverage.size / total) * 100)

  const activeCells = new Set(detections.map(d => bboxToGrid(d.bbox)))
  const activeCell = activeCells.size > 0 ? [...activeCells][0] : null

  const rate = tick > 0 ? coverage.size / (tick / 60) : 0
  const remaining = rate > 0 ? (total - coverage.size) / rate : 0

  const guidance = useMemo(() => computeGuidance(coverage), [coverage])

  return (
    <section className="panel panel-coverage">
      <header className="panel-head-tight">
        <h2>Coverage</h2>
        <span className="cov-pct mono">{pct}%</span>
      </header>

      <div className="coverage-grid-wrap">
        <div className="coverage-grid-labeled">
          <div className="cov-corner" />
          {COLS.map(c => <div key={`col-${c}`} className="cov-col-label mono">{c}</div>)}
          {ROWS.flatMap(r => [
            <div key={`row-${r}`} className="cov-row-label mono">{r}</div>,
            ...COLS.map(c => {
              const cell = `${c}${r}`
              const searched = coverage.has(cell)
              const isActive = activeCells.has(cell)
              const heat = cellHeat.get(cell) ?? 0
              return (
                <div
                  key={cell}
                  className={`cov-cell ${searched ? 'searched' : ''} ${isActive ? 'latest' : ''} ${heatClass(heat)}`}
                  title={`${cell} · ${heat} detections`}
                />
              )
            }),
          ])}
        </div>

        <div className="cov-legend mono">
          <span className="cov-legend-item">
            <span className="cov-legend-dot unsearched" />
            Unsearched
          </span>
          <span className="cov-legend-item">
            <span className="cov-legend-dot searched" />
            Searched
          </span>
          <span className="cov-legend-item">
            <span className="cov-legend-dot active" />
            Active
          </span>
          <span className="cov-legend-item">
            <span className="cov-legend-dot person-found" />
            Person
          </span>
          <span className="cov-legend-item">
            <span className="cov-legend-dot critical" />
            Critical
          </span>
        </div>
      </div>

      <div className="cov-meta">
        <div className="cov-meta-row mono">
          <span className="cov-meta-key">Searched</span>
          <span className="cov-meta-val">{coverage.size}/{total}</span>
        </div>
        {activeCell && (
          <div className="cov-meta-row mono">
            <span className="cov-meta-key">Active</span>
            <span className="cov-meta-val accent">{activeCell}</span>
          </div>
        )}
        <div className="cov-meta-row mono">
          <span className="cov-meta-key">Rate</span>
          <span className="cov-meta-val">{tick > 0 ? rate.toFixed(1) : '--'} sectors/min</span>
        </div>
        <div className="cov-meta-row mono">
          <span className="cov-meta-key">Est. Complete</span>
          <span className="cov-meta-val">
            {coverage.size >= total ? 'DONE' : rate > 0 ? `${remaining.toFixed(1)}min` : '--'}
          </span>
        </div>
      </div>

      {guidance && (
        <div className="cov-guidance mono">
          <span className="cov-guidance-label">RECOMMEND</span>
          <span className="cov-guidance-text">
            Scan {guidance.direction} sectors {guidance.cells.join(', ')}
          </span>
        </div>
      )}
    </section>
  )
}
