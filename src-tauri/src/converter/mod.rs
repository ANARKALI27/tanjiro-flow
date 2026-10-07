//! Converts image files between formats using the `image` crate. The set of
//! supported targets mirrors `IMAGE_CONVERT_TARGETS` in
//! `src/components/FileContextMenu.tsx` — keep the two in sync.

use crate::error::{FlowError, FlowResult};
use serde::Serialize;
use std::path::{Path, PathBuf};

const IMAGE_EXTS: &[&str] = &["png", "jpg", "jpeg", "bmp", "gif", "webp", "tiff", "tif", "ico"];
const IMAGE_TARGETS: &[&str] = &["png", "jpg", "bmp", "gif", "webp", "tiff", "ico"];

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ConvertOutcome {
    pub converted: Vec<String>,
    /// [path, message]
    pub failed: Vec<(String, String)>,
}

fn normalize_ext(ext: &str) -> String {
    let e = ext.trim().trim_start_matches('.').to_lowercase();
    if e == "jpeg" {
        "jpg".to_string()
    } else {
        e
    }
}

fn image_format_for(target: &str) -> Option<image::ImageFormat> {
    match target {
        "png" => Some(image::ImageFormat::Png),
        "jpg" | "jpeg" => Some(image::ImageFormat::Jpeg),
        "bmp" => Some(image::ImageFormat::Bmp),
        "gif" => Some(image::ImageFormat::Gif),
        "webp" => Some(image::ImageFormat::WebP),
        "tiff" | "tif" => Some(image::ImageFormat::Tiff),
        "ico" => Some(image::ImageFormat::Ico),
        _ => None,
    }
}

/// Which formats a file with this extension can be converted *to* — every
/// supported image format except its own, or nothing for a non-image file.
pub fn supported_targets(source_ext: &str) -> Vec<String> {
    let src = normalize_ext(source_ext);
    if !IMAGE_EXTS.contains(&src.as_str()) {
        return Vec::new();
    }
    IMAGE_TARGETS
        .iter()
        .filter(|t| **t != src)
        .map(|t| t.to_string())
        .collect()
}

/// Converts each of `paths` to `target_format`, writing the result next to
/// its source (or into `dest_dir` if given) as `<stem>.<target_format>`.
/// Best-effort across the batch: one file's failure is recorded in `failed`
/// rather than aborting the rest.
pub fn convert(paths: &[String], target_format: &str, dest_dir: Option<&str>) -> FlowResult<ConvertOutcome> {
    let target = normalize_ext(target_format);
    let format = image_format_for(&target)
        .ok_or_else(|| FlowError::Unsupported(format!("Can't convert to \"{target}\".")))?;

    let mut converted = Vec::new();
    let mut failed = Vec::new();

    for p in paths {
        let src = Path::new(p);

        let stem = match src.file_stem().and_then(|s| s.to_str()) {
            Some(s) => s.to_string(),
            None => {
                failed.push((p.clone(), "Couldn't read that file's name.".to_string()));
                continue;
            }
        };

        let out_dir: PathBuf = match dest_dir {
            Some(d) => PathBuf::from(d),
            None => match src.parent() {
                Some(d) => d.to_path_buf(),
                None => {
                    failed.push((p.clone(), "Couldn't determine a destination folder.".to_string()));
                    continue;
                }
            },
        };

        // Never silently overwrite the source (same stem, same target
        // extension as a no-op "conversion") or another file already at the
        // destination — find the next free "name (n).ext" instead.
        let mut out_path = out_dir.join(format!("{stem}.{target}"));
        let mut n = 1;
        while out_path.exists() {
            out_path = out_dir.join(format!("{stem} ({n}).{target}"));
            n += 1;
        }

        match image::open(src) {
            Ok(img) => match img.save_with_format(&out_path, format) {
                Ok(()) => converted.push(out_path.to_string_lossy().to_string()),
                Err(e) => failed.push((p.clone(), format!("Couldn't save as {target}: {e}"))),
            },
            Err(e) => failed.push((p.clone(), format!("Couldn't read that image: {e}"))),
        }
    }

    Ok(ConvertOutcome { converted, failed })
}
