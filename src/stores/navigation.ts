import { create } from 'zustand'
import { parentOf } from '../lib/format'

export type RouteId =
  | 'home'
  | 'files'
  | 'recent'
  | 'starred'
  | 'shared'
  | 'downloads'
  | 'torrents'
  | 'devices'
  | 'network'
  | 'trash'
  | 'workspaces'
  | 'settings'

export type SettingsTab = 'appearance' | 'themes' | 'layout' | 'behavior'

export interface Pane {
  path: string
  /** Full visited stack; `index` is where we are inside it. */
  history: string[]
  index: number
}

export interface NavState {
  route: RouteId
  settingsTab: SettingsTab
  panes: [Pane, Pane]
  active: 0 | 1
  /** Bumped to force the current listing to be re-fetched. */
  reloadToken: number

  setRoute: (route: RouteId) => void
  setSettingsTab: (tab: SettingsTab) => void
  openSettings: (tab: SettingsTab) => void
  go: (path: string, pane?: 0 | 1) => void
  back: (pane?: 0 | 1) => void
  forward: (pane?: 0 | 1) => void
  up: (pane?: 0 | 1) => void
  reload: () => void
  setActive: (pane: 0 | 1) => void
  canBack: (pane?: 0 | 1) => boolean
  canForward: (pane?: 0 | 1) => boolean
}

const emptyPane = (path = ''): Pane => ({ path, history: path ? [path] : [], index: 0 })

export const useNav = create<NavState>()((set, get) => ({
  route: 'home',
  settingsTab: 'appearance',
  panes: [emptyPane(), emptyPane()],
  active: 0,
  reloadToken: 0,

  setRoute: (route) => set({ route }),
  setSettingsTab: (settingsTab) => set({ settingsTab }),
  openSettings: (settingsTab) => set({ route: 'settings', settingsTab }),

  go: (path, pane) => {
    const idx = pane ?? get().active
    set((s) => {
      const p = s.panes[idx]
      if (p.path === path) return s
      // Truncate anything ahead of us before pushing, so forward history
      // behaves the way a browser's does.
      const history = [...p.history.slice(0, p.index + 1), path]
      const panes = [...s.panes] as [Pane, Pane]
      panes[idx] = { path, history, index: history.length - 1 }
      return { panes, route: 'files' }
    })
  },

  back: (pane) => {
    const idx = pane ?? get().active
    set((s) => {
      const p = s.panes[idx]
      if (p.index <= 0) return s
      const panes = [...s.panes] as [Pane, Pane]
      panes[idx] = { ...p, index: p.index - 1, path: p.history[p.index - 1] }
      return { panes }
    })
  },

  forward: (pane) => {
    const idx = pane ?? get().active
    set((s) => {
      const p = s.panes[idx]
      if (p.index >= p.history.length - 1) return s
      const panes = [...s.panes] as [Pane, Pane]
      panes[idx] = { ...p, index: p.index + 1, path: p.history[p.index + 1] }
      return { panes }
    })
  },

  up: (pane) => {
    const idx = pane ?? get().active
    const parent = parentOf(get().panes[idx].path)
    if (parent) get().go(parent, idx)
  },

  reload: () => set((s) => ({ reloadToken: s.reloadToken + 1 })),
  setActive: (active) => set({ active }),

  canBack: (pane) => {
    const idx = pane ?? get().active
    return get().panes[idx].index > 0
  },
  canForward: (pane) => {
    const idx = pane ?? get().active
    const p = get().panes[idx]
    return p.index < p.history.length - 1
  },
}))
