import { useEffect, useState } from "react";
import { AnimatePresence } from "framer-motion";
import { MainLayout } from "./layouts/MainLayout";
import { LoadingScreen } from "./components/LoadingScreen";
import { CommandPalette } from "./components/CommandPalette";
import { Toasts } from "./components/Toasts";
import { OverlayEffects } from "./components/OverlayEffects";
import { BackgroundVideo } from "./components/BackgroundVideo";
import { ConfirmDialog } from "./dialogs/ConfirmDialog";
import { PromptDialog } from "./dialogs/PromptDialog";
import { PropertiesDialog } from "./dialogs/PropertiesDialog";
import { FileBrowser } from "./components/FileBrowser";
import { QuickActionsPanel } from "./components/QuickActionsPanel";
import { PreviewPanel } from "./components/PreviewPanel";
import { ShareSheet } from "./pages/ShareSheet";
import { HomePage } from "./pages/Home";
import { CategoryPage } from "./pages/CategoryPage";
import { SharedPage } from "./pages/SharedPage";
import { DownloadsPage } from "./pages/DownloadsPage";
import { TorrentsPage } from "./pages/TorrentsPage";
import { DevicesPage } from "./pages/DevicesPage";
import { NetworkPage } from "./pages/NetworkPage";
import { TrashPage } from "./pages/TrashPage";
import { WorkspacesPage } from "./pages/WorkspacesPage";
import { SettingsPage } from "./pages/SettingsPage";
import { useSettings, applyVisualSettings } from "./stores/settings";
import { useSharing } from "./stores/sharing";
import { useNav } from "./stores/navigation";
import { useSelection } from "./stores/selection";
import { useFileActions } from "./hooks/useFileActions";
import { useHotkeys, type HotkeyMap } from "./hooks/useHotkeys";
import { api, asFlowError, assetUrl } from "./lib/ipc";
import { notify } from "./stores/notifications";
import type { FileEntry } from "./lib/types";

function FilesView({ onShare }: { onShare: (entries: FileEntry[]) => void }) {
  const dualPane = useSettings((s) => s.dualPane);
  const panels = useSettings((s) => s.panels);
  const active = useNav((s) => s.active);
  const selection = useSelection();
  const actions = useFileActions(active);

  const selected = selection.selectedEntries(active);
  const previewEntry = selected.length === 1 ? selected[0] : null;

  return (
    <div className="stage">
      <div className="stage-content">
        {dualPane ? (
          <div className="dual">
            <div className="pane-wrap" data-focused={active === 0}>
              <span className="pane-tag">Pane 1</span>
              <FileBrowser pane={0} onShare={onShare} />
            </div>
            <div className="pane-wrap" data-focused={active === 1}>
              <span className="pane-tag">Pane 2</span>
              <FileBrowser pane={1} onShare={onShare} />
            </div>
          </div>
        ) : (
          <FileBrowser pane={0} onShare={onShare} />
        )}
      </div>
      <div className="panel">
        {panels.quickActions && (
          <QuickActionsPanel entries={selected} actions={actions} onShare={onShare} />
        )}
        {panels.preview && <PreviewPanel entry={previewEntry} />}
      </div>
    </div>
  );
}

function RouteView({ onShare }: { onShare: (entries: FileEntry[]) => void }) {
  const route = useNav((s) => s.route);
  const starred = useSettings((s) => s.starred);

  switch (route) {
    case "home":
      return <HomePage />;
    case "files":
      return <FilesView onShare={onShare} />;
    case "recent":
      return (
        <CategoryPage
          category="recent"
          title="Recent"
          emptyBody="Files you open will show up here."
          onShare={onShare}
        />
      );
    case "starred":
      return (
        <CategoryPage
          category="starred"
          title="Starred"
          emptyBody="Star files to find them quickly."
          onShare={onShare}
          starredPaths={starred}
        />
      );
    case "shared":
      return <SharedPage />;
    case "downloads":
      return <DownloadsPage />;
    case "torrents":
      return <TorrentsPage />;
    case "devices":
      return <DevicesPage />;
    case "network":
      return <NetworkPage />;
    case "trash":
      return <TrashPage />;
    case "workspaces":
      return <WorkspacesPage />;
    case "settings":
      return <SettingsPage />;
    default:
      return <HomePage />;
  }
}

