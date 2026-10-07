use crate::error::{FlowError, FlowResult};
use serde::{Deserialize, Serialize};
use std::fs;
use std::io::{Read, Write};
use std::path::{Path, PathBuf};
use std::time::{Instant, SystemTime, UNIX_EPOCH};
use tauri::{AppHandle, Emitter};

#[cfg(windows)]
use std::os::windows::fs::MetadataExt;

#[cfg(windows)]
const FILE_ATTRIBUTE_HIDDEN: u32 = 0x2;
#[cfg(windows)]
const FILE_ATTRIBUTE_SYSTEM: u32 = 0x4;
#[cfg(windows)]
const FILE_ATTRIBUTE_READONLY: u32 = 0x1;

/// Broad category used by the UI to pick an icon, a preview strategy and a
/// set of available actions. Kept deliberately coarse.
#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum FileKind {
    Folder,
    Image,
    Video,
    Audio,
    Document,
    Pdf,
    Text,
    Code,
    Archive,
    Application,
    Font,
    Disk,
    Shortcut,
    Other,
}

pub fn classify(path: &Path, is_dir: bool) -> FileKind {
    if is_dir {
        return FileKind::Folder;
    }
    let ext = path
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("")
        .to_ascii_lowercase();
    match ext.as_str() {
        "jpg" | "jpeg" | "png" | "gif" | "webp" | "bmp" | "svg" | "avif" | "ico" | "tif"
        | "tiff" | "heic" | "psd" | "xcf" | "raw" | "cr2" | "nef" | "dng" => FileKind::Image,
        "mp4" | "mkv" | "mov" | "avi" | "webm" | "wmv" | "flv" | "m4v" | "mpg" | "mpeg"
        | "3gp" | "m2ts" => FileKind::Video,
        "mp3" | "wav" | "flac" | "aac" | "ogg" | "m4a" | "wma" | "opus" | "aiff" => FileKind::Audio,
        "pdf" => FileKind::Pdf,
        "doc" | "docx" | "odt" | "rtf" | "xls" | "xlsx" | "ods" | "ppt" | "pptx" | "odp"
        | "pages" | "epub" => FileKind::Document,
        "txt" | "md" | "log" | "csv" | "tsv" | "ini" | "cfg" | "conf" | "nfo" => FileKind::Text,
        "json" | "yaml" | "yml" | "toml" | "xml" | "html" | "htm" | "css" | "scss" | "js"
        | "jsx" | "ts" | "tsx" | "rs" | "py" | "java" | "kt" | "c" | "h" | "cpp" | "hpp"
        | "cs" | "go" | "rb" | "php" | "swift" | "sh" | "ps1" | "bat" | "cmd" | "sql"
        | "gradle" | "lua" | "dart" | "vue" | "svelte" => FileKind::Code,
        "zip" | "7z" | "rar" | "tar" | "gz" | "bz2" | "xz" | "zst" | "cab" | "tgz" => {
            FileKind::Archive
        }
        "exe" | "msi" | "appx" | "msix" | "apk" | "jar" | "com" | "scr" => FileKind::Application,
        "ttf" | "otf" | "woff" | "woff2" | "fon" => FileKind::Font,
        "iso" | "img" | "vhd" | "vhdx" | "vmdk" | "dmg" => FileKind::Disk,
        "lnk" | "url" => FileKind::Shortcut,
        _ => FileKind::Other,
    }
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FileEntry {
    pub name: String,
    pub path: String,
    pub parent: Option<String>,
    pub is_dir: bool,
    pub is_symlink: bool,
    pub size: u64,
    pub modified: Option<u64>,
    pub created: Option<u64>,
    pub accessed: Option<u64>,
    pub extension: String,
    pub kind: FileKind,
    pub hidden: bool,
    pub system: bool,
    pub readonly: bool,
}

fn to_millis(t: Option<SystemTime>) -> Option<u64> {
    t.and_then(|t| t.duration_since(UNIX_EPOCH).ok())
        .map(|d| d.as_millis() as u64)
}

pub fn entry_from_path(path: &Path) -> FlowResult<FileEntry> {
    let meta = fs::symlink_metadata(path)
        .map_err(|e| FlowError::from_io(&e, &path.to_string_lossy()))?;
    Ok(build_entry(path, &meta))
}

fn build_entry(path: &Path, meta: &fs::Metadata) -> FileEntry {
    let is_symlink = meta.file_type().is_symlink();
    // For a symlink we still want to know whether the target is a directory,
    // but we must never fail because the target is gone.
    let is_dir = if is_symlink {
        fs::metadata(path).map(|m| m.is_dir()).unwrap_or(false)
    } else {
        meta.is_dir()
    };

    #[cfg(windows)]
    let attrs = meta.file_attributes();
    #[cfg(not(windows))]
    let attrs: u32 = 0;

    let name = path
        .file_name()
        .map(|n| n.to_string_lossy().to_string())
        .unwrap_or_else(|| path.to_string_lossy().to_string());

    FileEntry {
        name,
        path: path.to_string_lossy().to_string(),
        parent: path.parent().map(|p| p.to_string_lossy().to_string()),
        is_dir,
        is_symlink,
        size: if is_dir { 0 } else { meta.len() },
        modified: to_millis(meta.modified().ok()),
        created: to_millis(meta.created().ok()),
        accessed: to_millis(meta.accessed().ok()),
        extension: path
            .extension()
            .and_then(|e| e.to_str())
            .unwrap_or("")
            .to_ascii_lowercase(),
        kind: classify(path, is_dir),
        hidden: {
            #[cfg(windows)]
            {
                attrs & FILE_ATTRIBUTE_HIDDEN != 0
            }
            #[cfg(not(windows))]
            {
                path.file_name()
                    .map(|n| n.to_string_lossy().starts_with('.'))
                    .unwrap_or(false)
            }
        },
        system: {
            #[cfg(windows)]
            {
                attrs & FILE_ATTRIBUTE_SYSTEM != 0
            }
            #[cfg(not(windows))]
            {
                false
            }
        },
        readonly: {
            #[cfg(windows)]
            {
                attrs & FILE_ATTRIBUTE_READONLY != 0
            }
            #[cfg(not(windows))]
            {
                meta.permissions().readonly()
            }
        },
    }
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DirListing {
    pub path: String,
    pub entries: Vec<FileEntry>,
    /// Entries we could not read at all (locked, permission denied). Named so
    /// the UI can say "3 items couldn't be read" instead of silently lying.
    pub unreadable: usize,
}

/// List a directory. Individual unreadable entries are counted and skipped —
/// one bad file never fails the whole listing.
pub fn list_dir(path: &str, show_hidden: bool) -> FlowResult<DirListing> {
    let p = PathBuf::from(path);
    if !p.exists() {
        return Err(FlowError::NotFound(format!(
            "\"{path}\" could not be found. It may have been moved or the drive disconnected."
        )));
    }
    let rd = fs::read_dir(&p).map_err(|e| FlowError::from_io(&e, path))?;

    let mut entries = Vec::new();
    let mut unreadable = 0usize;
    for item in rd {
        match item {
            Ok(de) => match de.metadata() {
                Ok(meta) => {
                    let entry = build_entry(&de.path(), &meta);
                    if !show_hidden && (entry.hidden || entry.system) {
                        continue;
                    }
                    entries.push(entry);
                }
                Err(_) => unreadable += 1,
            },
            Err(_) => unreadable += 1,
        }
    }

    Ok(DirListing {
        path: p.to_string_lossy().to_string(),
        entries,
        unreadable,
    })
}

/// Recursive size + item counts for a folder. Bounded so a click on C:\ cannot
/// hang the UI forever.
#[derive(Debug, Serialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct FolderStats {
    pub total_size: u64,
    pub files: u64,
    pub folders: u64,
    pub truncated: bool,
}

pub fn folder_stats(path: &str, max_entries: u64) -> FlowResult<FolderStats> {
    let mut stats = FolderStats::default();
    let mut seen = 0u64;
    for entry in walkdir::WalkDir::new(path)
        .follow_links(false)
        .into_iter()
        .filter_map(|e| e.ok())
    {
        seen += 1;
        if seen > max_entries {
            stats.truncated = true;
            break;
        }
        if entry.file_type().is_dir() {
            if entry.depth() > 0 {
                stats.folders += 1;
            }
        } else if let Ok(m) = entry.metadata() {
            stats.files += 1;
            stats.total_size += m.len();
        }
    }
    Ok(stats)
}

// ---------------------------------------------------------------------------
// Mutating operations
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Copy, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum ConflictPolicy {
    /// Leave the existing file alone.
    Skip,
    /// Replace the existing file. Only ever used when the user explicitly picks it.
    Overwrite,
    /// Write alongside it as "name (2).ext".
    Rename,
    /// Stop and report, so the UI can ask.
    Fail,
}

#[derive(Debug, Serialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct OpOutcome {
    pub succeeded: Vec<String>,
    pub skipped: Vec<String>,
    /// (path, message) pairs — reported, never swallowed.
    pub failed: Vec<(String, String)>,
}

