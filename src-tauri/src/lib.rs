pub mod archives;
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
use std::sync::Mutex;
use tauri::Manager;

/// A folder path the OS launched us with (double-clicking a folder/drive
/// once Tanjiro Flow is set as the default handler). Read once by the
/// frontend on startup via `commands::startup_path`, then cleared.
pub struct StartupPath(pub Mutex<Option<String>>);

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .manage(SharingState::new())
        .manage(StartupPath(Mutex::new(startup_path_from_args())))
        .setup(|app| {
            let handle = app.handle().clone();
            let state = app.state::<SharingState>();
            commands::start_sharing(handle, &state);
            Ok(())
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
