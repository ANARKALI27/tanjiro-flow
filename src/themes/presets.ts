import type { AnaTheme, ThemeBase } from '../stores/settings'

/**
 * The built-in theme bases. Each maps to a `[data-theme]` block in tokens.css;
 * everything else a theme carries (accent, radius, blur, background) is applied
 * as a CSS variable override on top, which is how a saved theme can restyle the
 * app without shipping a stylesheet.
 */
export const THEME_BASES: { id: ThemeBase; name: string; hint: string; swatch: string; accent: string }[] = [
  { id: 'midnight', name: 'Midnight', hint: 'Deep navy, purple lighting', swatch: '#0a0e1c', accent: '#7c5cff' },
  { id: 'aurora', name: 'Aurora', hint: 'Teal and cobalt', swatch: '#07131a', accent: '#3ae2c5' },
  { id: 'amoled', name: 'AMOLED', hint: 'True black, no glow', swatch: '#000000', accent: '#8f74ff' },
  { id: 'minimal', name: 'Minimal', hint: 'Flat dark, no glow', swatch: '#15171c', accent: '#9aa0ff' },
  { id: 'daybreak', name: 'Daybreak', hint: 'Light', swatch: '#f1f2f9', accent: '#6b42ff' },
]

export const ACCENTS = [
  '#7c5cff',
  '#3d8bff',
  '#ff5ca8',
  '#3ae2c5',
  '#ffb648',
  '#ff6b6b',
  '#a76cff',
  '#4fd1c5',
]

/** The themes that ship with Tanjiro Flow. Users add their own alongside these. */
export const BUILTIN_THEMES: AnaTheme[] = [
  {
    id: 'ana-midnight',
    name: 'Midnight',
    builtin: true,
    base: 'midnight',
    accent: '#7c5cff',
    radius: 14,
    blur: 18,
    background: { type: 'none', value: '', opacity: 0 },
  },
  {
    id: 'ana-neon',
    name: 'ANA Neon',
    builtin: true,
    base: 'midnight',
    accent: '#ff5ca8',
    radius: 18,
    blur: 26,
    background: {
      type: 'gradient',
      value: 'linear-gradient(140deg, rgba(124,92,255,0.35), rgba(255,92,168,0.22) 55%, rgba(61,139,255,0.3))',
      opacity: 0.5,
    },
  },
  {
    id: 'ana-aurora',
    name: 'Aurora',
    builtin: true,
    base: 'aurora',
    accent: '#3ae2c5',
    radius: 16,
    blur: 22,
    background: { type: 'none', value: '', opacity: 0 },
  },
  {
    id: 'ana-amoled',
    name: 'AMOLED',
    builtin: true,
    base: 'amoled',
    accent: '#8f74ff',
    radius: 10,
    blur: 8,
    background: { type: 'none', value: '', opacity: 0 },
  },
  {
    id: 'ana-minimal',
    name: 'Minimal',
    builtin: true,
    base: 'minimal',
    accent: '#9aa0ff',
    radius: 8,
    blur: 0,
    background: { type: 'none', value: '', opacity: 0 },
  },
  {
    id: 'ana-daybreak',
    name: 'Daybreak',
    builtin: true,
    base: 'daybreak',
    accent: '#6b42ff',
    radius: 14,
    blur: 18,
    background: { type: 'none', value: '', opacity: 0 },
  },
]

/**
 * Serialize a theme to the `.ana-theme` document shape. Versioned from day one
 * so a future reader can migrate rather than guess.
 */
export function exportTheme(theme: AnaTheme): string {
  return JSON.stringify(
    {
      format: 'ana-theme',
      version: 1,
      theme: { ...theme, builtin: false },
    },
    null,
    2,
  )
}

export function importTheme(raw: string): AnaTheme {
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    throw new Error("That file isn't valid JSON, so it can't be read as a theme.")
  }
  const doc = parsed as { format?: string; version?: number; theme?: AnaTheme }
  if (doc?.format !== 'ana-theme') {
    throw new Error("That file isn't an Tanjiro Flow theme.")
  }
  if (typeof doc.version !== 'number' || doc.version > 1) {
    throw new Error('That theme was made with a newer version of Tanjiro Flow.')
  }
  const t = doc.theme
  if (!t || typeof t.name !== 'string' || typeof t.base !== 'string') {
    throw new Error('That theme file is missing required fields.')
  }
  return {
    id: `user-${Date.now().toString(36)}`,
    name: t.name,
    builtin: false,
    base: t.base,
    accent: t.accent ?? '#7c5cff',
    radius: Number(t.radius) || 14,
    blur: Number(t.blur) || 0,
    background: t.background ?? { type: 'none', value: '', opacity: 0 },
  }
}
