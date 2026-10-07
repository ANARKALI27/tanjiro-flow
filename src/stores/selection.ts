import { create } from 'zustand'
import type { FileEntry } from '../lib/types'

export interface SelectionState {
  /** Selected paths, per pane. */
  paths: [string[], string[]]
  /** The entry the last click landed on — the shift-select anchor. */
  anchor: [string | null, string | null]
  /** Cached entries so panels can render without another disk read. */
  entries: Record<string, FileEntry>

  select: (pane: 0 | 1, path: string, entry: FileEntry) => void
  toggle: (pane: 0 | 1, path: string, entry: FileEntry) => void
  selectRange: (pane: 0 | 1, ordered: FileEntry[], to: string) => void
  selectAll: (pane: 0 | 1, ordered: FileEntry[]) => void
  /** Batch-set an arbitrary set of entries as the selection — the finalize
   * step for a rubber-band drag-select, which can span entries that aren't
   * contiguous in the ordered list. `additive` merges into the current
   * selection (ctrl/shift held) instead of replacing it. */
  selectMany: (pane: 0 | 1, entries: FileEntry[], additive?: boolean) => void
  clear: (pane: 0 | 1) => void
  isSelected: (pane: 0 | 1, path: string) => boolean
  selectedEntries: (pane: 0 | 1) => FileEntry[]
}

export const useSelection = create<SelectionState>()((set, get) => ({
  paths: [[], []],
  anchor: [null, null],
  entries: {},

  select: (pane, path, entry) =>
    set((s) => {
      const paths = [...s.paths] as [string[], string[]]
      const anchor = [...s.anchor] as [string | null, string | null]
      paths[pane] = [path]
      anchor[pane] = path
      return { paths, anchor, entries: { ...s.entries, [path]: entry } }
    }),

  toggle: (pane, path, entry) =>
    set((s) => {
      const paths = [...s.paths] as [string[], string[]]
      const anchor = [...s.anchor] as [string | null, string | null]
      const current = paths[pane]
      paths[pane] = current.includes(path)
        ? current.filter((p) => p !== path)
        : [...current, path]
      anchor[pane] = path
      return { paths, anchor, entries: { ...s.entries, [path]: entry } }
    }),

  selectRange: (pane, ordered, to) =>
    set((s) => {
      const from = s.anchor[pane] ?? to
      const a = ordered.findIndex((e) => e.path === from)
      const b = ordered.findIndex((e) => e.path === to)
      if (a === -1 || b === -1) return s
      const [lo, hi] = a < b ? [a, b] : [b, a]
      const slice = ordered.slice(lo, hi + 1)
      const paths = [...s.paths] as [string[], string[]]
      paths[pane] = slice.map((e) => e.path)
      const entries = { ...s.entries }
      for (const e of slice) entries[e.path] = e
      return { paths, entries }
    }),

  selectAll: (pane, ordered) =>
    set((s) => {
      const paths = [...s.paths] as [string[], string[]]
      paths[pane] = ordered.map((e) => e.path)
      const entries = { ...s.entries }
      for (const e of ordered) entries[e.path] = e
      return { paths, entries }
    }),

  selectMany: (pane, entries, additive) =>
    set((s) => {
      const paths = [...s.paths] as [string[], string[]]
      const nextEntries = { ...s.entries }
      for (const e of entries) nextEntries[e.path] = e
      if (additive) {
        const merged = new Set(paths[pane])
        for (const e of entries) merged.add(e.path)
        paths[pane] = [...merged]
      } else {
        paths[pane] = entries.map((e) => e.path)
      }
      const anchor = [...s.anchor] as [string | null, string | null]
      if (entries.length) anchor[pane] = entries[entries.length - 1].path
      return { paths, anchor, entries: nextEntries }
    }),

  clear: (pane) =>
    set((s) => {
      const paths = [...s.paths] as [string[], string[]]
      const anchor = [...s.anchor] as [string | null, string | null]
      paths[pane] = []
      anchor[pane] = null
      return { paths, anchor }
    }),

  isSelected: (pane, path) => get().paths[pane].includes(path),

  selectedEntries: (pane) => {
    const { paths, entries } = get()
    return paths[pane].map((p) => entries[p]).filter(Boolean)
  },
}))
