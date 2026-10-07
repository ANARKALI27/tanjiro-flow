import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence } from 'framer-motion'
import { useDirectory } from '../hooks/useDirectory'
import { useFileActions } from '../hooks/useFileActions'
import { useHotkeys } from '../hooks/useHotkeys'
import { useNav } from '../stores/navigation'
import { useSelection } from '../stores/selection'
import { useSettings } from '../stores/settings'
import { useClipboard } from '../stores/clipboard'
import { FileGrid, FileRows } from './FileGrid'
import { GalleryView } from './GalleryView'
import { ContextMenu, type MenuEntry } from './ContextMenu'
import { Toolbar } from './Toolbar'
import { buildFileMenu } from './FileContextMenu'
import { Empty, Spinner } from './Primitives'
import { notify } from '../stores/notifications'
import { runTransfer } from '../lib/transfer'
import type { FileEntry } from '../lib/types'

interface CtxState {
  x: number
  y: number
  entries: FileEntry[]
}

interface MarqueeRect {
  x: number
  y: number
  w: number
  h: number
}

interface DragSelectState {
  startX: number
  startY: number
  additive: boolean
  baseEntries: FileEntry[]
  dragging: boolean
}

/** Below this many pixels of movement, a mousedown-then-mouseup on empty
 * space is a click (deselect), not the start of a rubber-band drag. */
const DRAG_THRESHOLD = 4

/**
 * The central file browser for one pane. Owns selection interaction, drag and
 * drop, the keyboard shortcut set from the spec, and dispatch to whichever
 * view mode is active.
 */
