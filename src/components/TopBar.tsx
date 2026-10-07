import { Icon } from '../lib/icons'
import appLogo from '../assets/app-logo.svg'
import { useNav } from '../stores/navigation'
import { useSettings } from '../stores/settings'

export function TopBar({ onOpenPalette }: { onOpenPalette: () => void }) {
  const collapsed = useSettings((s) => s.sidebarCollapsed)
  const setSetting = useSettings((s) => s.set)
  const dualPane = useSettings((s) => s.dualPane)
  const route = useNav((s) => s.route)
  const settingsTab = useNav((s) => s.settingsTab)
  const openSettings = useNav((s) => s.openSettings)

  return (
    <header className="topbar" data-collapsed={collapsed}>
      <div className="brand">
        <button
          className="icon-btn"
          style={{ marginLeft: -6 }}
          onClick={() => setSetting('sidebarCollapsed', !collapsed)}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          <Icon name="sidebarIcon" size={17} />
        </button>
        {!collapsed && (
          <>
            <span className="brand-mark" aria-hidden="true">
              <img src={appLogo} alt="" width={26} height={26} />
            </span>
            <span className="brand-text">
              <span className="brand-name">
                Tanjiro <span>Flow</span>
              </span>
              <span className="brand-tagline">Developed by ANARKALI</span>
            </span>
          </>
        )}
      </div>

      <button className="search-trigger" onClick={onOpenPalette} aria-label="Open search and commands">
        <Icon name="search" size={15} />
        <span className="search-trigger-text">
          Search files, folders, apps, or type a command…
        </span>
        <kbd className="kbd">Ctrl K</kbd>
      </button>

      <div className="topbar-actions">
        <button
          className="icon-btn"
          data-active={dualPane}
          aria-label="Toggle dual pane"
          onClick={() => setSetting('dualPane', !dualPane)}
        >
          <Icon name="dual" size={16} />
        </button>
        <button
          className="icon-btn"
          data-active={route === 'settings' && settingsTab === 'appearance'}
          aria-label="Customize appearance"
          onClick={() => openSettings('appearance')}
        >
          <Icon name="palette" size={17} />
        </button>
        <button
          className="icon-btn"
          data-active={route === 'settings' && settingsTab !== 'appearance'}
          aria-label="Settings"
          onClick={() => openSettings('behavior')}
        >
          <Icon name="settings" size={17} />
        </button>
      </div>
    </header>
  )
}
