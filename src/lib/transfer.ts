import { listen } from '@tauri-apps/api/event'
import { api } from './ipc'
import { formatBytes, formatDuration, pluralize } from './format'
import type { ConflictPolicy, CopyProgressEvent, OpOutcome } from './types'
import { useNotifications } from '../stores/notifications'
import { useNav } from '../stores/navigation'

function makeOpId(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `op-${Date.now()}-${Math.random().toString(36).slice(2)}`
}

/**
 * Runs a copy/move through the backend while keeping a toast updated with
 * live bytes transferred, speed, and ETA, and nudging any pane that's open
 * on `destDir` to reload as new items land instead of only once the whole
 * transfer finishes. Every caller — the paste shortcut, the context menu,
 * and both in-app and OS-file drag-and-drop — goes through this so the
 * experience is identical everywhere.
 *
 * The toast is owned entirely by this function (pushed, updated, and
 * dismissed here); callers just get the OpOutcome back, or a thrown error,
 * to report however they already do.
 */
export async function runTransfer(
  mode: 'copy' | 'move',
  paths: string[],
  destDir: string,
  policy: ConflictPolicy = 'rename',
): Promise<OpOutcome> {
  const { push, update, dismiss } = useNotifications.getState()
  const opId = makeOpId()

  const id = push({
    tone: 'progress',
    title: mode === 'copy' ? 'Copying…' : 'Moving…',
    body: pluralize(paths.length, 'item'),
    // Stays up for the whole transfer — the default 4.2s toast timeout
    // would otherwise hide it well before a large copy finishes.
    timeout: undefined,
  })

  let lastSampleAt = Date.now()
  let lastSampleBytes = 0
  let speedBps = 0
  let lastReloadAt = 0

  const unlisten = await listen<CopyProgressEvent>('fs://copy-progress', (e) => {
    const p = e.payload
    if (p.opId !== opId) return

    const now = Date.now()
    const elapsedS = (now - lastSampleAt) / 1000
    if (elapsedS > 0.25) {
      const instantBps = (p.bytesDone - lastSampleBytes) / elapsedS
      // Smoothed so the readout doesn't jitter with every disk-buffer flush.
      speedBps = speedBps === 0 ? instantBps : speedBps * 0.7 + instantBps * 0.3
      lastSampleAt = now
      lastSampleBytes = p.bytesDone
    }

    const fraction = p.bytesTotal > 0 ? Math.min(1, p.bytesDone / p.bytesTotal) : undefined
    const remainingBytes = p.bytesTotal - p.bytesDone
    const eta = speedBps > 1024 && remainingBytes > 0 ? formatDuration(remainingBytes / speedBps) : null

    const stats: string[] = []
    if (p.bytesTotal > 0) stats.push(`${formatBytes(p.bytesDone)} of ${formatBytes(p.bytesTotal)}`)
    if (speedBps > 1024) stats.push(`${formatBytes(speedBps)}/s`)
    if (eta) stats.push(`${eta} left`)
    if (stats.length === 0) stats.push(`${p.filesDone} of ${pluralize(p.filesTotal, 'item')}`)

    update(id, {
      body: [p.currentFile, stats.join(' • ')].filter(Boolean).join('\n'),
      progress: fraction,
    })

    // Let the destination pane show new items as they land, not just once
    // the whole transfer finishes.
    if (now - lastReloadAt > 500) {
      const panes = useNav.getState().panes
      if (panes[0].path === destDir || panes[1].path === destDir) {
        lastReloadAt = now
        useNav.getState().reload()
      }
    }
  })

  try {
    return mode === 'copy'
      ? await api.copy(paths, destDir, policy, opId)
      : await api.move(paths, destDir, policy, opId)
  } finally {
    unlisten()
    dismiss(id)
  }
}