pub(crate) fn unique_destination(dest: &Path) -> PathBuf {
    if !dest.exists() {
        return dest.to_path_buf();
    }
    let parent = dest.parent().unwrap_or_else(|| Path::new("."));
    let stem = dest
        .file_stem()
        .map(|s| s.to_string_lossy().to_string())
        .unwrap_or_default();
    let ext = dest.extension().map(|e| e.to_string_lossy().to_string());
    for n in 2..10_000u32 {
        let candidate = match &ext {
            Some(e) => parent.join(format!("{stem} ({n}).{e}")),
            None => parent.join(format!("{stem} ({n})")),
        };
        if !candidate.exists() {
            return candidate;
        }
    }
    dest.to_path_buf()
}

fn resolve_destination(dest: &Path, policy: ConflictPolicy) -> FlowResult<Option<PathBuf>> {
    if !dest.exists() {
        return Ok(Some(dest.to_path_buf()));
    }
    match policy {
        ConflictPolicy::Skip => Ok(None),
        ConflictPolicy::Overwrite => Ok(Some(dest.to_path_buf())),
        ConflictPolicy::Rename => Ok(Some(unique_destination(dest))),
        ConflictPolicy::Fail => Err(FlowError::AlreadyExists(format!(
            "\"{}\" already exists in this folder.",
            dest.file_name().unwrap_or_default().to_string_lossy()
        ))),
    }
}

