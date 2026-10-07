import { create } from 'zustand'

export type ClipboardMode = 'copy' | 'cut'

export interface ClipboardState {
  mode: ClipboardMode | null
  paths: string[]
  copy: (paths: string[]) => void
  cut: (paths: string[]) => void
  clear: () => void
  has: (path: string) => boolean
}

export const useClipboard = create<ClipboardState>()((set, get) => ({
  mode: null,
  paths: [],
  copy: (paths) => set({ mode: 'copy', paths }),
  cut: (paths) => set({ mode: 'cut', paths }),
  clear: () => set({ mode: null, paths: [] }),
  has: (path) => get().mode === 'cut' && get().paths.includes(path),
}))
