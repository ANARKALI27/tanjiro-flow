import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { SortDir, SortKey, ViewMode } from '../lib/types'

export type ThemeBase = 'midnight' | 'aurora' | 'amoled' | 'minimal' | 'daybreak'
export type AnimationLevel = 'off' | 'low' | 'medium' | 'high'
export type BackgroundType = 'none' | 'solid' | 'gradient' | 'image' | 'video'
export type OverlayEffect = 'none' | 'rain' | 'snow' | 'fire' | 'droplets'

export interface Background {
  type: BackgroundType
  /** A CSS colour, a CSS gradient, or a file path for `image` / `video`. */
  value: string
  opacity: number
  /** Video-only adjustments. Ignored for every other background type.
   *  Optional so older persisted themes/settings (saved before video
   *  backgrounds existed) keep loading — see withVideoDefaults(). */
  videoBrightness?: number
  videoBlur?: number
  videoSpeed?: number
  videoMuted?: boolean
}

export interface AnaTheme {
  id: string
  name: string
  builtin: boolean
  base: ThemeBase
  accent: string
  radius: number
  blur: number
  background: Background
}

export interface PanelToggles {
  preview: boolean
  quickActions: boolean
  storage: boolean
  workspaces: boolean
  transfers: boolean
}

/** Sidebar sections the user can hide. Keys match the route ids. */
export type SectionKey =
  | 'home'
  | 'quickAccess'
  | 'files'
  | 'recent'
  | 'starred'
  | 'shared'
  | 'downloads'
  | 'torrents'
  | 'devices'
  | 'network'
  | 'trash'
  | 'drives'
  | 'workspaces'

export interface SettingsState {
  // --- theme ---
  base: ThemeBase
  accent: string
  radius: number
  blur: number
  transparency: number
  background: Background
  overlayEffect: OverlayEffect
  overlayIntensity: number
  themes: AnaTheme[]
  activeThemeId: string

  // --- UI shape ---
  sidebarWidth: number
  sidebarCollapsed: boolean
  cardSize: number
  density: number
  animation: AnimationLevel

  // --- layout ---
  panels: PanelToggles
  sections: Record<SectionKey, boolean>

  // --- behaviour ---
  showHidden: boolean
  confirmDelete: boolean
  useRecycleBin: boolean
  viewMode: ViewMode
  /** Whether the two-pane side-by-side layout is active. Independent of
   *  `viewMode` (grid/list/details/gallery) — the two used to be conflated
   *  into one enum value, which meant switching content view silently
   *  turned dual-pane off and vice versa. */
  dualPane: boolean
  sortKey: SortKey
  sortDir: SortDir
  foldersFirst: boolean
  starred: string[]

  set: <K extends keyof SettingsState>(key: K, value: SettingsState[K]) => void
  toggleSection: (key: SectionKey) => void
  togglePanel: (key: keyof PanelToggles) => void
  toggleStar: (path: string) => void
  applyTheme: (theme: AnaTheme) => void
  saveCurrentAsTheme: (name: string) => AnaTheme
  addTheme: (theme: AnaTheme) => void
  removeTheme: (id: string) => void
  resetAppearance: () => void
}

const DEFAULT_SECTIONS: Record<SectionKey, boolean> = {
  home: true,
  quickAccess: true,
  files: true,
  recent: true,
  starred: true,
  shared: true,
  downloads: true,
  torrents: true,
  devices: true,
  network: true,
  trash: true,
  drives: true,
  workspaces: true,
}

const APPEARANCE_DEFAULTS = {
  base: 'midnight' as ThemeBase,
  accent: '#7c5cff',
  radius: 14,
  blur: 18,
  transparency: 1,
  background: {
    type: 'none',
    value: '',
    opacity: 0,
    videoBrightness: 1,
    videoBlur: 0,
    videoSpeed: 1,
    videoMuted: true,
  } as Background,
  overlayEffect: 'none' as OverlayEffect,
  overlayIntensity: 0.7,
  cardSize: 118,
  density: 1,
  animation: 'medium' as AnimationLevel,
  sidebarWidth: 244,
}