/// Emitted to the frontend while a copy or move is in flight so the UI can
/// show live bytes/speed/ETA and nudge the destination folder to refresh.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CopyProgressEvent {
    pub op_id: String,
    pub dest_dir: String,
    pub current_file: String,
    pub files_done: usize,
    pub files_total: usize,
    pub bytes_done: u64,
    pub bytes_total: u64,
}

const COPY_CHUNK: usize = 1024 * 1024;
/// Don't flood the frontend with an event per 1 MiB chunk on a fast SSD —
/// a tick every ~100ms is plenty smooth for a progress bar.
const EMIT_INTERVAL_MS: u128 = 100;

struct CopyProgress<'a> {
    app: &'a AppHandle,
    op_id: &'a str,
    dest_dir: &'a str,
    bytes_done: u64,
    bytes_total: u64,
    files_done: usize,
    files_total: usize,
    last_emit: Instant,
}

impl<'a> CopyProgress<'a> {
    fn maybe_emit(&mut self, current_file: &str, force: bool) {
        if !force && self.last_emit.elapsed().as_millis() < EMIT_INTERVAL_MS {
            return;
        }
        self.last_emit = Instant::now();
        let _ = self.app.emit(
            "fs://copy-progress",
            CopyProgressEvent {
                op_id: self.op_id.to_string(),
                dest_dir: self.dest_dir.to_string(),
                current_file: current_file.to_string(),
                files_done: self.files_done,
                files_total: self.files_total,
                bytes_done: self.bytes_done,
                bytes_total: self.bytes_total,
            },
        );
    }
}

