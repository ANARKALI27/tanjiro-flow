import { useEffect, useState } from 'react'
import { api } from '../lib/ipc'
import { Icon, type IconName } from '../lib/icons'
import { formatBytes, pluralize } from '../lib/format'
import { useNav } from '../stores/navigation'
import { useSystemPlaces } from '../hooks/useDrives'
import { Meter } from '../components/Primitives'
import type { SearchCategory } from '../lib/types'

interface CardDef {
  category: SearchCategory
  title: string
  desc: string
  icon: IconName
  tint: string
}

const CARDS: CardDef[] = [
  { category: 'recent', title: 'Recent Files', desc: 'See what you opened', icon: 'clock', tint: 'var(--accent)' },
  { category: 'large', title: 'Large Files', desc: 'Files over 100 MB', icon: 'disk', tint: 'var(--warn)' },
  { category: 'images', title: 'Images', desc: 'All your pictures', icon: 'image', tint: '#ff7ab8' },
  { category: 'videos', title: 'Videos', desc: 'All your videos', icon: 'video', tint: '#b07cff' },
  { category: 'applications', title: 'Applications', desc: 'Apps & installers', icon: 'application', tint: '#8f9bff' },
]

function QuickCard({ card }: { card: CardDef }) {
  const [count, setCount] = useState<number | null>(null)
  const setRoute = useNav((s) => s.setRoute)

  useEffect(() => {
    let cancelled = false
    api
      .category(card.category, 400)
      .then((entries) => !cancelled && setCount(entries.length))
      .catch(() => !cancelled && setCount(null))
    return () => {
      cancelled = true
    }
  }, [card.category])

  return (
    <button
      className="quick-card"
      style={{ ['--tint' as string]: card.tint }}
      onClick={() => {
        setRoute('recent')
      }}
    >
      <span className="quick-icon">
        <Icon name={card.icon} size={17} />
      </span>
      <div>
        <div className="quick-name">{card.title}</div>
        <div className="quick-desc">{card.desc}</div>
      </div>
      <div className="quick-stat">
        {count === null ? 'Scanning…' : pluralize(count, 'item')}
        {count === 400 ? '+' : ''}
      </div>
    </button>
  )
}

export function HomePage() {
  const { drives } = useSystemPlaces()
  const nav = useNav()
  const readyDrives = drives.filter((d) => d.ready)
  const totalUsed = readyDrives.reduce((s, d) => s + d.usedBytes, 0)
  const totalCapacity = readyDrives.reduce((s, d) => s + d.totalBytes, 0)

  return (
    <div style={{ padding: '18px 20px 30px', display: 'flex', flexDirection: 'column', gap: 22 }}>
      <section>
        <h2 style={{ fontSize: 15, margin: '0 0 3px' }}>Welcome back</h2>
        <p style={{ fontSize: 12.5, color: 'var(--text-dim)', margin: 0 }}>
          {readyDrives.length > 0
            ? `${formatBytes(totalCapacity - totalUsed)} free across ${pluralize(readyDrives.length, 'drive')}`
            : 'Loading your drives…'}
        </p>
      </section>

      <section>
        <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: 0.6, color: 'var(--text-faint)', marginBottom: 10, textTransform: 'uppercase' }}>
          Quick Access
        </div>
        <div className="quick-grid">
          {CARDS.map((c) => (
            <QuickCard key={c.category} card={c} />
          ))}
        </div>
      </section>

      <section>
        <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: 0.6, color: 'var(--text-faint)', marginBottom: 10, textTransform: 'uppercase' }}>
          Drives
        </div>
        <div className="drive-grid">
          {drives.map((d) => (
            <button
              key={d.letter}
              className="drive-card"
              data-ready={d.ready}
              onClick={() => d.ready && nav.go(d.path)}
              disabled={!d.ready}
            >
              <div className="drive-head">
                <Icon name="drive" size={20} />
                <div>
                  <div className="drive-name">
                    {d.label} ({d.letter})
                  </div>
                  <div className="drive-letter">{d.filesystem || (d.ready ? '' : 'Not ready')}</div>
                </div>
              </div>
              {d.ready && (
                <>
                  <Meter ratio={d.totalBytes ? d.usedBytes / d.totalBytes : 0} />
                  <div className="drive-figures">
                    <span>{formatBytes(d.freeBytes)} free</span>
                    <span>{formatBytes(d.totalBytes)} total</span>
                  </div>
                </>
              )}
            </button>
          ))}
        </div>
      </section>
    </div>
  )
}