export function FileBrowser({
  pane = 0,
  onShare,
}: {
  pane?: 0 | 1
  onShare: (entries: FileEntry[]) => void
}) {
  const nav = useNav()
  const path = nav.panes[pane].path
  const { entries, loading, error, unreadable, reload } = useDirectory(path)
  const selection = useSelection()
  const clipboard = useClipboard()
  const actions = useFileActions(pane)
  const viewMode = useSettings((s) => s.viewMode)
  const isActive = nav.active === pane

  const scrollRef = useRef<HTMLDivElement>(null)
  const [ctx, setCtx] = useState<CtxState | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const [marqueeRect, setMarqueeRect] = useState<MarqueeRect | null>(null)

  const selected = new Set(selection.paths[pane])
  const cutPaths = new Set(clipboard.mode === 'cut' ? clipboard.paths : [])
  const orderedRef = useRef<FileEntry[]>(entries)
  orderedRef.current = entries

  const pathMap = useMemo(() => {
    const m = new Map<string, FileEntry>()
    for (const e of entries) m.set(e.path, e)
    return m
  }, [entries])

  const dragSelectRef = useRef<DragSelectState | null>(null)
  // Set right after a rubber-band drag finishes, so the synthetic click that
  // follows mouseup on the same element doesn't immediately wipe out the
  // selection the drag just made.
  const suppressNextClickRef = useRef(false)

  const focusPane = useCallback(() => {
    if (!isActive) nav.setActive(pane)
  }, [isActive, nav, pane])

  // The actual "select this entry" logic, shared by the normal click path
  // and the pointer-based fallback below.
  const applySelectionClick = useCallback(
    (entry: FileEntry, evt: { shiftKey: boolean; ctrlKey: boolean; metaKey: boolean }) => {
      focusPane()
      if (evt.shiftKey) {
        selection.selectRange(pane, orderedRef.current, entry.path)
      } else if (evt.ctrlKey || evt.metaKey) {
        selection.toggle(pane, entry.path, entry)
      } else {
        selection.select(pane, entry.path, entry)
      }
    },
    [focusPane, pane, selection],
  )

  // Cards are draggable=true (for drag-and-drop), and browsers that decide a
  // press-then-tiny-move is the start of a drag gesture will silently swallow
  // the click event that would otherwise follow — the tile never gets
  // selected even though nothing visibly dragged. handleCardPointerUp below
  // is a fallback that fires selection itself whenever a press+release pair
  // stayed within a few pixels (i.e. it was a click, not a drag), and
  // pointerHandledRef stops the native click — when it does still arrive —
  // from applying the same selection a second time.
  const pointerHandledRef = useRef(false)

  const handleClick = useCallback(
    (entry: FileEntry, evt: React.MouseEvent) => {
      if (pointerHandledRef.current) {
        pointerHandledRef.current = false
        return
      }
      applySelectionClick(entry, evt)
    },
    [applySelectionClick],
  )

  const pointerDownPosRef = useRef<{ x: number; y: number } | null>(null)

  const handleCardPointerDown = useCallback((evt: React.PointerEvent) => {
    if (evt.button !== 0) return
    pointerDownPosRef.current = { x: evt.clientX, y: evt.clientY }
  }, [])

  const handleCardPointerUp = useCallback(
    (entry: FileEntry, evt: React.PointerEvent) => {
      const start = pointerDownPosRef.current
      pointerDownPosRef.current = null
      if (!start || evt.button !== 0) return
      const moved = Math.hypot(evt.clientX - start.x, evt.clientY - start.y)
      if (moved > 4) return
      pointerHandledRef.current = true
      applySelectionClick(entry, evt)
    },
    [applySelectionClick],
  )

  const handleDoubleClick = useCallback(
    (entry: FileEntry) => {
      focusPane()
      actions.open(entry)
    },
    [actions, focusPane],
  )

  const handleContext = useCallback(
    (entry: FileEntry, evt: React.MouseEvent) => {
      evt.preventDefault()
      focusPane()
      if (!selected.has(entry.path)) {
        selection.select(pane, entry.path, entry)
        setCtx({ x: evt.clientX, y: evt.clientY, entries: [entry] })
      } else {
        setCtx({ x: evt.clientX, y: evt.clientY, entries: selection.selectedEntries(pane) })
      }
    },
    [focusPane, pane, selected, selection],
  )

  // The virtualized grid/list wraps its rows in nested, absolutely-positioned
  // divs, so `evt.target === evt.currentTarget` almost never holds even for a
  // genuine background click — it only matched the scroll-area itself. Using
  // closest() to check whether the click landed on (or inside) an actual file
  // tile is what makes "background" mean the same thing everywhere: it's
  // background unless it's on a card/row, regardless of which wrapper div the
  // click bubbled through.
  const isBackgroundTarget = (evt: React.MouseEvent) =>
    !(evt.target as HTMLElement).closest('.file-card, .row')

  const handleBackgroundContext = useCallback(
    (evt: React.MouseEvent) => {
      if (!isBackgroundTarget(evt)) return
      evt.preventDefault()
      focusPane()
      selection.clear(pane)
      setCtx({ x: evt.clientX, y: evt.clientY, entries: [] })
    },
    [focusPane, pane, selection],
  )

  const handleBackgroundClick = useCallback(
    (evt: React.MouseEvent) => {
      if (suppressNextClickRef.current) {
        suppressNextClickRef.current = false
        return
      }
      if (isBackgroundTarget(evt)) {
        focusPane()
        selection.clear(pane)
      }
    },
    [focusPane, pane, selection],
  )

  // --- rubber-band drag-select ---------------------------------------------

  const hitTestMarquee = useCallback(
    (rect: MarqueeRect): FileEntry[] => {
      const root = scrollRef.current
      if (!root) return []
      const hits: FileEntry[] = []
      const left = rect.x
      const top = rect.y
      const right = rect.x + rect.w
      const bottom = rect.y + rect.h
      const nodes = root.querySelectorAll<HTMLElement>('[data-path]')
      nodes.forEach((node) => {
        const b = node.getBoundingClientRect()
        const intersects = b.left < right && b.right > left && b.top < bottom && b.bottom > top
        if (!intersects) return
        const path = node.getAttribute('data-path')
        const entry = path ? pathMap.get(path) : undefined
        if (entry) hits.push(entry)
      })
      return hits
    },
    [pathMap],
  )

  const updateDragSelection = useCallback(
    (clientX: number, clientY: number) => {
      const drag = dragSelectRef.current
      if (!drag) return
      const x = Math.min(drag.startX, clientX)
      const y = Math.min(drag.startY, clientY)
      const w = Math.abs(clientX - drag.startX)
      const h = Math.abs(clientY - drag.startY)

      if (!drag.dragging) {
        if (w < DRAG_THRESHOLD && h < DRAG_THRESHOLD) return
        drag.dragging = true
      }

      setMarqueeRect({ x, y, w, h })
      const hits = hitTestMarquee({ x, y, w, h })
      if (drag.additive) {
        const merged = new Map<string, FileEntry>()
        for (const e of drag.baseEntries) merged.set(e.path, e)
        for (const e of hits) merged.set(e.path, e)
        selection.selectMany(pane, [...merged.values()])
      } else {
        selection.selectMany(pane, hits)
      }
    },
    [hitTestMarquee, pane, selection],
  )

  // The window listeners live for the duration of one drag and need a stable
  // function identity to add/remove correctly, but their behavior depends on
  // callbacks that change every render (updateDragSelection closes over
  // fresh selection/pane state). Routing both through refs lets the actual
  // addEventListener target be a single stable wrapper while still always
  // calling the latest logic.
  const onMoveRef = useRef<(evt: MouseEvent) => void>(() => {})
  const onUpRef = useRef<() => void>(() => {})

  onMoveRef.current = (evt: MouseEvent) => updateDragSelection(evt.clientX, evt.clientY)
  onUpRef.current = () => {
    const drag = dragSelectRef.current
    dragSelectRef.current = null
    window.removeEventListener('mousemove', stableMouseMove)
    window.removeEventListener('mouseup', stableMouseUp)
    setMarqueeRect(null)
    if (drag?.dragging) suppressNextClickRef.current = true
  }

  const stableMouseMoveRef = useRef((evt: MouseEvent) => onMoveRef.current(evt))
  const stableMouseUpRef = useRef(() => onUpRef.current())
  const stableMouseMove = stableMouseMoveRef.current
  const stableMouseUp = stableMouseUpRef.current

  const handlePaneMouseDown = useCallback(
    (evt: React.MouseEvent) => {
      // Only the primary button starts a rubber band, and only when the
      // press begins on empty space — a card/row's own handlers (click, drag
      // reorder, context menu) own presses that start on a tile.
      if (evt.button !== 0 || !isBackgroundTarget(evt)) return
      focusPane()
      dragSelectRef.current = {
        startX: evt.clientX,
        startY: evt.clientY,
        additive: evt.ctrlKey || evt.metaKey || evt.shiftKey,
        baseEntries: evt.ctrlKey || evt.metaKey || evt.shiftKey ? selection.selectedEntries(pane) : [],
        dragging: false,
      }
      window.addEventListener('mousemove', stableMouseMove)
      window.addEventListener('mouseup', stableMouseUp)
    },
    [focusPane, pane, selection, stableMouseMove, stableMouseUp],
  )

  // Belt-and-suspenders: if the pane unmounts mid-drag (folder closed, panel
  // toggled off) the window listeners would otherwise leak.
  useEffect(() => {
    return () => {
      window.removeEventListener('mousemove', stableMouseMove)
      window.removeEventListener('mouseup', stableMouseUp)
    }
  }, [stableMouseMove, stableMouseUp])

  // --- drag and drop -------------------------------------------------------

  const dragProps = useCallback(
    (entry: FileEntry): React.HTMLAttributes<HTMLElement> => ({
      draggable: true,
      onPointerDown: handleCardPointerDown,
      onPointerUp: (evt: React.PointerEvent) => handleCardPointerUp(entry, evt),
      onDragStart: (evt: React.DragEvent) => {
        const dragging = selected.has(entry.path) ? selection.selectedEntries(pane) : [entry]
        evt.dataTransfer.setData('application/x-tanjiro-flow-paths', JSON.stringify(dragging.map((e) => e.path)))
        evt.dataTransfer.effectAllowed = 'copyMove'
        // The browser's default drag image is just this one tile, which
        // misleads when several files are actually being carried — show a
        // small "N items" badge instead. The element only needs to exist for
        // the instant the browser snapshots it, so it's created, used, and
        // torn down within the same tick.
        if (dragging.length > 1) {
          const badge = document.createElement('div')
          badge.className = 'drag-badge'
          badge.textContent = `${dragging.length} items`
          document.body.appendChild(badge)
          evt.dataTransfer.setDragImage(badge, -12, -12)
          window.setTimeout(() => badge.remove(), 0)
        }
      },
      onDragOver: entry.isDir
        ? (evt: React.DragEvent) => {
            evt.preventDefault()
            evt.dataTransfer.dropEffect = evt.ctrlKey ? 'copy' : 'move'
          }
        : undefined,
      onDrop: entry.isDir
        ? async (evt: React.DragEvent) => {
            evt.preventDefault()
            const internal = evt.dataTransfer.getData('application/x-tanjiro-flow-paths')
            if (internal) {
              const paths: string[] = JSON.parse(internal)
              if (paths.includes(entry.path)) return
              try {
                if (evt.ctrlKey) await runTransfer('copy', paths, entry.path)
                else await runTransfer('move', paths, entry.path)
                reload()
              } catch (e) {
                notify.error('Couldn’t complete the drop', (e as { message?: string })?.message)
              }
              return
            }
            // External files dropped from Windows Explorer.
            const files = Array.from(evt.dataTransfer.files) as (File & { path?: string })[]
            const paths = files.map((f) => f.path).filter(Boolean) as string[]
            if (paths.length) {
              try {
                await runTransfer('copy', paths, entry.path)
                reload()
              } catch (e) {
                notify.error('Couldn’t copy dropped files', (e as { message?: string })?.message)
              }
            }
          }
        : undefined,
    }),
    [pane, reload, selected, selection, handleCardPointerDown, handleCardPointerUp],
  )

  const onPaneDragOver = useCallback((evt: React.DragEvent) => {
    evt.preventDefault()
    // Without this the browser defaults to a "not-allowed" cursor for the
    // whole drag even though the drop is accepted — set it explicitly so
    // the cursor matches what actually happens on drop.
    evt.dataTransfer.dropEffect = evt.ctrlKey ? 'copy' : 'move'
    setDragOver(true)
  }, [])
  const onPaneDragLeave = useCallback(() => setDragOver(false), [])
  // Dropping onto the pane's own empty background (not onto a specific
  // folder tile) is how a multi-selection gets moved/copied into *this*
  // pane's current directory — the everyday case in dual-pane mode: drag a
  // selection from the left pane, drop anywhere on the right. Per-entry
  // `dragProps` below only fires when the drop lands on a folder tile, so
  // this background handler is what makes an empty-space drop do anything
  // at all for an in-app (not OS Explorer) drag.
  const onPaneDrop = useCallback(
    async (evt: React.DragEvent) => {
      evt.preventDefault()
      setDragOver(false)
      if (!path) return

      const internal = evt.dataTransfer.getData('application/x-tanjiro-flow-paths')
      if (internal) {
        const paths: string[] = JSON.parse(internal)
        // Dropped back into the folder it already lives in — a no-op, not
        // an error worth surfacing.
        if (paths.every((p) => p.replace(/\\/g, '/').replace(/\/[^/]+$/, '') === path.replace(/\\/g, '/'))) {
          return
        }
        try {
          const outcome = evt.ctrlKey ? await runTransfer('copy', paths, path) : await runTransfer('move', paths, path)
          reload()
          notify.success(
            `${evt.ctrlKey ? 'Copied' : 'Moved'} ${outcome.succeeded.length === 1 ? '1 item' : `${outcome.succeeded.length} items`}`,
          )
        } catch (e) {
          notify.error('Couldn’t complete the drop', (e as { message?: string })?.message)
        }
        return
      }

      // External files dropped from Windows Explorer.
      const files = Array.from(evt.dataTransfer.files) as (File & { path?: string })[]
      const paths = files.map((f) => f.path).filter(Boolean) as string[]
      if (!paths.length) return
      try {
        const outcome = await runTransfer('copy', paths, path)
        reload()
        notify.success(`Copied ${outcome.succeeded.length === 1 ? '1 item' : `${outcome.succeeded.length} items`}`)
      } catch (e) {
        notify.error('Couldn’t copy dropped files', (e as { message?: string })?.message)
      }
    },
    [path, reload],
  )

  // --- keyboard --------------------------------------------------------

  useHotkeys(
    {
      'ctrl+c': () => actions.copy(selection.selectedEntries(pane)),
      'ctrl+x': () => actions.cut(selection.selectedEntries(pane)),
      'ctrl+v': () => actions.paste(),
      'ctrl+a': () => selection.selectAll(pane, entries),
      f2: () => {
        const sel = selection.selectedEntries(pane)
        if (sel.length === 1) actions.rename(sel[0])
      },
      delete: () => actions.remove(selection.selectedEntries(pane)),
      'shift+delete': () => actions.remove(selection.selectedEntries(pane), true),
      enter: () => {
        const sel = selection.selectedEntries(pane)
        if (sel.length === 1) actions.open(sel[0])
      },
      'alt+enter': () => actions.showProperties(selection.selectedEntries(pane)),
      backspace: () => nav.up(pane),
      f5: () => reload(),
      'ctrl+shift+n': () => actions.newFolder(),
      escape: () => {
        selection.clear(pane)
        setCtx(null)
      },
    },
    isActive,
  )

  if (!path) {
    return (
      <div className="pane" data-focused={isActive} style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }} onClick={focusPane}>
        <Toolbar pane={pane} />
        <div className="scroll-area" onClick={handleBackgroundClick}>
          <Empty
            icon="folder"
            title="No folder open"
            body="Pick a place from the sidebar to start browsing."
          />
        </div>
      </div>
    )
  }

  const menuItems: MenuEntry[] = ctx
    ? buildFileMenu(ctx.entries, actions, {
        onPaste: actions.paste,
        canPaste: actions.canPaste,
        onShare,
      })
    : []

  return (
    <div
      className="pane"
      data-focused={isActive}
      style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}
      onClick={focusPane}
    >
      <Toolbar pane={pane} />
      <div
        ref={scrollRef}
        className="scroll-area"
        onClick={handleBackgroundClick}
        onContextMenu={handleBackgroundContext}
        onMouseDown={handlePaneMouseDown}
        onDragOver={onPaneDragOver}
        onDragLeave={onPaneDragLeave}
        onDrop={onPaneDrop}
        style={{
          outline: dragOver ? '2px dashed var(--accent)' : 'none',
          outlineOffset: -2,
        }}
      >
        {loading && entries.length === 0 ? (
          <div style={{ display: 'grid', placeItems: 'center', padding: '60px 0' }}>
            <Spinner />
          </div>
        ) : error ? (
          <Empty
            icon="alert"
            title={error.kind === 'AccessDenied' ? 'Access denied' : 'Couldn’t open this folder'}
            body={error.message}
            action={
              <button className="btn btn-sm" onClick={reload}>
                Retry
              </button>
            }
          />
        ) : entries.length === 0 ? (
          <Empty icon="folder" title="This folder is empty" />
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
        ) : viewMode === 'gallery' ? (
          <GalleryView
            entries={entries}
            selected={selected}
            onClick={handleClick}
            onDoubleClick={handleDoubleClick}
            onContextMenu={handleContext}
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

      <div className="status-bar">
        <span>{entries.length.toLocaleString()} items</span>
        {selected.size > 0 && <span>{selected.size.toLocaleString()} selected</span>}
        {unreadable > 0 && <span>{unreadable} couldn’t be read</span>}
      </div>

      {marqueeRect && (
        <div
          className="marquee"
          style={{
            left: marqueeRect.x,
            top: marqueeRect.y,
            width: marqueeRect.w,
            height: marqueeRect.h,
          }}
        />
      )}

      <AnimatePresence>
        {ctx && (
          <ContextMenu x={ctx.x} y={ctx.y} items={menuItems} onClose={() => setCtx(null)} />
        )}
      </AnimatePresence>
    </div>
  )
}
