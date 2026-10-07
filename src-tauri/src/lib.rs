pub mod archives;
pub mod commands;
pub mod converter;
pub mod drives;
pub mod error;
pub mod filesystem;
pub mod icons;
pub mod preview;
pub mod search;
pub mod shell;
pub mod sharing;

use sharing::SharingState;
use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .manage(SharingState::new())
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
        ])
        .run(tauri::generate_context!())
        .expect("error while running Tanjiro Flow");
}