export default function App() {
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [shareEntries, setShareEntries] = useState<FileEntry[] | null>(null);
  const [booting, setBooting] = useState(true);

  const hotkeys: HotkeyMap = {
    "ctrl+k": () => setPaletteOpen(true),
  };
  useHotkeys(hotkeys);

  useEffect(() => {
    const state = useSettings.getState();
    applyVisualSettings(state, assetUrl);

    const unsubscribe = useSettings.subscribe((s) => {
      applyVisualSettings(s, assetUrl);
    });

    useSharing.getState().init();

    // The Rust side already registers the Ctrl+Shift+E default the moment
    // the app starts (before any JS runs), so the shortcut works from the
    // very first frame. This call just reconciles that with whatever the
    // user has actually persisted — a disabled shortcut or a custom combo
    // from a previous session — and keeps it in sync on every change.
    api
      .globalShortcutSet(state.globalShortcutEnabled, state.globalShortcutKeys)
      .catch(() => {
        // Non-fatal: the default registered on the Rust side keeps working
        // even if syncing a custom combo failed for some reason.
      });
    const unsubscribeShortcut = useSettings.subscribe((s, prev) => {
      if (
        s.globalShortcutEnabled === prev.globalShortcutEnabled &&
        s.globalShortcutKeys === prev.globalShortcutKeys
      ) {
        return
      }
      api.globalShortcutSet(s.globalShortcutEnabled, s.globalShortcutKeys).catch((e) => {
        notify.error("Couldn't update the global shortcut", asFlowError(e).message)
      })
    })

    // Same reconciliation for "minimize to tray on close" — the Rust
    // side defaults to true (matching the store's default) so the very
    // first close still behaves correctly even before this runs.
    api.minimizeToTraySet(state.minimizeToTray).catch(() => {})
    const unsubscribeTray = useSettings.subscribe((s, prev) => {
      if (s.minimizeToTray === prev.minimizeToTray) return
      api.minimizeToTraySet(s.minimizeToTray).catch((e) => {
        notify.error("Couldn't update close behavior", asFlowError(e).message)
      })
    })

    // If Windows launched us with a folder/drive path (we're set as the
    // default file manager and the user double-clicked one), jump straight
    // there instead of opening on Home.
    api
      .startupPath()
      .then((path) => {
        if (path) useNav.getState().go(path);
      })
      .catch(() => {
        // No startup path, or the platform doesn't support this — Home is
        // the right fallback either way.
      });

    // Keep the cover up for a minimum duration so it never flashes, then
    // fade it out once init has had a chance to run.
    const timer = window.setTimeout(() => setBooting(false), 500);

    return () => {
      unsubscribe();
      unsubscribeShortcut();
      unsubscribeTray();
      window.clearTimeout(timer);
    };
  }, []);

  return (
    <>
      <BackgroundVideo />
      <AnimatePresence>{booting && <LoadingScreen />}</AnimatePresence>
      <MainLayout onOpenPalette={() => setPaletteOpen(true)}>
        <RouteView onShare={setShareEntries} />
      </MainLayout>
      <OverlayEffects />
      <AnimatePresence>
        {paletteOpen && <CommandPalette onClose={() => setPaletteOpen(false)} />}
      </AnimatePresence>
      <AnimatePresence>
        {shareEntries && (
          <ShareSheet entries={shareEntries} onClose={() => setShareEntries(null)} />
        )}
      </AnimatePresence>
      <Toasts />
      <ConfirmDialog />
      <PromptDialog />
      <PropertiesDialog />
    </>
  );
}
