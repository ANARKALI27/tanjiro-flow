import { useEffect, useRef, useState } from 'react'
import { assetUrl } from '../lib/ipc'
import { KindIcon } from '../lib/icons'
import type { FileEntry } from '../lib/types'

const INLINE_IMAGE = new Set(['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg', 'avif', 'ico'])
const INLINE_VIDEO = new Set(['mp4', 'webm', 'm4v'])

function GalleryTile({
  entry,
  selected,
  onClick,
  onDoubleClick,
  onContextMenu,
}: {
  entry: FileEntry
  selected: boolean
  onClick: (e: React.MouseEvent) => void
  onDoubleClick: () => void
  onContextMenu: (e: React.MouseEvent) => void
}) {
  const ref = useRef<HTMLButtonElement>(null)
  const [visible, setVisible] = useState(false)
  const [failed, setFailed] = useState(false)

  const isImage = INLINE_IMAGE.has(entry.extension)
  const isVideo = INLINE_VIDEO.has(entry.extension)

  useEffect(() => {
    const el = ref.current
    if (!el || visible) return
    const io = new IntersectionObserver(
      (items) => {
        if (items.some((i) => i.isIntersecting)) {
          setVisible(true)
          io.disconnect()
        }
      },
      { rootMargin: '400px' },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [visible])

  return (
    <button
      ref={ref}
      className="gallery-item"
      data-selected={selected}
      onClick={onClick}
      onDoubleClick={onDoubleClick}
      onContextMenu={onContextMenu}
    >
      {visible && isImage && !failed ? (
        <img src={assetUrl(entry.path)} alt="" loading="lazy" onError={() => setFailed(true)} />
      ) : visible && isVideo && !failed ? (
        <video src={assetUrl(entry.path)} muted preload="metadata" onError={() => setFailed(true)} />
      ) : (
        <div className="gallery-fallback">
          <KindIcon kind={entry.kind} size={32} />
        </div>
      )}
      <span className="gallery-cap">{entry.name}</span>
    </button>
  )
}

export function GalleryView({
  entries,
  selected,
  onClick,
  onDoubleClick,
  onContextMenu,
}: {
  entries: FileEntry[]
  selected: Set<string>
  onClick: (e: FileEntry, evt: React.MouseEvent) => void
  onDoubleClick: (e: FileEntry) => void
  onContextMenu: (e: FileEntry, evt: React.MouseEvent) => void
}) {
  return (
    <div className="gallery-grid">
      {entries.map((entry) => (
        <GalleryTile
          key={entry.path}
          entry={entry}
          selected={selected.has(entry.path)}
          onClick={(evt) => onClick(entry, evt)}
          onDoubleClick={() => onDoubleClick(entry)}
          onContextMenu={(evt) => onContextMenu(entry, evt)}
        />
      ))}
    </div>
  )
}
