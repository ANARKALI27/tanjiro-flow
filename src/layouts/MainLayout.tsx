import type { ReactNode } from 'react'
import { Sidebar } from '../components/Sidebar'
import { TopBar } from '../components/TopBar'
import { useSettings } from '../stores/settings'

export function MainLayout({
  children,
  onOpenPalette,
}: {
  children: ReactNode
  onOpenPalette: () => void
}) {
  const collapsed = useSettings((s) => s.sidebarCollapsed)
  return (
    <div className="app">
      <TopBar onOpenPalette={onOpenPalette} />
      <div className="app-body" data-collapsed={collapsed}>
        <Sidebar />
        <main className="app-main">{children}</main>
      </div>
    </div>
  )
}