export const useSettings = create<SettingsState>()(
  persist(
    (set, get) => ({
      ...APPEARANCE_DEFAULTS,
      themes: [],
      activeThemeId: 'ana-midnight',
      sidebarCollapsed: false,
      panels: {
        preview: true,
        quickActions: true,
        storage: true,
        workspaces: true,
        transfers: true,
      },
      sections: { ...DEFAULT_SECTIONS },
      showHidden: false,
      confirmDelete: true,
      useRecycleBin: true,
      viewMode: 'grid',
      dualPane: false,
      sortKey: 'name',
      sortDir: 'asc',
      foldersFirst: true,
      starred: [],

      set: (key, value) => set({ [key]: value } as Partial<SettingsState>),

      toggleSection: (key) =>
        set((s) => ({ sections: { ...s.sections, [key]: !s.sections[key] } })),

      togglePanel: (key) => set((s) => ({ panels: { ...s.panels, [key]: !s.panels[key] } })),

      toggleStar: (path) =>
        set((s) => ({
          starred: s.starred.includes(path)
            ? s.starred.filter((p) => p !== path)
            : [...s.starred, path],
        })),

      applyTheme: (theme) =>
        set({
          activeThemeId: theme.id,
          base: theme.base,
          accent: theme.accent,
          radius: theme.radius,
          blur: theme.blur,
          background: theme.background,
        }),

      saveCurrentAsTheme: (name) => {
        const s = get()
        const theme: AnaTheme = {
          id: `user-${Date.now().toString(36)}`,
          name,
          builtin: false,
          base: s.base,
          accent: s.accent,
          radius: s.radius,
          blur: s.blur,
          background: s.background,
        }
        set({ themes: [...s.themes, theme], activeThemeId: theme.id })
        return theme
      },

      addTheme: (theme) => set((s) => ({ themes: [...s.themes, theme] })),

      removeTheme: (id) =>
        set((s) => ({
          themes: s.themes.filter((t) => t.id !== id),
          activeThemeId: s.activeThemeId === id ? 'ana-midnight' : s.activeThemeId,
        })),

      resetAppearance: () => set({ ...APPEARANCE_DEFAULTS, activeThemeId: 'ana-midnight' }),
    }),
    {
      name: 'tanjiro-flow.settings.v1',
      // Anything not listed here is transient and recomputed on load.
      partialize: (s) => ({
        base: s.base,
        accent: s.accent,
        radius: s.radius,
        blur: s.blur,
        transparency: s.transparency,
        background: s.background,
        overlayEffect: s.overlayEffect,
        overlayIntensity: s.overlayIntensity,
        themes: s.themes,
        activeThemeId: s.activeThemeId,
        sidebarWidth: s.sidebarWidth,
        sidebarCollapsed: s.sidebarCollapsed,
        cardSize: s.cardSize,
        density: s.density,
        animation: s.animation,
        panels: s.panels,
        sections: s.sections,
        showHidden: s.showHidden,
        confirmDelete: s.confirmDelete,
        useRecycleBin: s.useRecycleBin,
        viewMode: s.viewMode,
        dualPane: s.dualPane,
        sortKey: s.sortKey,
        sortDir: s.sortDir,
        foldersFirst: s.foldersFirst,
        starred: s.starred,
      }),
    },
  ),
)

const MOTION_SCALE: Record<AnimationLevel, number> = {
  off: 0,
  low: 0.55,
  medium: 1,
  high: 1.5,
}

/**
 * Push the settings that are purely visual onto the document as CSS variables.
 * Every consumer reads the variable, so this one function is the only thing
 * that has to run when a theme changes — no component re-render required.
 */
export function applyVisualSettings(s: SettingsState, assetUrl: (p: string) => string) {
  const root = document.documentElement
  root.dataset.theme = s.base
  root.dataset.motion = s.animation === 'off' ? 'off' : 'on'

  root.style.setProperty('--accent', s.accent)
  root.style.setProperty('--accent-soft', hexToRgba(s.accent, 0.16))
  root.style.setProperty('--radius', `${s.radius}px`)
  root.style.setProperty('--blur', `${s.blur}px`)
  root.style.setProperty('--sidebar-width', `${s.sidebarWidth}px`)
  root.style.setProperty('--card-size', `${s.cardSize}px`)
  root.style.setProperty('--density', String(s.density))
  root.style.setProperty('--motion', String(MOTION_SCALE[s.animation]))

  // Background layer. `video` is rendered as a real <video> element
  // (BackgroundVideo.tsx) rather than a CSS background-image, so it's
  // deliberately excluded here — the CSS layer stays empty underneath it.
  const bg = s.background
  let image = 'none'
  let opacity = 0
  if (bg.type === 'solid' && bg.value) {
    image = `linear-gradient(${bg.value}, ${bg.value})`
    opacity = bg.opacity
  } else if (bg.type === 'gradient' && bg.value) {
    image = bg.value
    opacity = bg.opacity
  } else if (bg.type === 'image' && bg.value) {
    image = `url("${assetUrl(bg.value)}")`
    opacity = bg.opacity
  }
  root.style.setProperty('--user-bg', image)
  root.style.setProperty('--user-bg-opacity', String(opacity))
}

/** Fills in defaults for any video-adjustment fields missing from older
 * persisted state, so a stale localStorage entry never produces NaN/undefined
 * CSS filter values. */
export function withVideoDefaults(bg: Background): Required<Background> {
  return {
    type: bg.type,
    value: bg.value,
    opacity: bg.opacity ?? 0,
    videoBrightness: bg.videoBrightness ?? 1,
    videoBlur: bg.videoBlur ?? 0,
    videoSpeed: bg.videoSpeed ?? 1,
    videoMuted: bg.videoMuted ?? true,
  }
}

function hexToRgba(hex: string, alpha: number): string {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex.trim())
  if (!m) return hex
  const [, r, g, b] = m
  return `rgba(${parseInt(r, 16)}, ${parseInt(g, 16)}, ${parseInt(b, 16)}, ${alpha})`
}
