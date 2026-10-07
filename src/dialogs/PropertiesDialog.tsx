import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useDialogs } from '../stores/dialogs'
import { api } from '../lib/ipc'
import { formatBytes, formatDate, parentOf, pluralize } from '../lib/format'
import { KindIcon } from '../lib/icons'
import type { FlowError, FolderStats } from '../lib/types'
import { Spinner } from '../components/Primitives'
import { useMotionScale } from '../hooks/useMotionScale'

export function PropertiesDialog() {
  const pending = useDialogs((s) => s.pending)
  const close = useDialogs((s) => s.close)
  const entries = pending?.kind === 'properties' ? pending.entries : null
  const [stats, setStats] = useState<FolderStats | null>(null)
  const [statsError, setStatsError] = useState<FlowError | null>(null)
  const [computing, setComputing] = useState(false)
  const scale = useMotionScale()

  const single = entries && entries.length === 1 ? entries[0] : null
  const folderTarget = single?.isDir ? single : null

  useEffect(() => {
    setStats(null)
    setStatsError(null)
    if (!folderTarget) return
    setComputing(true)
    api
      .folderStats(folderTarget.path, 150_000)
      .then(setStats)
      .catch((e: FlowError) => setStatsError(e))
      .finally(() => setComputing(false))
  }, [folderTarget?.path])

  const hasEntries = !!entries && entries.length > 0

  const totalSize = single
    ? single.isDir
      ? stats?.totalSize
      : single.size
    : entries?.reduce((sum, e) => sum + e.size, 0)

  return (
    <AnimatePresence>
      {hasEntries && entries && (
        <motion.div
          className="overlay"
          onClick={() => close()}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 * scale }}
        >
          <motion.div
            className="dialog"
            onClick={(e) => e.stopPropagation()}
            initial={{ opacity: 0, scale: 0.96, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: 4 }}
            transition={{ duration: 0.18 * scale, ease: [0.16, 1, 0.3, 1] }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 4 }}>
          <span
            style={{
              width: 40,
              height: 40,
              borderRadius: 12,
              background: 'var(--surface-2)',
              display: 'grid',
              placeItems: 'center',
              flex: 'none',
            }}
          >
            <KindIcon kind={single?.kind ?? 'folder'} size={22} />
          </span>
          <div style={{ minWidth: 0 }}>
            <h2 style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {single ? single.name : `${pluralize(entries.length, 'item')} selected`}
            </h2>
          </div>
        </div>

        <dl className="kv" style={{ marginTop: 16 }}>
          {single && (
            <>
              <dt>Type</dt>
              <dd>{single.isDir ? 'Folder' : single.extension ? `.${single.extension} file` : 'File'}</dd>
              <dt>Location</dt>
              <dd style={{ userSelect: 'text' }}>{parentOf(single.path) ?? single.path}</dd>
            </>
          )}

          <dt>Size</dt>
          <dd>
            {totalSize !== undefined ? (
              formatBytes(totalSize)
            ) : computing ? (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <Spinner /> Calculating…
              </span>
            ) : statsError ? (
              'Unavailable'
            ) : (
              '—'
            )}
          </dd>

          {folderTarget && stats && (
            <>
              <dt>Contains</dt>
              <dd>
                {pluralize(stats.files, 'file')}, {pluralize(stats.folders, 'folder')}
                {stats.truncated ? ' (partial — very large folder)' : ''}
              </dd>
            </>
          )}

          {single && (
            <>
              <dt>Created</dt>
              <dd>{formatDate(single.created)}</dd>
              <dt>Modified</dt>
              <dd>{formatDate(single.modified)}</dd>
              <dt>Accessed</dt>
              <dd>{formatDate(single.accessed)}</dd>
              <dt>Attributes</dt>
              <dd>
                {[single.readonly && 'Read-only', single.hidden && 'Hidden', single.system && 'System']
                  .filter(Boolean)
                  .join(', ') || 'Normal'}
              </dd>
            </>
          )}

          {!single && (
            <>
              <dt>Items</dt>
              <dd>{pluralize(entries.length, 'item')}</dd>
            </>
          )}
        </dl>

        <div className="dialog-actions">
          {single && (
            <button
              className="btn btn-ghost"
              style={{ marginRight: 'auto' }}
              onClick={() => api.reveal(single.path)}
            >
              Open Location
            </button>
          )}
          <button className="btn btn-primary" onClick={() => close()}>
            Close
          </button>
        </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
