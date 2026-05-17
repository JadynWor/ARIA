import { useEffect, useMemo, useState } from 'react'
import './App.css'
import { type VideoMode } from './utils/helpers'
import { useLiveFeed } from './hooks/useLiveFeed'
import { Header } from './components/Header'
import { VideoFeed } from './components/VideoFeed'
import { VideoSourceSelector } from './components/VideoSourceSelector'
import { PriorityList } from './components/PriorityList'
import { CoveragePanel } from './components/CoveragePanel'
import { SubjectDetailPanel } from './components/SubjectDetailPanel'
import { BriefingBanner } from './components/BriefingBanner'
import { FooterStrip } from './components/FooterStrip'
import { MissionLog } from './components/MissionLog'

export default function App() {
  const {
    connected, tick, detections, coverage, briefings,
    cellHeat, confTrends, criticalAlert, events,
  } = useLiveFeed()

  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [videoMode, setVideoMode] = useState<VideoMode>('selecting')

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get('autostart') === 'true') {
      fetch('http://localhost:8000/start_demo', { method: 'POST' })
        .then(() => setVideoMode('streaming'))
        .catch(() => {})
    }
  }, [])

  useEffect(() => {
    if (selectedId !== null && !detections.find(d => d.id === selectedId)) {
      setSelectedId(null)
    }
  }, [detections, selectedId])

  // Sync selectedId to backend for two-tier label rendering
  useEffect(() => {
    const url = selectedId !== null
      ? `http://localhost:8000/set_selected?id=${selectedId}`
      : 'http://localhost:8000/set_selected'
    fetch(url, { method: 'POST' }).catch(() => {})
  }, [selectedId])

  const selected = selectedId !== null
    ? detections.find(d => d.id === selectedId) ?? null
    : null

  const sorted = useMemo(
    () => [...detections].sort((a, b) => b.priority_score - a.priority_score),
    [detections],
  )
  const rank = selected ? sorted.findIndex(d => d.id === selected.id) + 1 : 0

  return (
    <div className={`aria-app ${criticalAlert ? 'critical-flash' : ''}`}>
      <Header connected={connected} tick={tick} />

      <main className="aria-main">
        <div className="left-column">
          <PriorityList
            detections={detections}
            selectedId={selectedId}
            onSelect={(id) => setSelectedId(prev => prev === id ? null : id)}
            confTrends={confTrends}
          />
          <MissionLog events={events} />
        </div>

        {videoMode === 'selecting'
          ? <VideoSourceSelector onVideoReady={() => setVideoMode('streaming')} />
          : <VideoFeed
              detections={detections}
              selectedId={selectedId}
              onClickAway={() => setSelectedId(null)}
            />
        }
        {selected
          ? <SubjectDetailPanel detection={selected} rank={rank} total={sorted.length} onClose={() => setSelectedId(null)} />
          : <CoveragePanel coverage={coverage} detections={detections} cellHeat={cellHeat} tick={tick} />}
      </main>

      <BriefingBanner briefings={briefings} tick={tick} />

      <FooterStrip />
    </div>
  )
}