/// Recursive byte/file count for a single source, used to size the progress
/// bar before the transfer starts (mirrors `folder_stats` but unbounded,
/// since this already runs on the blocking pool for a transfer the user is
/// about to wait on anyway).
fn size_of_path(p: &Path) -> (u64, usize) {
    if p.is_dir() {
        let mut bytes = 0u64;
        let mut files = 0usize;
        for entry in walkdir::WalkDir::new(p)
            .follow_links(false)
            .into_iter()
            .filter_map(|e| e.ok())
        {
            if entry.file_type().is_file() {
                if let Ok(m) = entry.metadata() {
                    bytes += m.len();
                    files += 1;
                }
            }
        }
        (bytes, files)
    } else if let Ok(m) = fs::metadata(p) {
        (m.len(), 1)
    } else {
        (0, 0)
    }
}

/// Per-source sizes (so an instant same-volume rename can credit the
/// progress bar for its exact share) plus the running totals.
fn source_sizes(sources: &[String]) -> (Vec<(u64, usize)>, u64, usize) {
    let mut per_source = Vec::with_capacity(sources.len());
    let mut bytes_total = 0u64;
    let mut files_total = 0usize;
    for src in sources {
        let (b, f) = size_of_path(Path::new(src));
        per_source.push((b, f));
        bytes_total += b;
        files_total += f;
    }
    (per_source, bytes_total, files_total)
}

/// Streams one file in chunks (rather than `fs::copy`'s single syscall) so we
/// can report bytes as they land. Best-effort carries over permission bits,
/// matching what `fs::copy` would have done.
fn copy_file_with_progress(
    from: &Path,
    to: &Path,
    progress: &mut CopyProgress,
) -> FlowResult<()> {
    let mut reader = fs::File::open(from).map_err(|e| FlowError::from_io(&e, &from.to_string_lossy()))?;
    let mut writer = fs::File::create(to).map_err(|e| FlowError::from_io(&e, &to.to_string_lossy()))?;
    let name = from
        .file_name()
        .map(|n| n.to_string_lossy().to_string())
        .unwrap_or_default();
    let mut buf = vec![0u8; COPY_CHUNK];
    loop {
        let n = reader
            .read(&mut buf)
            .map_err(|e| FlowError::from_io(&e, &from.to_string_lossy()))?;
        if n == 0 {
            break;
        }
        writer
            .write_all(&buf[..n])
            .map_err(|e| FlowError::from_io(&e, &to.to_string_lossy()))?;
        progress.bytes_done += n as u64;
        progress.maybe_emit(&name, false);
    }
    if let Ok(meta) = fs::metadata(from) {
        let _ = fs::set_permissions(to, meta.permissions());
    }
    progress.files_done += 1;
    progress.maybe_emit(&name, true);
    Ok(())
}

fn copy_dir_recursive(
    src: &Path,
    dest: &Path,
    policy: ConflictPolicy,
    progress: &mut CopyProgress,
) -> FlowResult<()> {
    fs::create_dir_all(dest).map_err(|e| FlowError::from_io(&e, &dest.to_string_lossy()))?;
    let rd = fs::read_dir(src).map_err(|e| FlowError::from_io(&e, &src.to_string_lossy()))?;
    for item in rd.flatten() {
        let from = item.path();
        let to = dest.join(item.file_name());
        let is_dir = item.file_type().map(|t| t.is_dir()).unwrap_or(false);
        if is_dir {
            copy_dir_recursive(&from, &to, policy, progress)?;
        } else if let Some(target) = resolve_destination(&to, policy)? {
            copy_file_with_progress(&from, &target, progress)?;
        }
    }
    Ok(())
}

