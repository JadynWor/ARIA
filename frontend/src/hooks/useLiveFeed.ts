import { useEffect, useRef, useState } from 'react'
import { bboxToGrid, Classification, Detection, Briefing, HistoryEntry } from '../utils/helpers'

export function useLiveFeed() {
  const [connected, setConnected] = useState(false)
  const [tick, setTick] = useState(0)
  const [detections, setDetections] = useState<Detection[]>([])
  const [coverage, setCoverage] = useState<Set<string>>(new Set())
  const [briefings, setBriefings] = useState<Briefing[]>([])
  const [criticalAlert, setCriticalAlert] = useState(false)
  const [confTrends, setConfTrends] = useState<Map<number, 'up' | 'down' | 'stable'>>(new Map())
  const [cellHeat, setCellHeat] = useState<Map<string, number>>(new Map())
  const [history, setHistory] = useState<Map<number, HistoryEntry>>(new Map())

  const startRef = useRef<number>(0)
  const seenRef = useRef<Map<number, number>>(new Map())
  const cellHeatRef = useRef<Map<string, number>>(new Map())
  const historyRef = useRef<Map<number, HistoryEntry>>(new Map())
  const prevConfRef = useRef<Map<number, number>>(new Map())
  const prevLyingRef = useRef<Set<number>>(new Set())
  const criticalTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    const ws = new WebSocket('ws://localhost:8000/stream')

    ws.onopen = () => {
      setConnected(true)
      startRef.current = Date.now()
    }

    ws.onmessage = (e) => {
      const msg = JSON.parse(e.data)
      const elapsed = (Date.now() - startRef.current) / 1000

      if (msg.type === 'frame') {
        const incoming: Detection[] = (msg.detections as any[]).map((d) => {
          if (!seenRef.current.has(d.id)) seenRef.current.set(d.id, elapsed)
          const cls: Classification = (['WAVING', 'LYING_DOWN', 'STATIONARY', 'OBSCURED', 'UNKNOWN'] as const).includes(d.classification)
            ? d.classification
            : 'UNKNOWN'
          return {
            id: d.id,
            bbox: d.bbox as [number, number, number, number],
            confidence: d.confidence ?? 0,
            class_id: d.class_id ?? 0,
            classification: cls,
            priority_score: d.priority_score ?? 0,
            first_seen: seenRef.current.get(d.id)!,
          }
        })

        // Feature 7: confidence trends
        const trends = new Map<number, 'up' | 'down' | 'stable'>()
        for (const det of incoming) {
          const prev = prevConfRef.current.get(det.id)
          if (prev === undefined) {
            trends.set(det.id, 'stable')
          } else if (det.confidence > prev + 0.005) {
            trends.set(det.id, 'up')
          } else if (det.confidence < prev - 0.005) {
            trends.set(det.id, 'down')
          } else {
            trends.set(det.id, 'stable')
          }
        }
        setConfTrends(trends)

        // Update prevConfRef for next frame
        const nextConf = new Map<number, number>()
        for (const det of incoming) {
          nextConf.set(det.id, det.confidence)
        }
        prevConfRef.current = nextConf

        // Feature 1: heat map — increment cell counts
        for (const det of incoming) {
          const cell = bboxToGrid(det.bbox)
          cellHeatRef.current.set(cell, (cellHeatRef.current.get(cell) ?? 0) + 1)
        }
        setCellHeat(new Map(cellHeatRef.current))

        // Feature 3: history tracking
        const currentIds = new Set(incoming.map(d => d.id))
        for (const det of incoming) {
          historyRef.current.set(det.id, {
            id: det.id,
            lastGrid: bboxToGrid(det.bbox),
            lastSeen: elapsed,
            classification: det.classification,
          })
        }
        setHistory(new Map(historyRef.current))

        // Feature 5: critical alert — new LYING_DOWN detections
        const currentLying = new Set(incoming.filter(d => d.classification === 'LYING_DOWN').map(d => d.id))
        let hasNew = false
        for (const id of currentLying) {
          if (!prevLyingRef.current.has(id)) {
            hasNew = true
            break
          }
        }
        if (hasNew) {
          setCriticalAlert(true)
          if (criticalTimerRef.current) clearTimeout(criticalTimerRef.current)
          criticalTimerRef.current = setTimeout(() => setCriticalAlert(false), 2000)
        }
        prevLyingRef.current = currentLying

        setDetections(incoming)
      }

      if (msg.type === 'briefing') {
        setBriefings(prev => [...prev, { report: msg.report, timestamp: parseFloat(msg.timestamp) }])
      }

      if (msg.type === 'coverage') {
        setCoverage(new Set(msg.searched as string[]))
      }
    }

    ws.onclose = () => setConnected(false)
    ws.onerror = () => setConnected(false)

    return () => ws.close()
  }, [])

  useEffect(() => {
    if (!connected) return
    const id = setInterval(() => setTick((Date.now() - startRef.current) / 1000), 200)
    return () => clearInterval(id)
  }, [connected])

  return { connected, tick, detections, coverage, briefings, cellHeat, history, confTrends, criticalAlert }
}
