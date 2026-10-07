import { Icon } from '../lib/icons'
import { NotImplemented } from '../components/Primitives'

export function TorrentsPage() {
  return (
    <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h2 style={{ fontSize: 15, margin: 0 }}>Torrents</h2>
        <button className="btn btn-primary" disabled>
          <Icon name="plus" size={15} />
          Add Torrent
        </button>
      </div>
      <NotImplemented
        title="Torrent engine not connected yet"
        what="This is the Torrent Center's UI shell — Active, Completed and Paused lists, per-torrent progress, speed, peers and controls are all designed and ready to wire up."
        plan="Phase 5 of the build plan connects this to a mature BitTorrent library (not a hand-rolled protocol implementation) so magnet links and .torrent files work for real, with bandwidth limits and a download-location setting. Nothing here is faked in the meantime."
      />
    </div>
  )
}
