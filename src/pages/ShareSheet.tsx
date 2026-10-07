import { useState } from 'react'
import { motion } from 'framer-motion'
import { Icon } from '../lib/icons'
import { pluralize } from '../lib/format'
import type { FileEntry } from '../lib/types'
import { Empty, NotImplemented } from '../components/Primitives'
import { useMotionScale } from '../hooks/useMotionScale'
import { useSharing, sendFilesToDevice } from '../stores/sharing'

const METHODS = [
  { id: 'nearby', label: 'Nearby', icon: 'devices' as const },
  { id: 'qr', label: 'QR Code', icon: 'qr' as const },
  { id: 'code', label: 'Share Code', icon: 'share' as const },
  { id: 'global', label: 'Global', icon: 'globe' as const },
]

/** Generates a share-code-shaped placeholder to show the intended UI, without
 * implying any transfer actually happens — no backend exists for this yet. */
function fakeCode(): string {
  const seg = () => Math.random().toString(36).slice(2, 6).toUpperCase()
  return `ANA-${seg()}-${seg()}`
}

export function ShareSheet({ entries, onClose }: { entries: FileEntry[]; onClose: () => void }) {
  const [method, setMethod] = useState('nearby')
  const [code] = useState(fakeCode)
  const scale = useMotionScale()

  return (
    <motion.div
      className="overlay"
      onClick={onClose}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.15 * scale }}
    >
      <motion.div
        className="dialog dialog-wide"
        onClick={(e) => e.stopPropagation()}
        initial={{ opacity: 0, scale: 0.96, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.97, y: 4 }}
        transition={{ duration: 0.18 * scale, ease: [0.16, 1, 0.3, 1] }}
      >
        <h2>Share {entries.length === 1 ? entries[0].name : pluralize(entries.length, 'item')}</h2>
        <p className="dialog-sub">Choose how you’d like to share.</p>

        <div style={{ display: 'flex', gap: 8, marginBottom: 18 }}>
          {METHODS.map((m) => (
            <button
              key={m.id}
              className="btn btn-stack"
              data-active={method === m.id}
              style={{
                flex: 1,
                height: 62,
                gap: 6,
                background: method === m.id ? 'var(--accent-soft)' : undefined,
                borderColor: method === m.id ? 'color-mix(in srgb, var(--accent) 40%, transparent)' : undefined,
              }}
              onClick={() => setMethod(m.id)}
            >
              <Icon name={m.icon} size={18} />
              <span style={{ fontSize: 11 }}>{m.label}</span>
            </button>
          ))}
        </div>

        {method === 'nearby' && <NearbyPanel entries={entries} onClose={onClose} />}

        {method === 'code' && (
          <div className="card" style={{ textAlign: 'center', padding: 22 }}>
            <div style={{ fontSize: 11, color: 'var(--text-faint)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.6 }}>
              Share Code
            </div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 22, letterSpacing: 2, marginBottom: 14 }}>
              {code}
            </div>
            <button className="btn btn-sm" disabled>
              <Icon name="copy" size={14} />
              Copy Code
            </button>
          </div>
        )}

        {method !== 'code' && method !== 'nearby' && (
          <NotImplemented
            title={`${METHODS.find((m) => m.id === method)?.label} sharing not connected yet`}
            what="This is the intended UI for this sharing method."
            plan="Nearby (LAN, mDNS-based) sharing is real and working — see that tab. A relay server or a future ANA cloud service for sharing outside the local network would plug into this same module without changing this screen."
          />
        )}

        <div className="dialog-actions">
          <button className="btn btn-primary" onClick={onClose}>
            Done
          </button>
        </div>
      </motion.div>
    </motion.div>
  )
}


function NearbyPanel({ entries, onClose }: { entries: FileEntry[]; onClose: () => void }) {
  const devices = useSharing((s) => s.devices)
  const [sending, setSending] = useState<string | null>(null)

  if (devices.length === 0) {
    return (
      <Empty
        icon="devices"
        title="No nearby devices found yet"
        body="Open Tanjiro Flow on another computer on the same network — it’ll show up here within a few seconds."
      />
    )
  }

  const send = async (deviceId: string) => {
    const device = devices.find((d) => d.id === deviceId)
    if (!device) return
    setSending(deviceId)
    await sendFilesToDevice(
      device,
      entries.map((e) => e.path),
    )
    setSending(null)
    onClose()
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 260, overflow: 'auto' }}>
      {devices.map((d) => (
        <button
          key={d.id}
          className="card"
          disabled={sending === d.id}
          style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 12, textAlign: 'left', cursor: 'pointer' }}
          onClick={() => send(d.id)}
        >
          <span className="icon-btn" style={{ width: 30, height: 30 }}>
            <Icon name="devices" size={15} />
          </span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 600 }}>{d.name}</div>
            <div style={{ fontSize: 11, color: 'var(--text-faint)' }}>{d.addresses[0] ?? d.host}</div>
          </div>
          {sending === d.id && <Icon name="refresh" size={14} />}
        </button>
      ))}
    </div>
  )
}
