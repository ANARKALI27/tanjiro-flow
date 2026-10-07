use crate::archives;
use crate::converter::{self, ConvertOutcome};
use crate::default_manager;
use crate::drives::{self, DriveInfo};
use crate::error::{FlowError, FlowResult};
use crate::filesystem::{self, ConflictPolicy, DirListing, FileEntry, FolderStats, OpOutcome};
use crate::icons;
use crate::preview::{self, PreviewPlan};
use crate::search::{self, Category, SearchOptions};
use crate::sharing::discovery::{self, DeviceInfo};
use crate::sharing::transfer;
use crate::sharing::{DeviceIdentity, ReceivedItem, SharingState};
use crate::shell;
use serde::Serialize;
use crate::StartupPath;
use tauri::{AppHandle, State};

/// Filesystem work is blocking. Running it on the async runtime directly would
/// stall the IPC thread and make the whole window janky, so every command that
/// touches the disk hops onto the blocking pool.
async fn blocking<T, F>(f: F) -> FlowResult<T>
where
    F: FnOnce() -> FlowResult<T> + Send + 'static,
    T: Send + 'static,
{
    tauri::async_runtime::spawn_blocking(f)
        .await
        .map_err(|e| FlowError::Other(format!("That operation couldn't be started: {e}")))?
}

// ---------------------------------------------------------------------------
// Browsing
// ---------------------------------------------------------------------------

#[tauri::command]
pub async fn fs_list_dir(path: String, show_hidden: bool) -> FlowResult<DirListing> {
    blocking(move || filesystem::list_dir(&path, show_hidden)).await
}

#[tauri::command]
pub async fn fs_entry(path: String) -> FlowResult<FileEntry> {
    blocking(move || filesystem::entry_from_path(std::path::Path::new(&path))).await
}

#[tauri::command]
pub async fn fs_folder_stats(path: String, max_entries: Option<u64>) -> FlowResult<FolderStats> {
    let cap = max_entries.unwrap_or(200_000);
    blocking(move || filesystem::folder_stats(&path, cap)).await
}

#[tauri::command]
pub async fn fs_read_text_head(path: String, max_bytes: Option<usize>) -> FlowResult<String> {
    let cap = max_bytes.unwrap_or(256 * 1024);
    blocking(move || filesystem::read_text_head(&path, cap)).await
}

// ---------------------------------------------------------------------------
// Mutating operations
// ---------------------------------------------------------------------------

#[tauri::command]
pub async fn fs_create_folder(parent: String, name: String) -> FlowResult<FileEntry> {
    blocking(move || filesystem::create_folder(&parent, &name)).await
}

#[tauri::command]
pub async fn fs_create_file(parent: String, name: String) -> FlowResult<FileEntry> {
    blocking(move || filesystem::create_file(&parent, &name)).await
}

#[tauri::command]
pub async fn fs_rename(path: String, new_name: String) -> FlowResult<FileEntry> {
    blocking(move || filesystem::rename_item(&path, &new_name)).await
}

#[tauri::command]
pub async fn fs_delete(paths: Vec<String>, permanent: bool) -> FlowResult<OpOutcome> {
    blocking(move || filesystem::delete_items(&paths, permanent)).await
}

#[tauri::command]
pub async fn fs_copy(
    sources: Vec<String>,
    dest_dir: String,
    policy: ConflictPolicy,
) -> FlowResult<OpOutcome> {
    blocking(move || filesystem::copy_items(&sources, &dest_dir, policy)).await
}

#[tauri::command]
pub async fn fs_move(
    sources: Vec<String>,
    dest_dir: String,
    policy: ConflictPolicy,
) -> FlowResult<OpOutcome> {
    blocking(move || filesystem::move_items(&sources, &dest_dir, policy)).await
}

// ---------------------------------------------------------------------------
// Places and drives
// ---------------------------------------------------------------------------

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Place {
    pub id: String,
    pub label: String,
    pub path: String,
}

