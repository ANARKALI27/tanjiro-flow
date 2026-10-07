use std::io;

/// Every fallible operation in Tanjiro Flow returns this. It is serialized to the
/// frontend as `{ kind, message }` so the UI can render a useful, actionable
/// error instead of a stack trace — and so a failing filesystem call can never
/// take the application down.
#[derive(Debug, thiserror::Error)]
pub enum FlowError {
    #[error("{0}")]
    AccessDenied(String),
    #[error("{0}")]
    NotFound(String),
    #[error("{0}")]
    InUse(String),
    #[error("{0}")]
    AlreadyExists(String),
    #[error("{0}")]
    Unsupported(String),
    #[error("{0}")]
    Io(String),
    #[error("{0}")]
    Other(String),
}

pub type FlowResult<T> = Result<T, FlowError>;

impl FlowError {
    pub fn kind(&self) -> &'static str {
        match self {
            FlowError::AccessDenied(_) => "AccessDenied",
            FlowError::NotFound(_) => "NotFound",
            FlowError::InUse(_) => "InUse",
            FlowError::AlreadyExists(_) => "AlreadyExists",
            FlowError::Unsupported(_) => "Unsupported",
            FlowError::Io(_) => "Io",
            FlowError::Other(_) => "Other",
        }
    }

    /// Turn a std::io::Error into something a human can act on.
    pub fn from_io(e: &io::Error, path: &str) -> Self {
        // Windows-specific codes carry more meaning than ErrorKind does.
        match e.raw_os_error() {
            Some(5) => FlowError::AccessDenied(format!(
                "Access to \"{path}\" was denied. It may need administrator permission."
            )),
            Some(2) | Some(3) => {
                FlowError::NotFound(format!("\"{path}\" no longer exists at that location."))
            }
            Some(32) | Some(33) => FlowError::InUse(format!(
                "\"{path}\" is currently being used by another application."
            )),
            Some(80) | Some(183) => {
                FlowError::AlreadyExists(format!("\"{path}\" already exists here."))
            }
            Some(21) => FlowError::Io(format!("The drive holding \"{path}\" is not ready.")),
            Some(112) => FlowError::Io("There is not enough space on the destination drive.".into()),
            _ => match e.kind() {
                io::ErrorKind::PermissionDenied => {
                    FlowError::AccessDenied(format!("Access to \"{path}\" was denied."))
                }
                io::ErrorKind::NotFound => {
                    FlowError::NotFound(format!("\"{path}\" could not be found."))
                }
                io::ErrorKind::AlreadyExists => {
                    FlowError::AlreadyExists(format!("\"{path}\" already exists here."))
                }
                _ => FlowError::Io(format!("{e}")),
            },
        }
    }
}

impl serde::Serialize for FlowError {
    fn serialize<S: serde::Serializer>(&self, serializer: S) -> Result<S::Ok, S::Error> {
        use serde::ser::SerializeStruct;
        let mut st = serializer.serialize_struct("FlowError", 2)?;
        st.serialize_field("kind", self.kind())?;
        st.serialize_field("message", &self.to_string())?;
        st.end()
    }
}

impl From<zip::result::ZipError> for FlowError {
    fn from(e: zip::result::ZipError) -> Self {
        FlowError::Io(format!("Archive error: {e}"))
    }
}
