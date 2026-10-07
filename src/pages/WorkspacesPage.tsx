import { useState } from 'react'
import { Icon } from '../lib/icons'
import { useWorkspaces } from '../stores/workspaces'
import { useNav } from '../stores/navigation'
import { useSettings } from '../stores/settings'
import { dialogs } from '../stores/dialogs'
import { notify } from '../stores/notifications'
import { Empty } from '../components/Primitives'
import { splitPath } from '../lib/format'

const COLORS = ['#7c5cff', '#3d8bff', '#ff5ca8', '#3ae2c5', '#ffb648', '#ff6b6b']

export function WorkspacesPage() {
  const workspaces = useWorkspaces((s) => s.workspaces)
  const create = useWorkspaces((s) => s.create)
  const remove = useWorkspaces((s) => s.remove)
  const touch = useWorkspaces((s) => s.touch)
  const setActive = useWorkspaces((s) => s.setActive)
  const nav = useNav()
  const viewMode = useSettings((s) => s.viewMode)
  const dualPane = useSettings((s) => s.dualPane)
  const sortKey = useSettings((s) => s.sortKey)
  const sortDir = useSettings((s) => s.sortDir)
  const setSetting = useSettings((s) => s.set)
  const [colorIdx, setColorIdx] = useState(0)

  const saveCurrent = async () => {
    const currentPath = nav.panes[nav.active].path
    if (!currentPath) {
      notify.info('Open a folder first', 'Browse to a location before saving it as a workspace.')
      return
    }
    const name = await dialogs.prompt({
      title: 'New workspace',
      label: 'Workspace name',
      initial: splitPath(currentPath).slice(-1)[0] ?? 'Workspace',
      confirmLabel: 'Create',
    })
    if (!name) return
    const paths = dualPane ? [nav.panes[0].path, nav.panes[1].path].filter(Boolean) : [currentPath]
    create({
      name: name.trim(),
      color: COLORS[colorIdx % COLORS.length],
      paths,
      dual: dualPane,
      viewMode,
      sortKey,
      sortDir,
    })
    setColorIdx((i) => i + 1)
    notify.success(`Workspace "${name.trim()}" created`)
  }

  const openWorkspace = (id: string) => {
    const ws = workspaces.find((w) => w.id === id)
    if (!ws) return
    touch(id)
    setActive(id)
    setSetting('viewMode', ws.viewMode)
    setSetting('sortKey', ws.sortKey)
    setSetting('sortDir', ws.sortDir)
    setSetting('dualPane', ws.dual)
    if (ws.paths[0]) nav.go(ws.paths[0], 0)
    if (ws.dual && ws.paths[1]) nav.go(ws.paths[1], 1)
    nav.setRoute('files')
  }

  return (
    <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 18 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h2 style={{ fontSize: 15, margin: '0 0 3px' }}>Workspaces</h2>
          <p style={{ fontSize: 12, color: 'var(--text-dim)', margin: 0 }}>
            Save a set of open folders and how you’re viewing them, to jump back in later.
          </p>
        </div>
        <button className="btn btn-primary" onClick={saveCurrent}>
          <Icon name="plus" size={15} />
          Save Current as Workspace
        </button>
      </div>

      {workspaces.length === 0 ? (
        <Empty
          icon="workspace"
          title="No workspaces yet"
          body="Browse to the folders you use together, then save them as a workspace to restore them in one click."
        />
      ) : (
        <div className="drive-grid">
          {workspaces.map((w) => (
            <div key={w.id} className="drive-card" style={{ cursor: 'default' }}>
              <div className="drive-head">
                <span
                  style={{
                    width: 34,
                    height: 34,
                    borderRadius: 10,
                    background: `${w.color}26`,
                    color: w.color,
                    display: 'grid',
                    placeItems: 'center',
                    flex: 'none',
                  }}
                >
                  <Icon name="workspace" size={17} />
                </span>
                <div style={{ minWidth: 0 }}>
                  <div className="drive-name">{w.name}</div>
                  <div className="drive-letter">
                    {w.paths.length} {w.paths.length === 1 ? 'location' : 'locations'}
                  </div>
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                {w.paths.map((p) => (
                  <div
                    key={p}
                    style={{
                      fontSize: 11,
                      color: 'var(--text-faint)',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      fontFamily: 'var(--font-mono)',
                    }}
                  >
                    {p}
                  </div>
                ))}
              </div>
              <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
                <button className="btn btn-sm btn-primary" style={{ flex: 1 }} onClick={() => openWorkspace(w.id)}>
                  Open
                </button>
                <button
                  className="btn btn-sm btn-ghost"
                  onClick={async () => {
                    const r = await dialogs.confirm({
                      title: `Delete "${w.name}"?`,
                      body: 'This only removes the saved workspace, not the files in it.',
                      confirmLabel: 'Delete',
                      danger: true,
                    })
                    if (r === 'confirm') remove(w.id)
                  }}
                >
                  <Icon name="trash" size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
