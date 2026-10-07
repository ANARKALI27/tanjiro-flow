import { useEffect, useMemo, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { api } from '../lib/ipc'
import { Icon, KindIcon, type IconName } from '../lib/icons'
import { useNav, type RouteId } from '../stores/navigation'
import { useSystemPlaces } from '../hooks/useDrives'
import { useFileActions } from '../hooks/useFileActions'
import { useSelection } from '../stores/selection'
import { useWorkspaces } from '../stores/workspaces'
import { useMotionScale } from '../hooks/useMotionScale'
import type { FileEntry } from '../lib/types'

interface Result {
  id: string
  group: string
  label: string
  sub?: string
  icon: IconName
  fileKind?: FileEntry['kind']
  run: () => void
}

const ROUTE_RESULTS: { route: RouteId; label: string; icon: IconName }[] = [
  { route: 'home', label: 'Home', icon: 'home' },
  { route: 'files', label: 'Files', icon: 'folder' },
  { route: 'recent', label: 'Recent', icon: 'clock' },
  { route: 'starred', label: 'Starred', icon: 'star' },
  { route: 'shared', label: 'Shared With Me', icon: 'share' },
  { route: 'downloads', label: 'Downloads', icon: 'download' },
  { route: 'torrents', label: 'Torrents', icon: 'magnet' },
  { route: 'devices', label: 'Devices', icon: 'devices' },
  { route: 'network', label: 'Network', icon: 'network' },
  { route: 'workspaces', label: 'Workspaces', icon: 'workspace' },
  { route: 'trash', label: 'Trash', icon: 'trash' },
  { route: 'settings', label: 'Settings', icon: 'settings' },
]

export function CommandPalette({ onClose }: { onClose: () => void }) {
  const [query, setQuery] = useState('')
  const [fileResults, setFileResults] = useState<FileEntry[]>([])
  const [activeIndex, setActiveIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const debounceRef = useRef<number | undefined>(undefined)

  const nav = useNav()
  const setRoute = useNav((s) => s.setRoute)
  const { drives, places } = useSystemPlaces()
  const workspaces = useWorkspaces((s) => s.workspaces)
  const selection = useSelection()
  const actions = useFileActions(nav.active)
  const scale = useMotionScale()

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  useEffect(() => {
    window.clearTimeout(debounceRef.current)
    const q = query.trim()
    if (q.length < 2) {
      setFileResults([])
      return
    }
    debounceRef.current = window.setTimeout(() => {
      // Drive roots (e.g. "B:\\") already contain every place beneath them
      // (e.g. "B:\\Downloads"), so searching both would walk the same files
      // twice and show duplicate results — keep only the outermost roots.
      const allRoots = [
        ...places.map((p) => p.path),
        ...drives.filter((d) => d.ready).map((d) => d.path),
      ]
      const roots = allRoots.filter(
        (root) => !allRoots.some((other) => other !== root && root.startsWith(other)),
      )
      if (!roots.length) return
      api
        .search({ query: q, roots, limit: 40, maxDepth: 6 })
        .then((found) => {
          const seen = new Set<string>()
          setFileResults(found.filter((f) => (seen.has(f.path) ? false : (seen.add(f.path), true))))
        })
        .catch(() => setFileResults([]))
    }, 180)
    return () => window.clearTimeout(debounceRef.current)
  }, [query, places, drives])

  const results = useMemo<Result[]>(() => {
    const q = query.trim().toLowerCase()
    const out: Result[] = []

    const selected = selection.selectedEntries(nav.active)
    if (q.length === 0) {
      out.push(
        { id: 'r-files', group: 'Go to', label: 'Files', icon: 'folder', run: () => setRoute('files') },
        { id: 'r-home', group: 'Go to', label: 'Home', icon: 'home', run: () => setRoute('home') },
        { id: 'a-newfolder', group: 'Actions', label: 'Create Folder', icon: 'folderPlus', run: () => actions.newFolder() },
        { id: 'a-settings', group: 'Go to', label: 'Open Settings', icon: 'settings', run: () => setRoute('settings') },
      )
      return out
    }

    // Actions
    const actionDefs: { label: string; icon: IconName; run: () => void; needsSelection?: boolean }[] = [
      { label: 'Create Folder', icon: 'folderPlus', run: () => actions.newFolder() },
      { label: 'Open Settings', icon: 'settings', run: () => setRoute('settings') },
      { label: 'Create Workspace', icon: 'workspace', run: () => setRoute('workspaces') },
      { label: 'Rename', icon: 'pencil', run: () => selected[0] && actions.rename(selected[0]), needsSelection: true },
      { label: 'Delete', icon: 'trash', run: () => actions.remove(selected), needsSelection: true },
      { label: 'Compress', icon: 'archive', run: () => actions.compress(selected), needsSelection: true },
    ]
    for (const a of actionDefs) {
      if (a.needsSelection && selected.length === 0) continue
      if (a.label.toLowerCase().includes(q)) {
        out.push({ id: `action-${a.label}`, group: 'Actions', label: a.label, icon: a.icon, run: a.run })
      }
    }

    // Routes / sections
    for (const r of ROUTE_RESULTS) {
      if (r.label.toLowerCase().includes(q)) {
        out.push({
          id: `route-${r.route}`,
          group: 'Go to',
          label: r.label,
          icon: r.icon,
          run: () => setRoute(r.route),
        })
      }
    }

    // Drives
    for (const d of drives) {
      if (d.label.toLowerCase().includes(q) || d.letter.toLowerCase().includes(q)) {
        out.push({
          id: `drive-${d.letter}`,
          group: 'Drives',
          label: `${d.label} (${d.letter})`,
          icon: 'drive',
          run: () => {
            nav.go(d.path)
            setRoute('files')
          },
        })
      }
    }

    // Workspaces
    for (const w of workspaces) {
      if (w.name.toLowerCase().includes(q)) {
        out.push({
          id: `ws-${w.id}`,
          group: 'Workspaces',
          label: w.name,
          icon: 'workspace',
          run: () => setRoute('workspaces'),
        })
      }
    }

    // Files / folders from the backend search
    for (const f of fileResults) {
      out.push({
        id: `file-${f.path}`,
        group: 'Files & Folders',
        label: f.name,
        sub: f.path,
        icon: 'file',
        fileKind: f.kind,
        run: () => {
          if (f.isDir) {
            nav.go(f.path)
          } else {
            void api.open(f.path)
          }
          setRoute('files')
        },
      })
    }

    return out
  }, [query, fileResults, drives, workspaces, places, nav, setRoute, actions, selection])

  useEffect(() => setActiveIndex(0), [results.length, query])

  const runActive = () => {
    const r = results[activeIndex]
    if (r) {
      r.run()
      onClose()
    }
  }

  const grouped = useMemo(() => {
    const map = new Map<string, Result[]>()
    for (const r of results) {
      if (!map.has(r.group)) map.set(r.group, [])
      map.get(r.group)!.push(r)
    }
    return map
  }, [results])

  return (
    <motion.div
      className="overlay"
      style={{ alignItems: 'flex-start' }}
      onClick={onClose}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.15 * scale }}
    >
      <motion.div
        className="palette"
        onClick={(e) => e.stopPropagation()}
        initial={{ opacity: 0, scale: 0.97, y: -8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.98, y: -6 }}
        transition={{ duration: 0.18 * scale, ease: [0.16, 1, 0.3, 1] }}
      >
        <input
          ref={inputRef}
          className="palette-input"
          placeholder="Search files, folders, apps, or type a command…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') onClose()
            else if (e.key === 'ArrowDown') {
              e.preventDefault()
              setActiveIndex((i) => Math.min(results.length - 1, i + 1))
            } else if (e.key === 'ArrowUp') {
              e.preventDefault()
              setActiveIndex((i) => Math.max(0, i - 1))
            } else if (e.key === 'Enter') {
              e.preventDefault()
              runActive()
            }
          }}
        />
        <div className="palette-list">
          {results.length === 0 ? (
            <div style={{ padding: '30px 14px', textAlign: 'center', color: 'var(--text-faint)', fontSize: 12.5 }}>
              No matches for "{query}"
            </div>
          ) : (
            Array.from(grouped.entries()).map(([group, items]) => (
              <div key={group}>
                <div className="palette-group">{group}</div>
                {items.map((r) => {
                  const idx = results.indexOf(r)
                  return (
                    <button
                      key={r.id}
                      className="palette-item"
                      data-active={idx === activeIndex}
                      onMouseEnter={() => setActiveIndex(idx)}
                      onClick={() => {
                        r.run()
                        onClose()
                      }}
                    >
                      {r.fileKind ? <KindIcon kind={r.fileKind} size={16} /> : <Icon name={r.icon} size={16} />}
                      <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {r.label}
                      </span>
                      {r.sub && <span className="sub">{r.sub}</span>}
                    </button>
                  )
                })}
              </div>
            ))
          )}
        </div>
        <div className="palette-foot">
          <span>↑↓ Navigate</span>
          <span>Enter Select</span>
          <span>Esc Close</span>
        </div>
      </motion.div>
    </motion.div>
  )
}
