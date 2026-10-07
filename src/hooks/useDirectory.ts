import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { api } from '../lib/ipc'
import type { FileEntry, FlowError, SortDir, SortKey } from '../lib/types'
import { useSettings } from '../stores/settings'
import { useNav } from '../stores/navigation'

export interface DirectoryState {
  entries: FileEntry[]
  loading: boolean
  error: FlowError | null
  unreadable: number
  reload: () => void
}

export function sortEntries(
  entries: FileEntry[],
  key: SortKey,
  dir: SortDir,
  foldersFirst: boolean,
): FileEntry[] {
  const factor = dir === 'asc' ? 1 : -1
  const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' })
  return [...entries].sort((a, b) => {
    if (foldersFirst && a.isDir !== b.isDir) return a.isDir ? -1 : 1
    switch (key) {
      case 'size':
        return (a.size - b.size) * factor
      case 'modified':
        return ((a.modified ?? 0) - (b.modified ?? 0)) * factor
      case 'kind':
        return (collator.compare(a.kind, b.kind) || collator.compare(a.name, b.name)) * factor
      default:
        return collator.compare(a.name, b.name) * factor
    }
  })
}

/**
 * Loads one directory. Every load is tagged, and a stale response is dropped —
 * without this, clicking quickly through folders can land you on the contents
 * of a folder you already left.
 */
export function useDirectory(path: string): DirectoryState {
  const showHidden = useSettings((s) => s.showHidden)
  const sortKey = useSettings((s) => s.sortKey)
  const sortDir = useSettings((s) => s.sortDir)
  const foldersFirst = useSettings((s) => s.foldersFirst)
  const reloadToken = useNav((s) => s.reloadToken)
  const bump = useNav((s) => s.reload)

  const [raw, setRaw] = useState<FileEntry[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<FlowError | null>(null)
  const [unreadable, setUnreadable] = useState(0)
  const requestId = useRef(0)

  useEffect(() => {
    if (!path) {
      setRaw([])
      setError(null)
      setUnreadable(0)
      return
    }
    const id = ++requestId.current
    setLoading(true)
    setError(null)

    api
      .listDir(path, showHidden)
      .then((listing) => {
        if (id !== requestId.current) return
        setRaw(listing.entries)
        setUnreadable(listing.unreadable)
      })
      .catch((e: FlowError) => {
        if (id !== requestId.current) return
        setRaw([])
        setError(e)
      })
      .finally(() => {
        if (id === requestId.current) setLoading(false)
      })
  }, [path, showHidden, reloadToken])

  const entries = useMemo(
    () => sortEntries(raw, sortKey, sortDir, foldersFirst),
    [raw, sortKey, sortDir, foldersFirst],
  )

  const reload = useCallback(() => bump(), [bump])

  return { entries, loading, error, unreadable, reload }
}
