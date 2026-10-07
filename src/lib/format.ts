const UNITS = ['B', 'KB', 'MB', 'GB', 'TB', 'PB']

/** 1_536 -> "1.5 KB". Uses 1024 steps, like Windows does. */
export function formatBytes(bytes: number, precision?: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return '—'
  if (bytes === 0) return '0 B'
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), UNITS.length - 1)
  const value = bytes / Math.pow(1024, i)
  const digits = precision ?? (i === 0 ? 0 : value >= 100 ? 0 : value >= 10 ? 1 : 2)
  return `${value.toFixed(digits)} ${UNITS[i]}`
}

export function formatDate(ms: number | null): string {
  if (!ms) return '—'
  const d = new Date(ms)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function formatRelative(ms: number | null): string {
  if (!ms) return '—'
  const diff = Date.now() - ms
  const mins = Math.round(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.round(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.round(hours / 24)
  if (days < 30) return `${days}d ago`
  return formatDate(ms).split(',')[0]
}

/** "C:\Users\me\Pictures" -> ["C:", "Users", "me", "Pictures"] */
export function splitPath(path: string): string[] {
  return path.split(/[\\/]+/).filter(Boolean)
}

export function joinPath(...parts: string[]): string {
  return parts
    .filter(Boolean)
    .join('\\')
    .replace(/\\{2,}/g, '\\')
}

export function parentOf(path: string): string | null {
  const parts = splitPath(path)
  if (parts.length <= 1) return null
  const parent = parts.slice(0, -1).join('\\')
  // "C:" alone is not a valid path to open — it must be "C:\".
  return /^[A-Za-z]:$/.test(parent) ? `${parent}\\` : parent
}

export function basename(path: string): string {
  const parts = splitPath(path)
  return parts[parts.length - 1] ?? path
}

/** Split "photo.jpeg" into ["photo", ".jpeg"] so rename can preselect the stem. */
export function splitName(name: string): [string, string] {
  const dot = name.lastIndexOf('.')
  if (dot <= 0) return [name, '']
  return [name.slice(0, dot), name.slice(dot)]
}

export function pluralize(n: number, one: string, many = `${one}s`): string {
  return `${n.toLocaleString()} ${n === 1 ? one : many}`
}
