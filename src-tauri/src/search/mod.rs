use crate::error::FlowResult;
use crate::filesystem::{classify, FileEntry, FileKind};
use serde::Deserialize;
use std::path::{Path, PathBuf};
use std::time::{SystemTime, UNIX_EPOCH};
use walkdir::WalkDir;

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SearchOptions {
    pub query: String,
    pub roots: Vec<String>,
    #[serde(default = "default_limit")]
    pub limit: usize,
    #[serde(default = "default_depth")]
    pub max_depth: usize,
    #[serde(default)]
    pub kinds: Vec<FileKind>,
    #[serde(default)]
    pub min_size: u64,
    #[serde(default)]
    pub include_hidden: bool,
}

fn default_limit() -> usize {
    400
}
fn default_depth() -> usize {
    8
}

fn to_millis(t: Option<SystemTime>) -> Option<u64> {
    t.and_then(|t| t.duration_since(UNIX_EPOCH).ok())
        .map(|d| d.as_millis() as u64)
}

fn make_entry(path: &Path, meta: &std::fs::Metadata) -> FileEntry {
    let is_dir = meta.is_dir();
    FileEntry {
        name: path
            .file_name()
            .map(|n| n.to_string_lossy().to_string())
            .unwrap_or_default(),
        path: path.to_string_lossy().to_string(),
        parent: path.parent().map(|p| p.to_string_lossy().to_string()),
        is_dir,
        is_symlink: meta.file_type().is_symlink(),
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
        hidden: false,
        system: false,
        readonly: meta.permissions().readonly(),
    }
}

fn is_noise(path: &Path) -> bool {
    // Directories that make a recursive walk useless and slow.
    const NOISE: &[&str] = &[
        "node_modules",
        "$RECYCLE.BIN",
        "System Volume Information",
        "target",
        ".git",
        "AppData",
        "Windows",
        "ProgramData",
    ];
    path.file_name()
        .and_then(|n| n.to_str())
        .map(|n| NOISE.iter().any(|x| x.eq_ignore_ascii_case(n)))
        .unwrap_or(false)
}

/// Depth- and count-bounded filename search. Inaccessible directories are
/// skipped silently rather than aborting the walk.
pub fn search(opts: SearchOptions) -> FlowResult<Vec<FileEntry>> {
    let needle = opts.query.trim().to_ascii_lowercase();
    let mut results: Vec<FileEntry> = Vec::new();

    for root in &opts.roots {
        if results.len() >= opts.limit {
            break;
        }
        let walker = WalkDir::new(root)
            .max_depth(opts.max_depth)
            .follow_links(false)
            .into_iter()
            .filter_entry(|e| e.depth() == 0 || !is_noise(e.path()));

        for entry in walker.filter_map(|e| e.ok()) {
            if results.len() >= opts.limit {
                break;
            }
            let path = entry.path();
            let name = match path.file_name().and_then(|n| n.to_str()) {
                Some(n) => n,
                None => continue,
            };
            if !needle.is_empty() && !name.to_ascii_lowercase().contains(&needle) {
                continue;
            }
            if !opts.include_hidden && name.starts_with('.') {
                continue;
            }
            let meta = match entry.metadata() {
                Ok(m) => m,
                Err(_) => continue,
            };
            if !meta.is_dir() && meta.len() < opts.min_size {
                continue;
            }
            let kind = classify(path, meta.is_dir());
            if !opts.kinds.is_empty() && !opts.kinds.contains(&kind) {
                continue;
            }
            results.push(make_entry(path, &meta));
        }
    }
    Ok(results)
}

#[derive(Debug, Clone, Copy, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum Category {
    Recent,
    Large,
    Images,
    Videos,
    Audio,
    Documents,
    Applications,
}

/// The user folders we scan for Home dashboard categories. We deliberately do
/// not walk whole drives here — that is what Search is for.
pub fn user_roots() -> Vec<PathBuf> {
    let mut roots = Vec::new();
    for d in [
        dirs::desktop_dir(),
        dirs::document_dir(),
        dirs::download_dir(),
        dirs::picture_dir(),
        dirs::video_dir(),
        dirs::audio_dir(),
    ]
    .into_iter()
    .flatten()
    {
        if d.exists() {
            roots.push(d);
        }
    }
    if roots.is_empty() {
        if let Some(h) = dirs::home_dir() {
            roots.push(h);
        }
    }
    roots
}

pub fn scan_category(category: Category, limit: usize) -> FlowResult<Vec<FileEntry>> {
    let kinds: Vec<FileKind> = match category {
        Category::Images => vec![FileKind::Image],
        Category::Videos => vec![FileKind::Video],
        Category::Audio => vec![FileKind::Audio],
        Category::Documents => vec![FileKind::Document, FileKind::Pdf, FileKind::Text],
        Category::Applications => vec![FileKind::Application],
        Category::Recent | Category::Large => vec![],
    };
    let min_size = if category == Category::Large {
        100 * 1024 * 1024
    } else {
        0
    };

    let roots: Vec<String> = user_roots()
        .into_iter()
        .map(|p| p.to_string_lossy().to_string())
        .collect();

    let mut entries = search(SearchOptions {
        query: String::new(),
        roots,
        limit: 4000,
        max_depth: 5,
        kinds,
        min_size,
        include_hidden: false,
    })?;

    entries.retain(|e| !e.is_dir);

    match category {
        Category::Large => entries.sort_by(|a, b| b.size.cmp(&a.size)),
        _ => entries.sort_by(|a, b| b.modified.unwrap_or(0).cmp(&a.modified.unwrap_or(0))),
    }
    entries.truncate(limit);
    Ok(entries)
}

/// Count-only variant, so the Home cards can show a number without shipping
/// thousands of entries across the IPC boundary.
pub fn count_category(category: Category) -> FlowResult<u64> {
    Ok(scan_category(category, usize::MAX).map(|v| v.len() as u64)?)
}
