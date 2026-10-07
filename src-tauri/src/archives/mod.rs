use crate::error::{FlowError, FlowResult};
use serde::Serialize;
use std::fs::File;
use std::io::{Read, Write};
use std::path::{Component, Path, PathBuf};
use zip::write::SimpleFileOptions;

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ArchiveResult {
    pub path: String,
    pub entries: usize,
    pub bytes: u64,
}

fn add_file(
    zip: &mut zip::ZipWriter<File>,
    disk_path: &Path,
    name_in_zip: &str,
    opts: SimpleFileOptions,
) -> FlowResult<u64> {
    zip.start_file(name_in_zip, opts)?;
    let mut f =
        File::open(disk_path).map_err(|e| FlowError::from_io(&e, &disk_path.to_string_lossy()))?;
    let mut buf = [0u8; 64 * 1024];
    let mut total = 0u64;
    loop {
        let n = f
            .read(&mut buf)
            .map_err(|e| FlowError::from_io(&e, &disk_path.to_string_lossy()))?;
        if n == 0 {
            break;
        }
        zip.write_all(&buf[..n])
            .map_err(|e| FlowError::Io(format!("Couldn't write to the archive: {e}")))?;
        total += n as u64;
    }
    Ok(total)
}

/// Compress files and/or folders into a single .zip.
pub fn compress_zip(sources: &[String], dest: &str) -> FlowResult<ArchiveResult> {
    let dest_path = PathBuf::from(dest);
    if dest_path.exists() {
        return Err(FlowError::AlreadyExists(format!(
            "\"{}\" already exists.",
            dest_path.file_name().unwrap_or_default().to_string_lossy()
        )));
    }
    let file =
        File::create(&dest_path).map_err(|e| FlowError::from_io(&e, &dest_path.to_string_lossy()))?;
    let mut zip = zip::ZipWriter::new(file);
    let opts = SimpleFileOptions::default().compression_method(zip::CompressionMethod::Deflated);

    let mut entries = 0usize;
    let mut bytes = 0u64;

    for src in sources {
        let src_path = PathBuf::from(src);
        let base = src_path.parent().unwrap_or_else(|| Path::new(""));
        if src_path.is_dir() {
            for entry in walkdir::WalkDir::new(&src_path)
                .follow_links(false)
                .into_iter()
                .filter_map(|e| e.ok())
            {
                let rel = match entry.path().strip_prefix(base) {
                    Ok(r) => r.to_string_lossy().replace('\\', "/"),
                    Err(_) => continue,
                };
                if entry.file_type().is_dir() {
                    zip.add_directory(format!("{rel}/"), opts)?;
                } else {
                    bytes += add_file(&mut zip, entry.path(), &rel, opts)?;
                    entries += 1;
                }
            }
        } else {
            let name = src_path
                .file_name()
                .map(|n| n.to_string_lossy().to_string())
                .unwrap_or_else(|| "file".into());
            bytes += add_file(&mut zip, &src_path, &name, opts)?;
            entries += 1;
        }
    }

    zip.finish()
        .map_err(|e| FlowError::Io(format!("Couldn't finish the archive: {e}")))?;

    Ok(ArchiveResult {
        path: dest_path.to_string_lossy().to_string(),
        entries,
        bytes,
    })
}

/// Reject absolute paths and `..` segments so a hostile archive cannot write
/// outside the folder the user chose. (Zip-slip.)
fn safe_join(root: &Path, name: &str) -> Option<PathBuf> {
    let candidate = Path::new(name);
    let mut out = root.to_path_buf();
    for c in candidate.components() {
        match c {
            Component::Normal(part) => out.push(part),
            Component::CurDir => {}
            _ => return None,
        }
    }
    if out.starts_with(root) {
        Some(out)
    } else {
        None
    }
}

pub fn extract_zip(archive: &str, dest_dir: &str) -> FlowResult<ArchiveResult> {
    let file = File::open(archive).map_err(|e| FlowError::from_io(&e, archive))?;
    let mut zip = zip::ZipArchive::new(file)?;
    let root = PathBuf::from(dest_dir);
    std::fs::create_dir_all(&root).map_err(|e| FlowError::from_io(&e, dest_dir))?;

    let mut entries = 0usize;
    let mut bytes = 0u64;

    for i in 0..zip.len() {
        let mut item = zip.by_index(i)?;
        let name = item.name().to_string();
        let target = match safe_join(&root, &name) {
            Some(t) => t,
            None => {
                return Err(FlowError::Other(format!(
                    "This archive contains an unsafe path (\"{name}\") and was not extracted."
                )))
            }
        };
        if item.is_dir() {
            std::fs::create_dir_all(&target)
                .map_err(|e| FlowError::from_io(&e, &target.to_string_lossy()))?;
            continue;
        }
        if let Some(parent) = target.parent() {
            std::fs::create_dir_all(parent)
                .map_err(|e| FlowError::from_io(&e, &parent.to_string_lossy()))?;
        }
        let mut out = File::create(&target)
            .map_err(|e| FlowError::from_io(&e, &target.to_string_lossy()))?;
        bytes += std::io::copy(&mut item, &mut out)
            .map_err(|e| FlowError::from_io(&e, &target.to_string_lossy()))?;
        entries += 1;
    }

    Ok(ArchiveResult {
        path: root.to_string_lossy().to_string(),
        entries,
        bytes,
    })
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ArchiveEntry {
    pub name: String,
    pub size: u64,
    pub compressed: u64,
    pub is_dir: bool,
}

/// Peek inside a zip without extracting it — used by the preview panel.
pub fn list_zip(archive: &str) -> FlowResult<Vec<ArchiveEntry>> {
    let file = File::open(archive).map_err(|e| FlowError::from_io(&e, archive))?;
    let mut zip = zip::ZipArchive::new(file)?;
    let mut out = Vec::with_capacity(zip.len());
    for i in 0..zip.len() {
        let item = zip.by_index(i)?;
        out.push(ArchiveEntry {
            name: item.name().to_string(),
            size: item.size(),
            compressed: item.compressed_size(),
            is_dir: item.is_dir(),
        });
    }
    Ok(out)
}