#[tauri::command]
pub async fn fs_places() -> FlowResult<Vec<Place>> {
    blocking(move || {
        let mut out = Vec::new();
        let candidates: Vec<(&str, &str, Option<std::path::PathBuf>)> = vec![
            ("home", "Home", dirs::home_dir()),
            ("desktop", "Desktop", dirs::desktop_dir()),
            ("documents", "Documents", dirs::document_dir()),
            ("downloads", "Downloads", dirs::download_dir()),
            ("pictures", "Pictures", dirs::picture_dir()),
            ("videos", "Videos", dirs::video_dir()),
            ("music", "Music", dirs::audio_dir()),
        ];
        for (id, label, path) in candidates {
            if let Some(p) = path {
                if p.exists() {
                    out.push(Place {
                        id: id.to_string(),
                        label: label.to_string(),
                        path: p.to_string_lossy().to_string(),
                    });
                }
            }
        }
        Ok(out)
    })
    .await
}

#[tauri::command]
pub async fn drives_list() -> FlowResult<Vec<DriveInfo>> {
    blocking(drives::list_drives).await
}

// ---------------------------------------------------------------------------
// Search
// ---------------------------------------------------------------------------

#[tauri::command]
pub async fn search_files(options: SearchOptions) -> FlowResult<Vec<FileEntry>> {
    blocking(move || search::search(options)).await
}

#[tauri::command]
pub async fn search_category(category: Category, limit: Option<usize>) -> FlowResult<Vec<FileEntry>> {
    let cap = limit.unwrap_or(120);
    blocking(move || search::scan_category(category, cap)).await
}

// ---------------------------------------------------------------------------
// Shell
// ---------------------------------------------------------------------------

#[tauri::command]
pub async fn shell_open(path: String) -> FlowResult<()> {
    blocking(move || shell::open_path(&path)).await
}

#[tauri::command]
pub async fn shell_open_with(path: String) -> FlowResult<()> {
    blocking(move || shell::open_with(&path)).await
}

#[tauri::command]
pub async fn shell_reveal(path: String) -> FlowResult<()> {
    blocking(move || shell::reveal_in_explorer(&path)).await
}

#[tauri::command]
pub async fn fs_file_icon(path: String) -> FlowResult<String> {
    blocking(move || icons::file_icon_data_url(&path)).await
}

// ---------------------------------------------------------------------------
// Archives
// ---------------------------------------------------------------------------

#[tauri::command]
pub async fn archive_compress(
    sources: Vec<String>,
    dest: String,
) -> FlowResult<archives::ArchiveResult> {
    blocking(move || archives::compress_zip(&sources, &dest)).await
}

#[tauri::command]
pub async fn archive_extract(
    archive: String,
    dest_dir: String,
) -> FlowResult<archives::ArchiveResult> {
    blocking(move || archives::extract_zip(&archive, &dest_dir)).await
}

#[tauri::command]
pub async fn archive_list(archive: String) -> FlowResult<Vec<archives::ArchiveEntry>> {
    blocking(move || archives::list_zip(&archive)).await
}

// ---------------------------------------------------------------------------
// Preview
// ---------------------------------------------------------------------------

#[tauri::command]
pub async fn preview_plan(path: String) -> FlowResult<PreviewPlan> {
    blocking(move || preview::plan(&path)).await
}

// ---------------------------------------------------------------------------
// App
// ---------------------------------------------------------------------------

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AppInfo {
    pub name: String,
    pub version: String,
    pub platform: String,
    pub hostname: String,
}

#[tauri::command]
pub async fn app_info() -> FlowResult<AppInfo> {
    Ok(AppInfo {
        name: "Tanjiro Flow".into(),
        version: env!("CARGO_PKG_VERSION").into(),
        platform: std::env::consts::OS.into(),
        hostname: std::env::var("COMPUTERNAME")
            .or_else(|_| std::env::var("HOSTNAME"))
            .unwrap_or_else(|_| "This PC".into()),
    })
}


// ---------------------------------------------------------------------------
// Default file manager
// ---------------------------------------------------------------------------

#[tauri::command]
pub async fn default_manager_status() -> FlowResult<bool> {
    blocking(default_manager::is_default_file_manager).await
}

#[tauri::command]
pub async fn default_manager_set(enable: bool) -> FlowResult<()> {
    blocking(move || default_manager::set_default_file_manager(enable)).await
}

