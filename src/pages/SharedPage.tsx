import { Icon } from '../lib/icons'
import { Empty } from '../components/Primitives'
import { useSharing } from '../stores/sharing'
import { api } from '../lib/ipc'
import { formatBytes, formatRelative } from '../lib/format'
import { notify } from '../stores/notifications'

export function SharedPage() {
  const received = useSharing((s) => s.received)

  const openFolder = async () => {
    try {
      await api.sharedOpenFolder()
    } catch (e) {
      notify.error('Couldn’t open that folder', String(e))
    }
  }

  const openFile = async (path: string) => {
    try {
      await api.open(path)
    } catch (e) {
      notify.error('Couldn’t open that file', String(e))
    }
  }

  return (
    <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 16, overflow: 'auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h2 style={{ fontSize: 15, margin: 0 }}>Shared With Me</h2>
        <button className="btn btn-sm" onClick={openFolder}>
          <Icon name="folder" size={13} />
          Open Folder
        </button>
      </div>

      {received.length === 0 ? (
        <Empty
          icon="download"
          title="Nothing shared with you yet"
          body="Files another Tanjiro Flow device on your network sends you land here — and in your Downloads, in a “Tanjiro Flow Shares” folder — the moment you accept them."
        />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {received.map((item) => (
            <button
              key={`${item.path}-${item.receivedAt}`}
              className="card"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                padding: 12,
                textAlign: 'left',
                cursor: 'pointer',
              }}
              onClick={() => openFile(item.path)}
            >
              <span className="icon-btn" style={{ width: 30, height: 30 }}>
                <Icon name="file" size={15} />
              </span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {item.name}
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-faint)' }}>
                  From {item.fromName} · {formatBytes(item.size)} · {formatRelative(item.receivedAt)}
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
