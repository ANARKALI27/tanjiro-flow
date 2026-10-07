use crate::error::FlowResult;
use serde::Serialize;

/// How the frontend should try to render a preview for a given file.
/// Deciding this in one place keeps the UI from guessing, and means an
/// unsupported format degrades to an icon instead of a broken element.
#[derive(Debug, Clone, Copy, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum PreviewStrategy {
    /// Render directly via the asset protocol in an <img>.
    Image,
    /// Render in a <video>.
    Video,
    /// Render in an <audio>.
    Audio,
    /// Render in an <embed> — WebView2 has a built-in PDF viewer.
    Pdf,
    /// Read the head of the file as text.
    Text,
    /// List the archive contents.
    Archive,
    /// No preview — show the type icon and metadata only.
    None,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PreviewPlan {
    pub strategy: PreviewStrategy,
    /// Present when we know the webview cannot decode the format even though
    /// it is an image/video, so the UI can say why.
    pub note: Option<String>,
}

pub fn plan(path: &str) -> FlowResult<PreviewPlan> {
    let ext = std::path::Path::new(path)
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("")
        .to_ascii_lowercase();

    let (strategy, note) = match ext.as_str() {
        "jpg" | "jpeg" | "png" | "gif" | "webp" | "bmp" | "svg" | "avif" | "ico" => {
            (PreviewStrategy::Image, None)
        }
        "psd" | "tif" | "tiff" | "heic" | "raw" | "cr2" | "nef" | "dng" => (
            PreviewStrategy::None,
            Some(format!(
                ".{ext} files can't be decoded by the built-in viewer yet — opening in an external app still works."
            )),
        ),
        "mp4" | "webm" | "m4v" | "mov" => (PreviewStrategy::Video, None),
        "mkv" | "avi" | "wmv" | "flv" | "mpg" | "mpeg" => (
            PreviewStrategy::Video,
            Some("This container may not play in the built-in viewer depending on its codec.".into()),
        ),
        "mp3" | "wav" | "ogg" | "m4a" | "flac" | "opus" => (PreviewStrategy::Audio, None),
        "pdf" => (PreviewStrategy::Pdf, None),
        "zip" => (PreviewStrategy::Archive, None),
        "7z" | "rar" | "tar" | "gz" | "bz2" | "xz" => (
            PreviewStrategy::None,
            Some(format!(
                ".{ext} archives aren't readable yet — ZIP is supported in this build."
            )),
        ),
        "txt" | "md" | "log" | "csv" | "tsv" | "json" | "yaml" | "yml" | "toml" | "xml"
        | "html" | "htm" | "css" | "js" | "jsx" | "ts" | "tsx" | "rs" | "py" | "java" | "c"
        | "h" | "cpp" | "hpp" | "cs" | "go" | "rb" | "php" | "sh" | "ps1" | "bat" | "ini"
        | "cfg" | "conf" | "sql" => (PreviewStrategy::Text, None),
        _ => (PreviewStrategy::None, None),
    };

    Ok(PreviewPlan { strategy, note })
}
