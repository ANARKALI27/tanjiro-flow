import { useRef } from 'react'
import { Thumb } from './Thumb'
import { KindIcon } from '../lib/icons'
import { formatBytes } from '../lib/format'
import { useVirtual } from '../hooks/useVirtual'
import type { FileEntry } from '../lib/types'
import { useSettings } from '../stores/settings'

interface Props {
  entries: FileEntry[]
  selected: Set<string>
  cutPaths: Set<string>
  onClick: (e: FileEntry, evt: React.MouseEvent) => void
  onDoubleClick: (e: FileEntry) => void
  onContextMenu: (e: FileEntry, evt: React.MouseEvent) => void
  scrollRef: React.RefObject<HTMLDivElement | null>
  dragProps: (e: FileEntry) => React.HTMLAttributes<HTMLElement>
}

/** Grid view. Virtualized by row, so a 50k-item folder stays smooth. */
export function FileGrid({
  entries,
  selected,
  cutPaths,
  onClick,
  onDoubleClick,
  onContextMenu,
  scrollRef,
  dragProps,
}: Props) {
  const cardSize = useSettings((s) => s.cardSize)
  const gap = 8
  const rowHeight = cardSize + 46
  const containerRef = useRef<HTMLDivElement>(null)

  // Columns depend on measured width; recomputed from container clientWidth.
  const width = containerRef.current?.clientWidth ?? 900
  const columns = Math.max(1, Math.floor((width - 24) / (cardSize + gap)))

  const { start, end, totalHeight, offset } = useVirtual(
    scrollRef,
    entries.length,
    rowHeight,
    columns,
  )
  const visible = entries.slice(start, end)

  return (
    <div ref={containerRef} style={{ position: 'relative', height: totalHeight }}>
      <div
        className="file-grid"
        style={{
          position: 'absolute',
          top: offset,
          left: 0,
          right: 0,
          gridTemplateColumns: `repeat(${columns}, 1fr)`,
        }}
      >
        {visible.map((entry) => (
          <button
            key={entry.path}
            className="file-card"
            data-path={entry.path}
            data-selected={selected.has(entry.path)}
            data-cut={cutPaths.has(entry.path)}
            onClick={(e) => onClick(entry, e)}
            onDoubleClick={() => onDoubleClick(entry)}
            onContextMenu={(e) => onContextMenu(entry, e)}
            {...dragProps(entry)}
          >
            <Thumb entry={entry} size={Math.round(cardSize * 0.52)} />
            <span className="file-name">{entry.name}</span>
            <span className="file-meta">
              {entry.isDir ? '' : formatBytes(entry.size)}
            </span>
          </button>
        ))}
      </div>
    </div>
  )
}

export function FileRows({
  entries,
  selected,
  cutPaths,
  onClick,
  onDoubleClick,
  onContextMenu,
  scrollRef,
  dragProps,
  details,
}: Props & { details?: boolean }) {
  const rowHeight = 34
  const { start, end, totalHeight, offset } = useVirtual(scrollRef, entries.length, rowHeight, 1)
  const visible = entries.slice(start, end)

  const cols = details
    ? 'minmax(0,1fr) 90px 110px 150px'
    : 'minmax(0,1fr)'

  return (
    <div>
      {details && (
        <div className="rows-header" style={{ gridTemplateColumns: cols }}>
          <span>Name</span>
          <span>Size</span>
          <span>Type</span>
          <span>Modified</span>
        </div>
      )}
      <div style={{ position: 'relative', height: totalHeight }}>
        <div style={{ position: 'absolute', top: offset, left: 0, right: 0 }}>
          {visible.map((entry) => (
            <button
              key={entry.path}
              className="row"
              data-path={entry.path}
              data-selected={selected.has(entry.path)}
              data-cut={cutPaths.has(entry.path)}
              style={{ gridTemplateColumns: cols }}
              onClick={(e) => onClick(entry, e)}
              onDoubleClick={() => onDoubleClick(entry)}
              onContextMenu={(e) => onContextMenu(entry, e)}
              {...dragProps(entry)}
            >
              <span className="row-name">
                <KindIcon kind={entry.kind} size={16} />
                <span>{entry.name}</span>
              </span>
              {details && (
                <>
                  <span className="row-cell">{entry.isDir ? '' : formatBytes(entry.size)}</span>
                  <span className="row-cell">{entry.isDir ? 'Folder' : entry.extension.toUpperCase() || 'File'}</span>
                  <span className="row-cell">
                    {entry.modified ? new Date(entry.modified).toLocaleDateString() : '—'}
                  </span>
                </>
              )}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
