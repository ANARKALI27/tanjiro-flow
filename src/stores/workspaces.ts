import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { SortDir, SortKey, ViewMode } from '../lib/types'

/**
 * A workspace is a saved snapshot of "where I was and how I was looking at it".
 * Restoring one puts the panes, layout and sort back exactly as they were.
 */
export interface Workspace {
  id: string
  name: string
  color: string
  paths: string[]
  dual: boolean
  viewMode: ViewMode
  sortKey: SortKey
  sortDir: SortDir
  createdAt: number
  lastOpenedAt: number | null
}

export interface WorkspaceState {
  workspaces: Workspace[]
  activeId: string | null
  create: (w: Omit<Workspace, 'id' | 'createdAt' | 'lastOpenedAt'>) => Workspace
  update: (id: string, patch: Partial<Workspace>) => void
  remove: (id: string) => void
  touch: (id: string) => void
  setActive: (id: string | null) => void
}

export const useWorkspaces = create<WorkspaceState>()(
  persist(
    (set) => ({
      workspaces: [],
      activeId: null,

      create: (w) => {
        const ws: Workspace = {
          ...w,
          id: `ws-${Date.now().toString(36)}`,
          createdAt: Date.now(),
          lastOpenedAt: null,
        }
        set((s) => ({ workspaces: [...s.workspaces, ws] }))
        return ws
      },

      update: (id, patch) =>
        set((s) => ({
          workspaces: s.workspaces.map((w) => (w.id === id ? { ...w, ...patch } : w)),
        })),

      remove: (id) =>
        set((s) => ({
          workspaces: s.workspaces.filter((w) => w.id !== id),
          activeId: s.activeId === id ? null : s.activeId,
        })),

      touch: (id) =>
        set((s) => ({
          workspaces: s.workspaces.map((w) =>
            w.id === id ? { ...w, lastOpenedAt: Date.now() } : w,
          ),
        })),

      setActive: (activeId) => set({ activeId }),
    }),
    { name: 'tanjiro-flow.workspaces.v1' },
  ),
)
