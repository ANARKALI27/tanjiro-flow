import { Icon, type IconName } from '../lib/icons'
import { formatBytes } from '../lib/format'
import { useNav, type RouteId } from '../stores/navigation'
import { useSettings, type SectionKey } from '../stores/settings'
import { useSystemPlaces } from '../hooks/useDrives'
import { Meter } from './Primitives'
import type { DriveInfo } from '../lib/types'

interface NavItem {
  key: SectionKey
  route: RouteId
  label: string
  icon: IconName
}

const MAIN: NavItem[] = [
  { key: 'home', route: 'home', label: 'Home', icon: 'home' },
  { key: 'files', route: 'files', label: 'Files', icon: 'folder' },
  { key: 'recent', route: 'recent', label: 'Recent', icon: 'clock' },
  { key: 'starred', route: 'starred', label: 'Starred', icon: 'star' },
  { key: 'shared', route: 'shared', label: 'Shared With Me', icon: 'share' },
]

const ACTIVITY: NavItem[] = [
  { key: 'downloads', route: 'downloads', label: 'Downloads', icon: 'download' },
  { key: 'torrents', route: 'torrents', label: 'Torrents', icon: 'magnet' },
  { key: 'devices', route: 'devices', label: 'Devices', icon: 'devices' },
  { key: 'network', route: 'network', label: 'Network', icon: 'network' },
  { key: 'workspaces', route: 'workspaces', label: 'Workspaces', icon: 'workspace' },
  { key: 'trash', route: 'trash', label: 'Trash', icon: 'trash' },
]

function DriveRow({ drive, onOpen }: { drive: DriveInfo; onOpen: (d: DriveInfo) => void }) {
  const ratio = drive.totalBytes > 0 ? drive.usedBytes / drive.totalBytes : 0
  return (
    <button
      className="drive-mini"
      onClick={() => drive.ready && onOpen(drive)}
      disabled={!drive.ready}
    >
      <div className="drive-mini-top">
        <Icon name="drive" size={15} />
        <span className="side-label">
          {drive.label} ({drive.letter})
        </span>
      </div>
      {drive.ready ? (
        <>
          <Meter ratio={ratio} />
          <div className="drive-mini-meta">
            {formatBytes(drive.freeBytes)} free of {formatBytes(drive.totalBytes)}
          </div>
        </>
      ) : (
        <div className="drive-mini-meta">Not ready</div>
      )}
    </button>
  )
}

export function Sidebar() {
  const collapsed = useSettings((s) => s.sidebarCollapsed)
  const sections = useSettings((s) => s.sections)
  const starred = useSettings((s) => s.starred)
  const route = useNav((s) => s.route)
  const setRoute = useNav((s) => s.setRoute)
  const go = useNav((s) => s.go)
  const currentPath = useNav((s) => s.panes[s.active].path)
  const { drives, places } = useSystemPlaces()

  const visible = (items: NavItem[]) => items.filter((i) => sections[i.key])

  const renderItem = (item: NavItem) => (
    <button
      key={item.key}
      className="side-item"
      data-active={route === item.route}
      onClick={() => setRoute(item.route)}
    >
      <Icon name={item.icon} size={16} />
      <span className="side-label">{item.label}</span>
      {item.key === 'starred' && starred.length > 0 ? (
        <span className="side-count">{starred.length}</span>
      ) : null}
    </button>
  )

  return (
    <nav className="sidebar" data-collapsed={collapsed} aria-label="Main navigation">
      <div className="sidebar-scroll">
        {visible(MAIN).map(renderItem)}

        {sections.quickAccess && places.length > 0 && (
          <>
            <div className="side-heading">Quick Access</div>
            {places.map((p) => (
              <button
                key={p.id}
                className="side-item"
                data-active={route === 'files' && currentPath === p.path}
                onClick={() => go(p.path)}
              >
                <Icon name={p.id === 'home' ? 'home' : 'folder'} size={16} />
                <span className="side-label">{p.label}</span>
              </button>
            ))}
          </>
        )}

        {visible(ACTIVITY).length > 0 && (
          <>
            <div className="side-heading">Activity</div>
            {visible(ACTIVITY).map(renderItem)}
          </>
        )}

        {sections.drives && drives.length > 0 && (
          <>
            <div className="side-heading">Drives</div>
            {drives.map((d) => (
              <DriveRow key={d.letter} drive={d} onOpen={(drive) => go(drive.path)} />
            ))}
          </>
        )}
      </div>

      <button
        className="side-item"
        data-active={route === 'settings'}
        onClick={() => setRoute('settings')}
      >
        <Icon name="settings" size={16} />
        <span className="side-label">Settings</span>
      </button>
    </nav>
  )
}
