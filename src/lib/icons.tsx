import type { FileKind } from './types'

/**
 * One inline SVG set for the whole app. Keeping it local (rather than pulling
 * an icon package) means no extra runtime dependency, no icon-font flash, and
 * every glyph inherits currentColor and the same 1.6 stroke weight — which is
 * what makes the UI read as one system.
 */
const PATHS: Record<string, string> = {
  // --- navigation / chrome ---
  home: 'M3 10.5 12 3l9 7.5M5.5 9.5V20h13V9.5M9.5 20v-6h5v6',
  clock: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM12 7v5l3.2 1.9',
  star: 'M12 3.5l2.6 5.3 5.9.85-4.25 4.15 1 5.87L12 16.9l-5.25 2.77 1-5.87L3.5 9.65l5.9-.85L12 3.5Z',
  share: 'M17 8.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5ZM7 14.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5ZM17 20.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5ZM9.2 10.8l5.6-2.9M9.2 13.2l5.6 2.9',
  download: 'M12 3.5v11m0 0 4-4m-4 4-4-4M4.5 19.5h15',
  magnet: 'M6 4H3v7a9 9 0 0 0 18 0V4h-3v7a6 6 0 0 1-12 0V4ZM3 9h3M18 9h3',
  devices: 'M3 6.5A1.5 1.5 0 0 1 4.5 5h10A1.5 1.5 0 0 1 16 6.5V15H3V6.5ZM1.5 18h16M18 9.5A1.5 1.5 0 0 1 19.5 8h1A1.5 1.5 0 0 1 22 9.5v8a1.5 1.5 0 0 1-1.5 1.5h-1A1.5 1.5 0 0 1 18 17.5v-8Z',
  network: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM3.2 9h17.6M3.2 15h17.6M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18',
  trash: 'M4 7h16M9.5 7V5.2A1.2 1.2 0 0 1 10.7 4h2.6a1.2 1.2 0 0 1 1.2 1.2V7M6 7l.9 12.1A1.5 1.5 0 0 0 8.4 20.5h7.2a1.5 1.5 0 0 0 1.5-1.4L18 7M10 11v6M14 11v6',
  drive: 'M3.5 12.5h17M5 12.5 7.2 5.6A1.5 1.5 0 0 1 8.6 4.5h6.8a1.5 1.5 0 0 1 1.4 1.1l2.2 6.9M3.5 12.5v5A1.5 1.5 0 0 0 5 19h14a1.5 1.5 0 0 0 1.5-1.5v-5M17 16h.01',
  settings:
    'M12 15.2a3.2 3.2 0 1 0 0-6.4 3.2 3.2 0 0 0 0 6.4Z M19.3 14.4a1.4 1.4 0 0 0 .28 1.55l.05.05a1.7 1.7 0 1 1-2.4 2.4l-.05-.05a1.4 1.4 0 0 0-1.55-.28 1.4 1.4 0 0 0-.85 1.28v.14a1.7 1.7 0 1 1-3.4 0v-.07a1.4 1.4 0 0 0-.92-1.29 1.4 1.4 0 0 0-1.55.28l-.05.05a1.7 1.7 0 1 1-2.4-2.4l.05-.05a1.4 1.4 0 0 0 .28-1.55 1.4 1.4 0 0 0-1.28-.85h-.14a1.7 1.7 0 1 1 0-3.4h.07a1.4 1.4 0 0 0 1.29-.92 1.4 1.4 0 0 0-.28-1.55l-.05-.05a1.7 1.7 0 1 1 2.4-2.4l.05.05a1.4 1.4 0 0 0 1.55.28h.07a1.4 1.4 0 0 0 .85-1.28v-.14a1.7 1.7 0 1 1 3.4 0v.07a1.4 1.4 0 0 0 .85 1.28 1.4 1.4 0 0 0 1.55-.28l.05-.05a1.7 1.7 0 1 1 2.4 2.4l-.05.05a1.4 1.4 0 0 0-.28 1.55v.07a1.4 1.4 0 0 0 1.28.85h.14a1.7 1.7 0 1 1 0 3.4h-.07a1.4 1.4 0 0 0-1.28.85Z',
  search: 'M11 18.5a7.5 7.5 0 1 0 0-15 7.5 7.5 0 0 0 0 15ZM20.5 20.5l-4.2-4.2',
  layers: 'M12 3.2 21 8l-9 4.8L3 8l9-4.8ZM3 12.4 12 17l9-4.6M3 16.6 12 21.2l9-4.6',
  flowmark: 'M4 6.7c2.8-1.7 5.6-1.7 8 0s5.2 1.7 8 0M12 6.7v8.1c0 2.4 1.8 3.9 4.2 3.9M8.4 15.6c-1.6.9-2.5 2.3-2.5 3.9',

  // --- file kinds ---
  folder: 'M3.5 6.8A1.8 1.8 0 0 1 5.3 5h3.4a1.8 1.8 0 0 1 1.44.72l.92 1.23a1.8 1.8 0 0 0 1.44.72h6.2A1.8 1.8 0 0 1 20.5 9.5v7.7a1.8 1.8 0 0 1-1.8 1.8H5.3a1.8 1.8 0 0 1-1.8-1.8V6.8Z',
  file: 'M13.5 3.2H7.3A1.8 1.8 0 0 0 5.5 5v14a1.8 1.8 0 0 0 1.8 1.8h9.4a1.8 1.8 0 0 0 1.8-1.8V8.2l-5-5ZM13.5 3.2V8.2h5',
  image:
    'M4.5 5.8A1.3 1.3 0 0 1 5.8 4.5h12.4a1.3 1.3 0 0 1 1.3 1.3v12.4a1.3 1.3 0 0 1-1.3 1.3H5.8a1.3 1.3 0 0 1-1.3-1.3V5.8ZM9 10.2a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3ZM19.5 15.5l-4.2-4.2L6 19.5',
  video: 'M4.5 7.3A1.8 1.8 0 0 1 6.3 5.5h7.4a1.8 1.8 0 0 1 1.8 1.8v9.4a1.8 1.8 0 0 1-1.8 1.8H6.3a1.8 1.8 0 0 1-1.8-1.8V7.3ZM15.5 10.5l4-2.4v7.8l-4-2.4',
  audio: 'M9.5 18.5a2.5 2.5 0 1 1-5 0 2.5 2.5 0 0 1 5 0Zm0 0V7.2l10-2.2v11.5M19.5 16.5a2.5 2.5 0 1 1-5 0 2.5 2.5 0 0 1 5 0Z',
  pdf: 'M13.5 3.2H7.3A1.8 1.8 0 0 0 5.5 5v14a1.8 1.8 0 0 0 1.8 1.8h9.4a1.8 1.8 0 0 0 1.8-1.8V8.2l-5-5ZM13.5 3.2V8.2h5M8.8 16.5c2.2-1.1 3.6-3 4.4-5.1.5-1.4-.9-2.2-1.5-.9-.7 1.6.6 4.6 2.2 5.7',
  text: 'M13.5 3.2H7.3A1.8 1.8 0 0 0 5.5 5v14a1.8 1.8 0 0 0 1.8 1.8h9.4a1.8 1.8 0 0 0 1.8-1.8V8.2l-5-5ZM13.5 3.2V8.2h5M8.5 12.5h7M8.5 16h5',
  code: 'M9 8.5 5 12l4 3.5M15 8.5l4 3.5-4 3.5M13.4 5.5l-2.8 13',
  archive:
    'M4 6.3A1.8 1.8 0 0 1 5.8 4.5h12.4A1.8 1.8 0 0 1 20 6.3v1.4a1.8 1.8 0 0 1-1.8 1.8H5.8A1.8 1.8 0 0 1 4 7.7V6.3ZM5.5 9.5v8.2a1.8 1.8 0 0 0 1.8 1.8h9.4a1.8 1.8 0 0 0 1.8-1.8V9.5M10.5 13h3',
  application:
    'M4.5 6.3A1.8 1.8 0 0 1 6.3 4.5h11.4a1.8 1.8 0 0 1 1.8 1.8v11.4a1.8 1.8 0 0 1-1.8 1.8H6.3a1.8 1.8 0 0 1-1.8-1.8V6.3ZM9.5 9.5h5v5h-5z',
  font: 'M5.5 19.5 11 4.5h2l5.5 15M8.2 14.5h7.6',
  disk: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM12 14.2a2.2 2.2 0 1 0 0-4.4 2.2 2.2 0 0 0 0 4.4Z',
  shortcut: 'M9 15 20 4M20 4h-6M20 4v6M18 13.5v5A1.5 1.5 0 0 1 16.5 20h-11A1.5 1.5 0 0 1 4 18.5v-11A1.5 1.5 0 0 1 5.5 6h5',
  other: 'M13.5 3.2H7.3A1.8 1.8 0 0 0 5.5 5v14a1.8 1.8 0 0 0 1.8 1.8h9.4a1.8 1.8 0 0 0 1.8-1.8V8.2l-5-5ZM13.5 3.2V8.2h5',

  // --- actions ---
  chevronRight: 'm9.5 5.5 6.5 6.5-6.5 6.5',
  chevronLeft: 'm14.5 5.5-6.5 6.5 6.5 6.5',
  chevronUp: 'm5.5 14.5 6.5-6.5 6.5 6.5',
  chevronDown: 'm5.5 9.5 6.5 6.5 6.5-6.5',
  arrowLeft: 'M19 12H5M11 6l-6 6 6 6',
  arrowRight: 'M5 12h14M13 6l6 6-6 6',
  arrowUp: 'M12 19V5M6 11l6-6 6 6',
  refresh: 'M20 11.5a8 8 0 1 0-.9 4.6M20 6v5.5h-5.5',
  plus: 'M12 5.5v13M5.5 12h13',
  folderPlus:
    'M3.5 6.8A1.8 1.8 0 0 1 5.3 5h3.4a1.8 1.8 0 0 1 1.44.72l.92 1.23a1.8 1.8 0 0 0 1.44.72h6.2A1.8 1.8 0 0 1 20.5 9.5v7.7a1.8 1.8 0 0 1-1.8 1.8H5.3a1.8 1.8 0 0 1-1.8-1.8V6.8ZM12 10.8v5M9.5 13.3h5',
  copy: 'M9 9.3A1.8 1.8 0 0 1 10.8 7.5h7.4A1.8 1.8 0 0 1 20 9.3v7.4a1.8 1.8 0 0 1-1.8 1.8h-7.4A1.8 1.8 0 0 1 9 16.7V9.3ZM15 7.5V5.8A1.8 1.8 0 0 0 13.2 4H5.8A1.8 1.8 0 0 0 4 5.8v7.4A1.8 1.8 0 0 0 5.8 15h1.7',
  scissors:
    'M7 8.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5ZM7 20.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5ZM20 4 9 18M20 20 9 6',
  clipboard:
    'M9 4.5h6M8.5 6.5h-1A1.5 1.5 0 0 0 6 8v11a1.5 1.5 0 0 0 1.5 1.5h9A1.5 1.5 0 0 0 18 19V8a1.5 1.5 0 0 0-1.5-1.5h-1M9.4 3h5.2a.9.9 0 0 1 .9.9v1.7a.9.9 0 0 1-.9.9H9.4a.9.9 0 0 1-.9-.9V3.9A.9.9 0 0 1 9.4 3Z',
  pencil: 'M4.5 19.5h4l10-10a2.12 2.12 0 0 0-3-3l-10 10v3ZM14.5 6.5l3 3',
  info: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM12 11v5.5M12 7.8h.01',
  alert: 'M12 8.5v5M12 17h.01M10.3 3.9 2.6 17.5A1.9 1.9 0 0 0 4.3 20.4h15.4a1.9 1.9 0 0 0 1.7-2.9L13.7 3.9a1.9 1.9 0 0 0-3.4 0Z',
  check: 'm5 12.5 4.5 4.5L19 7.5',
  checkCircle: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM8.5 12.2l2.4 2.4 4.6-4.9',
  x: 'M6 6l12 12M18 6 6 18',
  box: 'M20.5 8.5 12 12.8 3.5 8.5M12 21V12.8M3.5 8.5 12 4.2l8.5 4.3v7L12 19.8 3.5 15.5v-7Z',
  convert: 'M4 8.5h13m0 0-3.5-3.5M17 8.5 13.5 12M20 15.5H7m0 0 3.5-3.5M7 15.5 10.5 19',
  eye: 'M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z M12 14.8a2.8 2.8 0 1 0 0-5.6 2.8 2.8 0 0 0 0 5.6Z',
  externalLink: 'M13 5h6v6M19 5l-8.5 8.5M17 14.5v4A1.5 1.5 0 0 1 15.5 20h-10A1.5 1.5 0 0 1 4 18.5v-10A1.5 1.5 0 0 1 5.5 7h4',
  more: 'M12 6.2h.01M12 12h.01M12 17.8h.01',
  sidebarIcon: 'M4 6.3A1.8 1.8 0 0 1 5.8 4.5h12.4A1.8 1.8 0 0 1 20 6.3v11.4a1.8 1.8 0 0 1-1.8 1.8H5.8A1.8 1.8 0 0 1 4 17.7V6.3ZM9.5 4.5v15',
  palette:
    'M12 21a9 9 0 1 1 0-18c4.97 0 9 3.58 9 8 0 2.2-1.8 3.5-4 3.5h-1.6c-1 0-1.9.8-1.9 1.9 0 .5.2.9.5 1.3.3.4.5.8.5 1.3 0 1.1-.9 2-2.5 2ZM7.5 11.5h.01M10 8h.01M14.5 8h.01M17 11.5h.01',
  sparkles: 'M12 3.5 13.6 8 18 9.6 13.6 11.2 12 15.7 10.4 11.2 6 9.6 10.4 8 12 3.5ZM18.5 15.5l.8 2 2 .8-2 .8-.8 2-.8-2-2-.8 2-.8.8-2Z',
  grid: 'M4.5 4.5h6v6h-6zM13.5 4.5h6v6h-6zM4.5 13.5h6v6h-6zM13.5 13.5h6v6h-6z',
  list: 'M9 6.5h11M9 12h11M9 17.5h11M4.5 6.5h.01M4.5 12h.01M4.5 17.5h.01',
  columns: 'M4.5 5.5h15v13h-15zM10 5.5v13M15 5.5v13',
  gallery: 'M4.5 5.5h15v9h-15zM4.5 17.5h4M10.5 17.5h4M16.5 17.5h3',
  dual: 'M4.5 5.5h6v13h-6zM13.5 5.5h6v13h-6z',
  wifi: 'M2.8 9.2a14 14 0 0 1 18.4 0M6 12.5a9.3 9.3 0 0 1 12 0M9.2 15.8a4.7 4.7 0 0 1 5.6 0M12 19.2h.01',
  qr: 'M4.5 4.5h5v5h-5zM14.5 4.5h5v5h-5zM4.5 14.5h5v5h-5zM14.5 14.5h2v2h-2zM18 14.5h1.5v1.5H18zM14.5 18h1.5v1.5h-1.5zM17.5 17.5h2v2h-2z',
  globe: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM3.2 9h17.6M3.2 15h17.6M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18',
  workspace: 'M4 7.3A1.8 1.8 0 0 1 5.8 5.5h4l1.6 2h6.8A1.8 1.8 0 0 1 20 9.3v7.4a1.8 1.8 0 0 1-1.8 1.8H5.8A1.8 1.8 0 0 1 4 16.7V7.3ZM8.5 12h7',
  pause: 'M9 5.5v13M15 5.5v13',
  play: 'M7.5 4.8v14.4l12-7.2-12-7.2Z',
  upload: 'M12 20.5v-11m0 0 4 4m-4-4-4 4M4.5 4.5h15',
  cpu: 'M7.5 7.5h9v9h-9zM5.5 5.5h13v13h-13zM9.5 2.5v3M14.5 2.5v3M9.5 18.5v3M14.5 18.5v3M2.5 9.5h3M2.5 14.5h3M18.5 9.5h3M18.5 14.5h3',
}

