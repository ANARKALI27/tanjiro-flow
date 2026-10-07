import { useEffect, useState } from 'react'
import { AnimatePresence } from 'framer-motion'
import { api } from '../lib/ipc'
import { useNav } from '../stores/navigation'
import { useSelection } from '../stores/selection'
import { useFileActions } from '../hooks/useFileActions'
import { FileGrid, FileRows } from '../components/FileGrid'
import { Empty, Spinner } from '../components/Primitives'
import { ContextMenu, type MenuEntry } from '../components/ContextMenu'
import { buildFileMenu } from '../components/FileContextMenu'
import { useSettings } from '../stores/settings'
import { useClipboard } from '../stores/clipboard'
import type { FileEntry, SearchCategory } from '../lib/types'
import { useRef } from 'react'

/**
 * A read-derived listing (Recent / Starred / a scanned category). Reuses the
 * grid/list renderers but doesn't own a folder path, so navigation always
 * routes through the real entry's own parent.
 */
export function CategoryPage({
  category,
  title,
  emptyBody,
  onShare,
  starredPaths,
}: {
  category: SearchCategory | 'starred'
  title: string
  emptyBody: string
  onShare: (entries: FileEntry[]) => void
  starredPaths?: string[]
}) {
  const [entries, setEntries] = useState<FileEntry[]>([])
  const [loading, setLoading] = useState(true)
  const nav = useNav()
  const selection = useSelection()
  const actions = useFileActions(0)
  const viewMode = useSettings((s) => s.viewMode)
  const clipboard = useClipboard()
  const scrollRef = useRef<HTMLDivElement>(null)
  const [ctx, setCtx] = useState<{ x: number; y: number; entries: FileEntry[] } | null>(null)

  useEffect(() => {
    setLoading(true)
    if (category === 'starred') {
      if (!starredPaths || starredPaths.length === 0) {
        setEntries([])
        setLoading(false)
        return
      }
      Promise.all(starredPaths.map((p) => api.entry(p).catch(() => null)))
        .then((list) => setEntries(list.filter((e): e is FileEntry => e !== null)))
        .finally(() => setLoading(false))
    } else {
      api
        .category(category, 200)
        .then(setEntries)
        .catch(() => setEntries([]))
        .finally(() => setLoading(false))
    }
  }, [category, starredPaths])

  const selected = new Set(selection.paths[0])
  const cutPaths = new Set(clipboard.mode === 'cut' ? clipboard.paths : [])

  const handleClick = (entry: FileEntry, evt: React.MouseEvent) => {
    if (evt.ctrlKey || evt.metaKey) selection.toggle(0, entry.path, entry)
    else selection.select(0, entry.path, entry)
  }
  const handleDoubleClick = (entry: FileEntry) => {
    if (entry.isDir) nav.go(entry.path)
    else void actions.open(entry)
  }
  const handleContext = (entry: FileEntry, evt: React.MouseEvent) => {
    evt.preventDefault()
    if (!selected.has(entry.path)) selection.select(0, entry.path, entry)
    setCtx({ x: evt.clientX, y: evt.clientY, entries: selected.has(entry.path) ? selection.selectedEntries(0) : [entry] })
  }
  const dragProps = () => ({})

  const menuItems: MenuEntry[] = ctx
    ? buildFileMenu(ctx.entries, actions, { onPaste: () => {}, canPaste: false, onShare })
    : []

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
      <div style={{ padding: '16px 20px 4px' }}>
        <h2 style={{ fontSize: 15, margin: 0 }}>{title}</h2>
      </div>
      <div ref={scrollRef} className="scroll-area">
        {loading ? (
          <div style={{ display: 'grid', placeItems: 'center', padding: '60px 0' }}>
            <Spinner />
          </div>
        ) : entries.length === 0 ? (
          <Empty icon="folder" title="Nothing here yet" body={emptyBody} />
        ) : viewMode === 'grid' ? (
          <FileGrid
            entries={entries}
            selected={selected}
            cutPaths={cutPaths}
            onClick={handleClick}
            onDoubleClick={handleDoubleClick}
            onContextMenu={handleContext}
            scrollRef={scrollRef}
            dragProps={dragProps}
          />
        ) : (
          <FileRows
            entries={entries}
            selected={selected}
            cutPaths={cutPaths}
            onClick={handleClick}
            onDoubleClick={handleDoubleClick}
            onContextMenu={handleContext}
            scrollRef={scrollRef}
            dragProps={dragProps}
            details={viewMode === 'details'}
          />
        )}
      </div>
      <AnimatePresence>
        {ctx && <ContextMenu x={ctx.x} y={ctx.y} items={menuItems} onClose={() => setCtx(null)} />}
      </AnimatePresence>
    </div>
  )
}