pub fn copy_items(
    sources: &[String],
    dest_dir: &str,
    policy: ConflictPolicy,
    app: &AppHandle,
    op_id: &str,
) -> FlowResult<OpOutcome> {
    let dest_root = PathBuf::from(dest_dir);
    if !dest_root.is_dir() {
        return Err(FlowError::NotFound(format!(
            "The destination folder \"{dest_dir}\" does not exist."
        )));
    }

    let (_, bytes_total, files_total) = source_sizes(sources);
    let mut progress = CopyProgress {
        app,
        op_id,
        dest_dir,
        bytes_done: 0,
        bytes_total,
        files_done: 0,
        files_total,
        last_emit: Instant::now() - std::time::Duration::from_secs(1),
    };
    progress.maybe_emit("", true);

    let mut outcome = OpOutcome::default();
    for src in sources {
        let from = PathBuf::from(src);
        let name = match from.file_name() {
            Some(n) => n.to_os_string(),
            None => {
                outcome
                    .failed
                    .push((src.clone(), "Invalid source path.".into()));
                continue;
            }
        };
        // Refuse to copy a folder into itself — a classic way to fill a disk.
        if from.is_dir() && dest_root.starts_with(&from) {
            outcome.failed.push((
                src.clone(),
                "A folder can't be copied into itself.".to_string(),
            ));
            continue;
        }
        let to = dest_root.join(&name);
        let result = (|| -> FlowResult<Option<PathBuf>> {
            if from.is_dir() {
                let target = match resolve_destination(&to, policy)? {
                    Some(t) => t,
                    None => return Ok(None),
                };
                copy_dir_recursive(&from, &target, policy, &mut progress)?;
                Ok(Some(target))
            } else {
                let target = match resolve_destination(&to, policy)? {
                    Some(t) => t,
                    None => return Ok(None),
                };
                copy_file_with_progress(&from, &target, &mut progress)?;
                Ok(Some(target))
            }
        })();
        match result {
            Ok(Some(t)) => outcome.succeeded.push(t.to_string_lossy().to_string()),
            Ok(None) => outcome.skipped.push(src.clone()),
            Err(e) => outcome.failed.push((src.clone(), e.to_string())),
        }
    }
    progress.maybe_emit("", true);
    Ok(outcome)
}

pub fn move_items(
    sources: &[String],
    dest_dir: &str,
    policy: ConflictPolicy,
    app: &AppHandle,
    op_id: &str,
) -> FlowResult<OpOutcome> {
    let dest_root = PathBuf::from(dest_dir);
    if !dest_root.is_dir() {
        return Err(FlowError::NotFound(format!(
            "The destination folder \"{dest_dir}\" does not exist."
        )));
    }

    let (per_source, bytes_total, files_total) = source_sizes(sources);
    let mut progress = CopyProgress {
        app,
        op_id,
        dest_dir,
        bytes_done: 0,
        bytes_total,
        files_done: 0,
        files_total,
        last_emit: Instant::now() - std::time::Duration::from_secs(1),
    };
    progress.maybe_emit("", true);

    let mut outcome = OpOutcome::default();
    for (i, src) in sources.iter().enumerate() {
        let from = PathBuf::from(src);
        let name = match from.file_name() {
            Some(n) => n.to_os_string(),
            None => {
                outcome
                    .failed
                    .push((src.clone(), "Invalid source path.".into()));
                continue;
            }
        };
        if from.is_dir() && dest_root.starts_with(&from) {
            outcome.failed.push((
                src.clone(),
                "A folder can't be moved into itself.".to_string(),
            ));
            continue;
        }
        let to = dest_root.join(&name);
        let (item_bytes, item_files) = per_source.get(i).copied().unwrap_or((0, 0));
        let result = (|| -> FlowResult<Option<PathBuf>> {
            let target = match resolve_destination(&to, policy)? {
                Some(t) => t,
                None => return Ok(None),
            };
            // rename() is instant on the same volume and fails across volumes,
            // where we fall back to copy-then-delete.
            match fs::rename(&from, &target) {
                Ok(_) => {
                    // Instant, but still credit this item's exact share of the
                    // total so the bar and ETA stay honest for mixed batches.
                    progress.bytes_done += item_bytes;
                    progress.files_done += item_files;
                    progress.maybe_emit(&name.to_string_lossy(), false);
                    Ok(Some(target))
                }
                Err(_) => {
                    if from.is_dir() {
                        copy_dir_recursive(&from, &target, policy, &mut progress)?;
                        fs::remove_dir_all(&from)
                            .map_err(|e| FlowError::from_io(&e, &from.to_string_lossy()))?;
                    } else {
                        copy_file_with_progress(&from, &target, &mut progress)?;
                        fs::remove_file(&from)
                            .map_err(|e| FlowError::from_io(&e, &from.to_string_lossy()))?;
                    }
                    Ok(Some(target))
                }
            }
        })();
        match result {
            Ok(Some(t)) => outcome.succeeded.push(t.to_string_lossy().to_string()),
            Ok(None) => outcome.skipped.push(src.clone()),
            Err(e) => outcome.failed.push((src.clone(), e.to_string())),
        }
    }
    progress.maybe_emit("", true);
    Ok(outcome)
}