export type IconName = keyof typeof PATHS

export function Icon({
  name,
  size = 16,
  strokeWidth = 1.6,
  className,
  filled = false,
}: {
  name: IconName | string
  size?: number
  strokeWidth?: number
  className?: string
  filled?: boolean
}) {
  const d = PATHS[name] ?? PATHS.other
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={filled ? 'currentColor' : 'none'}
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      <path d={d} />
    </svg>
  )
}

/** Icon + accent colour for each file category. */
export const KIND_STYLE: Record<FileKind, { icon: IconName; color: string }> = {
  folder: { icon: 'folder', color: 'var(--accent-blue)' },
  image: { icon: 'image', color: '#ff7ab8' },
  video: { icon: 'video', color: '#b07cff' },
  audio: { icon: 'audio', color: '#3ddc97' },
  document: { icon: 'text', color: '#5aa9ff' },
  pdf: { icon: 'pdf', color: '#ff6b6b' },
  text: { icon: 'text', color: '#9aa3c0' },
  code: { icon: 'code', color: '#4fd1c5' },
  archive: { icon: 'archive', color: '#ffb648' },
  application: { icon: 'application', color: '#8f9bff' },
  font: { icon: 'font', color: '#d9a7ff' },
  disk: { icon: 'disk', color: '#7ec8ff' },
  shortcut: { icon: 'shortcut', color: '#9aa3c0' },
  other: { icon: 'other', color: '#8a92ad' },
}

export function KindIcon({ kind, size = 16 }: { kind: FileKind; size?: number }) {
  const style = KIND_STYLE[kind] ?? KIND_STYLE.other
  return (
    <span style={{ color: style.color, display: 'grid', placeItems: 'center' }}>
      <Icon name={style.icon} size={size} />
    </span>
  )
}
