import { Icon } from '../lib/icons'
import { Empty } from '../components/Primitives'
import { useSharing } from '../stores/sharing'
import { useNav } from '../stores/navigation'

/**
 * Scoped honestly: this shows Tanjiro Flow peers found via the same mDNS
 * discovery that powers Nearby Devices — real, live, LAN-only. Browsing
 * arbitrary Windows network shares (any computer, not just ones running
 * this app) is a separate, much bigger piece of work and isn't here yet.
 */
export function NetworkPage() {
  const devices = useSharing((s) => s.devices)
  const nav = useNav()

  return (
    <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 16, overflow: 'auto' }}>
      <h2 style={{ fontSize: 15, margin: 0 }}>Network</h2>

      {devices.length === 0 ? (
        <Empty
          icon="network"
          title="No computers found on this network yet"
          body="Tanjiro Flow can see other computers on your network that are also running Tanjiro Flow, found live via mDNS — they’ll appear here and in Nearby Devices automatically. Browsing every computer and shared folder on a Windows network, the way File Explorer’s Network view does, is planned but not built yet."
        />
      ) : (
        <>
          <div style={{ fontSize: 11.5, color: 'var(--text-faint)' }}>
            Other computers on your network running Tanjiro Flow. Browsing every computer and
            shared folder on the network (like File Explorer’s Network view) isn’t built yet —
            this list is real, live device discovery, just scoped to this app for now.
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {devices.map((d) => (
              <button
                key={d.id}
                className="card"
                style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 14, textAlign: 'left', cursor: 'pointer' }}
                onClick={() => nav.setRoute('devices')}
              >
                <span className="icon-btn" style={{ width: 34, height: 34 }}>
                  <Icon name="devices" size={17} />
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{d.name}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-faint)' }}>{d.addresses[0] ?? d.host}</div>
                </div>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