/// Delete. `permanent = false` routes through the Windows Recycle Bin, which is
/// the default everywhere in the UI; permanent deletion is only ever reached
/// through an explicit confirmation.
pub fn delete_items(paths: &[String], permanent: bool) -> FlowResult<OpOutcome> {
    let mut outcome = OpOutcome::default();
    for p in paths {
        let path = PathBuf::from(p);
        let result: FlowResult<()> = if permanent {
            if path.is_dir() {
                fs::remove_dir_all(&path).map_err(|e| FlowError::from_io(&e, p))
            } else {
                fs::remove_file(&path).map_err(|e| FlowError::from_io(&e, p))
            }
        } else {
            trash::delete(&path).map_err(|e| match e {
                trash::Error::CouldNotAccess { .. } => FlowError::AccessDenied(format!(
                    "\"{p}\" could not be moved to the Recycle Bin — access was denied."
                )),
                other => FlowError::Io(format!("Couldn't move \"{p}\" to the Recycle Bin: {other}")),
            })
        };
        match result {
            Ok(_) => outcome.succeeded.push(p.clone()),
            Err(e) => outcome.failed.push((p.clone(), e.to_string())),
        }
    }
    Ok(outcome)
}

pub fn rename_item(path: &str, new_name: &str) -> FlowResult<FileEntry> {
    let from = PathBuf::from(path);
    if new_name.trim().is_empty() {
        return Err(FlowError::Other("A name can't be empty.".into()));
    }
    if new_name.contains(['/', '\\', ':', '*', '?', '"', '<', '>', '|']) {
        return Err(FlowError::Other(
            "A name can't contain \\ / : * ? \" < > |".into(),
        ));
    }
    let parent = from
        .parent()
        .ok_or_else(|| FlowError::Other("That item has no parent folder.".into()))?;
    let to = parent.join(new_name);
    if to.exists() {
        return Err(FlowError::AlreadyExists(format!(
            "\"{new_name}\" already exists in this folder."
        )));
    }
    fs::rename(&from, &to).map_err(|e| FlowError::from_io(&e, path))?;
    entry_from_path(&to)
}

pub fn create_folder(parent: &str, name: &str) -> FlowResult<FileEntry> {
    let base = PathBuf::from(parent);
    let target = base.join(name);
    if target.exists() {
        return Err(FlowError::AlreadyExists(format!(
            "\"{name}\" already exists in this folder."
        )));
    }
    fs::create_dir(&target).map_err(|e| FlowError::from_io(&e, &target.to_string_lossy()))?;
    entry_from_path(&target)
}

pub fn create_file(parent: &str, name: &str) -> FlowResult<FileEntry> {
    let base = PathBuf::from(parent);
    let target = base.join(name);
    if target.exists() {
        return Err(FlowError::AlreadyExists(format!(
            "\"{name}\" already exists in this folder."
        )));
    }
    fs::File::create(&target).map_err(|e| FlowError::from_io(&e, &target.to_string_lossy()))?;
    entry_from_path(&target)
}

/// Read the head of a text file for the preview panel. Bounded, and it refuses
/// binary content rather than spraying control characters into the UI.
pub fn read_text_head(path: &str, max_bytes: usize) -> FlowResult<String> {
    use std::io::Read;
    let mut f = fs::File::open(path).map_err(|e| FlowError::from_io(&e, path))?;
    let mut buf = vec![0u8; max_bytes];
    let n = f.read(&mut buf).map_err(|e| FlowError::from_io(&e, path))?;
    buf.truncate(n);
    if buf.iter().take(4096).any(|b| *b == 0) {
        return Err(FlowError::Unsupported(
            "This file doesn't look like text, so there's nothing to preview.".into(),
        ));
    }
    Ok(String::from_utf8_lossy(&buf).to_string())
}
