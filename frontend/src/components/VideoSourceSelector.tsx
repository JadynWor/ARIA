import { useCallback, useRef, useState } from 'react'

export function VideoSourceSelector({ onVideoReady }: { onVideoReady: () => void }) {
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const [dragOver, setDragOver] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const handleFile = useCallback(async (file: File) => {
    setError('')
    setUploading(true)
    try {
      const form = new FormData()
      form.append('file', file)
      const res = await fetch('http://localhost:8000/upload_video', { method: 'POST', body: form })
      if (!res.ok) throw new Error(`Upload failed (${res.status})`)
      onVideoReady()
    } catch (e: any) {
      setError(e.message || 'Upload failed')
      setUploading(false)
    }
  }, [onVideoReady])

  const handleDemo = useCallback(async () => {
    setError('')
    setUploading(true)
    try {
      const res = await fetch('http://localhost:8000/start_demo', { method: 'POST' })
      if (!res.ok) throw new Error(`Failed (${res.status})`)
      onVideoReady()
    } catch (e: any) {
      setError(e.message || 'Failed to start demo')
      setUploading(false)
    }
  }, [onVideoReady])

  return (
    <div className="video-selector">
      <div
        className={`video-selector-drop ${dragOver ? 'drag-over' : ''}`}
        onDragOver={e => { e.preventDefault(); setDragOver(true) }}
        onDragLeave={() => setDragOver(false)}
        onDrop={e => {
          e.preventDefault()
          setDragOver(false)
          const file = e.dataTransfer.files[0]
          if (file) handleFile(file)
        }}
        onClick={() => inputRef.current?.click()}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".mp4,video/mp4"
          style={{ display: 'none' }}
          onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f) }}
        />
        <div className="selector-icon" aria-hidden>
          <svg viewBox="0 0 48 48" width="48" height="48" fill="none">
            <rect x="6" y="10" width="36" height="28" rx="3" stroke="var(--amber)" strokeWidth="1.5" />
            <path d="M20 20l8 6-8 6z" fill="var(--amber)" opacity="0.6" />
          </svg>
        </div>
        {uploading
          ? <p className="selector-status mono">UPLOADING…</p>
          : <p className="selector-hint mono">DROP .MP4 HERE OR CLICK TO UPLOAD</p>
        }
      </div>

      <div className="selector-divider">
        <span className="selector-divider-line" />
        <span className="selector-divider-text mono">OR</span>
        <span className="selector-divider-line" />
      </div>

      <button className="selector-demo-btn mono" onClick={handleDemo} disabled={uploading}>
        USE SAMPLE DEMO
      </button>

      {error && <p className="selector-error mono">{error}</p>}
    </div>
  )
}
