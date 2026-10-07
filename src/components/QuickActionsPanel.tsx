import { Icon } from '../lib/icons'
import type { FileEntry } from '../lib/types'
import type { FileActions } from '../hooks/useFileActions'
import { pluralize } from '../lib/format'

/**
 * The contextual actions strip. Which buttons show — and whether they're
 * enabled — depends on what's selected, per the spec ("panel should update
 * depending on the selected file type").
 */
export function QuickActionsPanel({
  entries,
  actions,
  onShare,
}: {
  entries: FileEntry[]
  actions: FileActions
  onShare: (entries: FileEntry[]) => void
}) {
  if (entries.length === 0) {
    return (
      <div className="panel-card">
        <div className="panel-head">Quick Actions</div>
        <p style={{ fontSize: 12, color: 'var(--text-faint)' }}>
          Select a file or folder to see actions.
        </p>
      </div>
    )
  }

  const single = entries.length === 1 ? entries[0] : null;
  const isArchive = single?.extension === 'zip';

  return (
    <div className="panel-card">
      <div className="panel-head">
        Quick Actions {entries.length > 1 ? `· ${pluralize(entries.length, 'item')}` : ''}
      </div>
      <div className="qa-grid">
        <button className="qa-btn" disabled={!single} onClick={() => single && actions.open(single)}>
          <Icon name="externalLink" size={17} />
          Open
        </button>
        <button className="qa-btn" onClick={() => onShare(entries)}>
          <Icon name="share" size={17} />
          Share
        </button>
        <button className="qa-btn" onClick={() => actions.compress(entries)}>
          <Icon name="archive" size={17} />
          Compress
        </button>
        <button
          className="qa-btn"
          disabled={!isArchive || !single}
          onClick={() => single && actions.extract(single, true)}
        >
          <Icon name="convert" size={17} />
          Extract
        </button>
        <button className="qa-btn" disabled={!single} onClick={() => single && actions.rename(single)}>
          <Icon name="pencil" size={17} />
          Rename
        </button>
        <button className="qa-btn" onClick={() => actions.remove(entries)}>
          <Icon name="trash" size={17} />
          Delete
        </button>
      </div>
    </div>
  )
}
