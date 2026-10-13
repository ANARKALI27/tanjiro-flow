pub mod archives;
pub mod autostart;
pub mod commands;
pub mod converter;
pub mod default_manager;
pub mod drives;
pub mod error;
pub mod filesystem;
pub mod icons;
pub mod preview;
pub mod search;
pub mod shell;
pub mod sharing;

use sharing::SharingState;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Mutex;
use tauri::menu::{Menu, MenuItem};
use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};
use tauri::{Manager, WindowEvent};
use tauri_plugin_global_shortcut::{GlobalShortcutExt, Shortcut, ShortcutState};

/// Default global shortcut that brings Tanjiro Flow to the front from
/// anywhere in Windows, the way Win+E does for File Explorer. Shown as
/// the default in Settings too, and kept in sync with it there.
pub const DEFAULT_GLOBAL_SHORTCUT: &str = "ctrl+shift+e";

/// Whether closing the main window should hide it to the tray instead of
/// quitting the app. Settings syncs this from its own persisted value on
/// startup and on every change (see `commands::minimize_to_tray_set`), so
/// the window-close handler — which runs on the main thread without easy
/// access to the frontend's store — always has an up-to-date answer.
/// Defaults to true: the whole point of the global shortcut is that it
/// can bring Tanjiro Flow back after the window is "closed", which only
/// works if closing kept the process (and its tray icon) alive.
pub static MINIMIZE_TO_TRAY: AtomicBool = AtomicBool::new(true);

/// A folder path the OS launched us with (double-clicking a folder/drive
/// once Tanjiro Flow is set as the default handler). Read once by the
/// frontend on startup via `commands::startup_path`, then cleared.
pub struct StartupPath(pub Mutex<Option<String>>);

/// Whether we were launched with `--minimized` (set by the autostart
/// registry entry — see `autostart/mod.rs`), meaning the main window
/// should stay hidden in the tray instead of showing on startup the way
/// a normal launch does.
fn launched_minimized() -> bool {
    std::env::args().any(|a| a == "--minimized")
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(
            tauri_plugin_global_shortcut::Builder::new()
                .with_handler(|app, _shortcut, event| {
                    // Any registered shortcut currently just brings the main
                    // window forward — that's the only thing this feature
                    // does today, so we don't need to match on which one fired.
                    if event.state() == ShortcutState::Pressed {
                        show_and_focus_main_window(app);
                    }
                })
                .build(),
        )
        .manage(SharingState::new())
        .manage(StartupPath(Mutex::new(startup_path_from_args())))
        .setup(|app| {
            let handle = app.handle().clone();
            let state = app.state::<SharingState>();
            commands::start_sharing(handle, &state);

            // Register the default shortcut on startup unless the user has
            // disabled it or picked a different one — the frontend reads
            // that choice from its own persisted settings and, when it
            // differs from the default, immediately calls
            // `commands::set_global_shortcut` to replace this registration.
            // Registering a reasonable default here (rather than waiting on
            // the frontend) means the shortcut works from the very first
            // launch, before any JS has run.
            if let Ok(shortcut) = DEFAULT_GLOBAL_SHORTCUT.parse::<Shortcut>() {
                let _ = app.global_shortcut().register(shortcut);
            }

            // Tray icon: lets Tanjiro Flow keep running (and keep
            // listening for the global shortcut) after the window is
            // "closed", the same way most tray-resident Windows apps
            // work. Left-clicking the icon brings the window back;
            // right-clicking opens a small menu with a real Quit, since
            // otherwise there would be no way to fully exit once the
            // window itself no longer offers it.
            let open_item = MenuItem::with_id(app, "open", "Open Tanjiro Flow", true, None::<&str>)?;
            let quit_item = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;
            let tray_menu = Menu::with_items(app, &[&open_item, &quit_item])?;

            // If Windows launched us from the autostart registry entry
            // (see autostart/mod.rs), start hidden in the tray rather than
            // popping the window in the user's face right after login.
            if launched_minimized() {
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.hide();
                }
            }

            TrayIconBuilder::with_id("main")
                .icon(app.default_window_icon().cloned().expect("app icon"))
                .tooltip("Tanjiro Flow")
                .menu(&tray_menu)
                .show_menu_on_left_click(false)
                .on_menu_event(|app, event| match event.id.as_ref() {
                    "open" => show_and_focus_main_window(app),
                    "quit" => app.exit(0),
                    _ => {}
                })
                .on_tray_icon_event(|tray, event| {
                    if let TrayIconEvent::Click { button: MouseButton::Left, button_state: MouseButtonState::Up, .. } = event {
                        show_and_focus_main_window(tray.app_handle());
                    }
                })
                .build(app)?;

            Ok(())
        })
        .on_window_event(|window, event| {
            // Closing the window hides it to the tray instead of quitting,
            // as long as the user hasn't turned that off in Settings — the
            // tray icon (and the process behind it) is what lets the
            // global shortcut bring Tanjiro Flow back after a "close".
            if window.label() == "main" {
                if let WindowEvent::CloseRequested { api, .. } = event {
                    if MINIMIZE_TO_TRAY.load(Ordering::Relaxed) {
                        api.prevent_close();
                        let _ = window.hide();
                    }
                }
            }
        })
        .invoke_handler(tauri::generate_handler![
            commands::fs_list_dir,
            commands::fs_entry,
            commands::fs_folder_stats,
            commands::fs_read_text_head,
            commands::fs_create_folder,
            commands::fs_create_file,
            commands::fs_rename,
            commands::fs_delete,
            commands::fs_copy,
            commands::fs_move,
            commands::fs_places,
            commands::drives_list,
            commands::search_files,
            commands::search_category,
            commands::shell_open,
            commands::shell_open_with,
            commands::shell_reveal,
            commands::fs_file_icon,
            commands::archive_compress,
            commands::archive_extract,
            commands::archive_list,
            commands::preview_plan,
            commands::app_info,
            commands::devices_self_info,
            commands::devices_set_name,
            commands::devices_list,
            commands::share_send_files,
            commands::share_respond,
            commands::shared_received_list,
            commands::shared_open_folder,
            commands::converter_supported_targets,
            commands::converter_convert,
            commands::default_manager_status,
            commands::default_manager_set,
            commands::startup_path,
            commands::global_shortcut_set,
            commands::minimize_to_tray_set,
            commands::app_quit,
            commands::autostart_status,
            commands::autostart_set,
        ])
        .run(tauri::generate_context!())
        .expect("error while running Tanjiro Flow");
}

/// The first command-line argument, if it names a folder or drive that
/// exists — this is how Windows launches us when we're set as the default
/// file manager (`"Tanjiro Flow.exe" "C:\\path\\to\\folder"`).
fn startup_path_from_args() -> Option<String> {
    let arg = std::env::args().nth(1)?;
    let path = std::path::Path::new(&arg);
    if path.is_dir() {
        Some(arg)
    } else {
        None
    }
}

/// Un-minimize, show, and focus the main window — what every global
/// shortcut registration does. We only ever have one window ("main").
pub fn show_and_focus_main_window(app: &tauri::AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.unminimize();
        let _ = window.show();
        let _ = window.set_focus();
    }
}