/// The folder Windows launched us with (set as default file manager, then a
/// folder or drive was double-clicked). Returned once per app run, then
/// cleared, so a second call — or a second window — never re-navigates.
#[tauri::command]
pub async fn startup_path(state: State<'_, StartupPath>) -> FlowResult<Option<String>> {
    Ok(state.0.lock().unwrap().take())
}


// ---------------------------------------------------------------------------
// Nearby Devices + Sharing
// ---------------------------------------------------------------------------

/// Called once at startup (see `lib.rs`) once Tauri hands us an `AppHandle`.
/// mDNS registration/browsing needs a live handle to emit events, so this
/// can't happen at `SharingState::new()` time.
pub fn start_sharing(app: AppHandle, state: &SharingState) {
    let identity = state.identity.lock().unwrap().clone();

    match discovery::start(app.clone(), &identity) {
        Ok(d) => {
            *state.discovery.lock().unwrap() = Some(d);
        }
        Err(e) => {
            eprintln!("Tanjiro Flow: device discovery didn't start: {e}");
        }
    }

    transfer::run_listener(app, state.transfer_arc(), discovery::TRANSFER_PORT);
}

#[tauri::command]
pub async fn devices_self_info(state: State<'_, SharingState>) -> FlowResult<DeviceIdentity> {
    Ok(state.identity.lock().unwrap().clone())
}

#[tauri::command]
pub async fn devices_set_name(state: State<'_, SharingState>, name: String) -> FlowResult<DeviceIdentity> {
    let trimmed = name.trim();
    if trimmed.is_empty() {
        return Err(FlowError::Other("Give this device a name first.".into()));
    }
    let mut identity = state.identity.lock().unwrap();
    identity.name = trimmed.to_string();
    crate::sharing::save_identity(&identity);
    Ok(identity.clone())
    // Note: the mDNS TXT record still shows the name this device started
    // with until the app restarts — re-registering live is future work.
}

#[tauri::command]
pub async fn devices_list(state: State<'_, SharingState>) -> FlowResult<Vec<DeviceInfo>> {
    let guard = state.discovery.lock().unwrap();
    Ok(guard.as_ref().map(|d| d.list()).unwrap_or_default())
}

#[tauri::command]
pub async fn share_send_files(
    app: AppHandle,
    state: State<'_, SharingState>,
    device_id: String,
    paths: Vec<String>,
) -> FlowResult<String> {
    let (identity, device) = {
        let identity = state.identity.lock().unwrap().clone();
        let discovery = state.discovery.lock().unwrap();
        let device = discovery
            .as_ref()
            .and_then(|d| d.list().into_iter().find(|dev| dev.id == device_id))
            .ok_or_else(|| FlowError::NotFound("That device isn't on the network anymore.".into()))?;
        (identity, device)
    };

    transfer::send_files(
        app,
        identity.id,
        identity.name,
        device.addresses,
        device.port,
        paths,
    )
    .map_err(FlowError::Other)
}

#[tauri::command]
pub async fn share_respond(
    app: AppHandle,
    state: State<'_, SharingState>,
    transfer_id: String,
    accept: bool,
) -> FlowResult<()> {
    transfer::respond(&state.transfer, transfer_id, accept, app).map_err(FlowError::Other)
}

#[tauri::command]
pub async fn shared_received_list() -> FlowResult<Vec<ReceivedItem>> {
    Ok(crate::sharing::load_received())
}

#[tauri::command]
pub async fn shared_open_folder() -> FlowResult<()> {
    blocking(|| shell::open_path(&crate::sharing::shares_dir().to_string_lossy())).await
}

// ---------------------------------------------------------------------------
// Converter registry
// ---------------------------------------------------------------------------

#[tauri::command]
pub async fn converter_supported_targets(source_ext: String) -> FlowResult<Vec<String>> {
    Ok(converter::supported_targets(&source_ext))
}

#[tauri::command]
pub async fn converter_convert(
    paths: Vec<String>,
    target_format: String,
    dest_dir: Option<String>,
) -> FlowResult<ConvertOutcome> {
    blocking(move || converter::convert(&paths, &target_format, dest_dir.as_deref())).await
}
