import { open as openFileDialog } from '@tauri-apps/plugin-dialog'
import { Icon } from '../lib/icons'
import { Empty } from '../components/Primitives'
import { useSharing, sendFilesToDevice } from '../stores/sharing'
import { dialogs } from '../stores/dialogs'
import { notify } from '../stores/notifications'
import { api } from '../lib/ipc'

export function DevicesPage() {
  const devices = useSharing((s) => s.devices)
  const self = useSharing((s) => s.self)
  const transfers = useSharing((s) => s.transfers)

  const renameSelf = async () => {
    if (!self) return
    const next = await dialogs.prompt({
      title: 'This device’s name',
      body: 'Other Tanjiro Flow devices on your network will see this name.',
      label: 'Device name',
      initial: self.name,
      confirmLabel: 'Save',
    })
    if (!next || !next.trim() || next.trim() === self.name) return
    try {
      const identity = await api.deviceSetName(next.trim())
      useSharing.setState({ self: identity })
      notify.success('Device name saved', 'Other devices will see the new name once this app restarts.')
    } catch (e) {
      notify.error('Couldn’t save that name', String(e))
    }
  }

  const sendTo = async (deviceId: string) => {
    const device = devices.find((d) => d.id === deviceId)
    if (!device) return
    const picked = await openFileDialog({ multiple: true })
    if (!picked) return
    const paths = Array.isArray(picked) ? picked : [picked]
    if (!paths.length) return
    await sendFilesToDevice(device, paths)
  }

  return (
    <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 16, overflow: 'auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h2 style={{ fontSize: 15, margin: 0 }}>Nearby Devices</h2>
      </div>

      {self && (
        <div className="card" style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 14 }}>
          <span className="icon-btn" style={{ width: 34, height: 34, background: 'var(--accent-soft)' }}>
            <Icon name="devices" size={17} />
          </span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 600 }}>{self.name}</div>
            <div style={{ fontSize: 11, color: 'var(--text-faint)' }}>
              This device · visible to others on your network
            </div>
          </div>
          <button className="btn btn-sm" onClick={renameSelf}>
            <Icon name="pencil" size={13} />
            Rename
          </button>
        </div>
      )}

      {Object.values(transfers).map((t) => (
        <div key={t.transferId} className="card" style={{ padding: 12 }}>
          <div style={{ fontSize: 12, marginBottom: 6 }}>
            {t.direction === 'send' ? 'Sending' : 'Receiving'} {t.currentFile}…
          </div>
          <div className="meter">
            <div
              className="meter-fill"
              style={{ width: `${Math.round((t.done / Math.max(1, t.total)) * 100)}%` }}
            />
          </div>
        </div>
      ))}

      {devices.length === 0 ? (
        <Empty
          icon="devices"
          title="No other Tanjiro Flow devices found yet"
          body="This is live network discovery (mDNS) — any other computer running Tanjiro Flow on the same Wi-Fi or wired network will appear here automatically within a few seconds, no setup needed."
        />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {devices.map((d) => (
            <div key={d.id} className="card" style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 14 }}>
              <span className="icon-btn" style={{ width: 34, height: 34 }}>
                <Icon name="devices" size={17} />
              </span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600 }}>{d.name}</div>
                <div style={{ fontSize: 11, color: 'var(--text-faint)' }}>
                  {d.addresses[0] ?? d.host} · online
                </div>
              </div>
              <button className="btn btn-sm btn-primary" onClick={() => sendTo(d.id)}>
                <Icon name="upload" size={13} />
                Send Files
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
