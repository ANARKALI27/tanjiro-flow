import { NotImplemented } from '../components/Primitives'

export function DownloadsPage() {
  return (
    <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>
      <h2 style={{ fontSize: 15, margin: 0 }}>Downloads</h2>
      <NotImplemented
        title="Unified download manager not connected yet"
        what="Active, Completed, Paused and Failed download lists are designed, including per-item progress, speed, remaining time, source and destination — the same activity system torrent downloads will eventually share."
        plan="This lights up once Tanjiro Flow has something to download: browser integration and the torrent engine (Phase 5) both feed into this list rather than each keeping their own."
      />
    </div>
  )
}
