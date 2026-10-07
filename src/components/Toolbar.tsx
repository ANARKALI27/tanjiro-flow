import { Icon, type IconName } from '../lib/icons'
import { splitPath } from '../lib/format'
import { useNav } from '../stores/navigation'
import { useSettings } from '../stores/settings'
import type { SortKey, ViewMode } from '../lib/types'
import { useFileActions } from '../hooks/useFileActions'

const VIEWS: { mode: ViewMode; icon: IconName; label: string }[] = [
  { mode: 'grid', icon: 'grid', label: 'Grid' },
  { mode: 'list', icon: 'list', label: 'List' },
  { mode: 'details', icon: 'columns', label: 'Details' },
  { mode: 'gallery', icon: 'gallery', label: 'Gallery' },
]

const SORTS: { key: SortKey; label: string }[] = [
  { key: 'name', label: 'Name' },
  { key: 'size', label: 'Size' },
  { key: 'modified', label: 'Modified' },
  { key: 'kind', label: 'Type' },
]

/** Breadcrumbs, history controls, view switching and sort. */
export function Toolbar({ pane = 0 }: { pane?: 0 | 1 }) {
  const nav = useNav()
  const path = nav.panes[pane].path
  const viewMode = useSettings((s) => s.viewMode)
  const sortKey = useSettings((s) => s.sortKey)
  const sortDir = useSettings((s) => s.sortDir)
  const showHidden = useSettings((s) => s.showHidden)
  const setSetting = useSettings((s) => s.set)
  const actions = useFileActions(pane)

  const parts = splitPath(path)

  const goToCrumb = (index: number) => {
    const target = parts.slice(0, index + 1).join('\\')
    nav.go(/^[A-Za-z]:$/.test(target) ? `${target}\\` : target, pane)
  }

  const cycleSort = (key: SortKey) => {
    if (sortKey === key) setSetting('sortDir', sortDir === 'asc' ? 'desc' : 'asc')
    else setSetting('sortKey', key)
  }

  return (
    <div className="toolbar">
      {/* Nav icons, crumbs, "New" and sort-by can all shrink or scroll away
          when a pane gets narrow (dual-pane, a collapsed window) — none of
          them stop the user from doing anything else. The hidden-files eye
          toggle and the view-mode switcher just below are the controls a
          narrow pane most needs to keep reachable, so they're pinned
          outside this scroll region instead of racing everything else for
          space; see .toolbar-scroll in components.css. */}
      <div className="toolbar-scroll">
        <div style={{ display: 'flex', gap: 1, flexShrink: 0 }}>
          <button
            className="icon-btn"
            onClick={() => nav.back(pane)}
            disabled={!nav.canBack(pane)}
            aria-label="Back"
          >
            <Icon name="arrowLeft" size={16} />
          </button>
          <button
            className="icon-btn"
            onClick={() => nav.forward(pane)}
            disabled={!nav.canForward(pane)}
            aria-label="Forward"
          >
            <Icon name="arrowRight" size={16} />
          </button>
          <button
            className="icon-btn"
            onClick={() => nav.up(pane)}
            disabled={parts.length <= 1}
            aria-label="Up one level"
          >
            <Icon name="arrowUp" size={16} />
          </button>
          <button
            className="icon-btn"
            onClick={() => nav.reload()}
            aria-label="Refresh"
          >
            <Icon name="refresh" size={16} />
          </button>
        </div>

        <div className="crumbs">
          {parts.length === 0 ? (
            <span className="crumb" style={{ color: 'var(--text-faint)' }}>
              No folder open
            </span>
          ) : (
            parts.map((part, i) => (
              <span key={`${part}-${i}`} style={{ display: 'contents' }}>
                {i > 0 && (
                  <span className="crumb-sep">
                    <Icon name="chevronRight" size={12} />
                  </span>
                )}
                <button className="crumb" onClick={() => goToCrumb(i)}>
                  {part}
                </button>
              </span>
            ))
          )}
        </div>

        <button className="btn btn-sm" onClick={actions.newFolder} disabled={!path}>
          <Icon name="folderPlus" size={15} />
          New
        </button>

        <div className="segmented" role="group" aria-label="Sort by">
          {SORTS.map((s) => (
            <button
              key={s.key}
              className="icon-btn sort-item"
              data-active={sortKey === s.key}
              onClick={() => cycleSort(s.key)}
            >
              {s.label}
              {sortKey === s.key ? (
                <Icon name={sortDir === 'asc' ? 'chevronUp' : 'chevronDown'} size={11} />
              ) : null}
            </button>
          ))}
        </div>
      </div>

      <button
        className="icon-btn"
        data-active={showHidden}
        onClick={() => setSetting('showHidden', !showHidden)}
        aria-label="Toggle hidden items"
      >
        <Icon name="eye" size={16} />
      </button>

      <div className="segmented" role="group" aria-label="View mode">
        {VIEWS.map((v) => (
          <button
            key={v.mode}
            className="icon-btn"
            data-active={viewMode === v.mode}
            onClick={() => setSetting('viewMode', v.mode)}
            aria-label={v.label}
          >
            <Icon name={v.icon} size={15} />
          </button>
        ))}
      </div>
    </div>
  )
}
