//! Lets the user make Tanjiro Flow open folders and drives instead of File
//! Explorer.
//!
//! Windows has no single "default file manager" switch the way it does for
//! browsers or PDF viewers. The standard, reversible, no-admin-required way
//! third-party file managers achieve this is a per-user registry override:
//! `HKEY_CURRENT_USER\Software\Classes` shadows the machine-wide
//! `HKEY_CLASSES_ROOT`, so writing the "open" verb's command there for
//! `Directory` and `Drive` redirects folder/drive double-clicks to us for
//! the current user only — HKLM is never touched and no elevation prompt is
//! needed. Removing those keys fully restores Explorer's own default, with
//! nothing left half-set.

use crate::error::{FlowError, FlowResult};

#[cfg(windows)]
mod platform {
    use super::*;
    use winreg::enums::*;
    use winreg::RegKey;

    /// The "open" verb key for folders and for drive roots. We only ever
    /// create/delete the `command` value *inside* these — never anything
    /// above them — so disabling never leaves a dangling empty verb behind.
    const OPEN_VERB_KEYS: &[&str] = &[
        r"Software\Classes\Directory\shell\open",
        r"Software\Classes\Drive\shell\open",
    ];

    fn exe_command() -> FlowResult<String> {
        let exe = std::env::current_exe().map_err(|e| {
            FlowError::Other(format!("Couldn't locate Tanjiro Flow's own program file: {e}"))
        })?;
        Ok(format!("\"{}\" \"%1\"", exe.to_string_lossy()))
    }

    pub fn is_default() -> FlowResult<bool> {
        let expected = exe_command()?;
        let hkcu = RegKey::predef(HKEY_CURRENT_USER);
        for verb_key in OPEN_VERB_KEYS {
            let command_path = format!("{verb_key}\\command");
            let matches = hkcu
                .open_subkey(&command_path)
                .ok()
                .and_then(|key| key.get_value::<String, _>("").ok())
                .map(|v| v == expected)
                .unwrap_or(false);
            if !matches {
                return Ok(false);
            }
        }
        Ok(true)
    }

    pub fn set_default(enable: bool) -> FlowResult<()> {
        let hkcu = RegKey::predef(HKEY_CURRENT_USER);

        if enable {
            let command = exe_command()?;
            for verb_key in OPEN_VERB_KEYS {
                let command_path = format!("{verb_key}\\command");
                let (key, _) = hkcu.create_subkey(&command_path).map_err(|e| {
                    FlowError::Other(format!("Couldn't update the registry: {e}"))
                })?;
                key.set_value("", &command).map_err(|e| {
                    FlowError::Other(format!("Couldn't update the registry: {e}"))
                })?;
            }
        } else {
            // Delete the whole "open" verb key we created (command and all),
            // not just the command value, so nothing half-empty is left
            // behind and Explorer's own default takes back over cleanly.
            for verb_key in OPEN_VERB_KEYS {
                let _ = hkcu.delete_subkey_all(verb_key);
            }
        }

        notify_shell();
        Ok(())
    }

    /// Tell Explorer file associations changed, so it picks this up live
    /// instead of needing the user to sign out and back in.
    fn notify_shell() {
        use windows_sys::Win32::UI::Shell::{SHChangeNotify, SHCNE_ASSOCCHANGED, SHCNF_IDLIST};
        unsafe {
            SHChangeNotify(SHCNE_ASSOCCHANGED as i32, SHCNF_IDLIST, std::ptr::null(), std::ptr::null());
        }
    }
}

#[cfg(not(windows))]
mod platform {
    use super::*;

    pub fn is_default() -> FlowResult<bool> {
        Ok(false)
    }

    pub fn set_default(_enable: bool) -> FlowResult<()> {
        Err(FlowError::Unsupported(
            "Setting a default file manager is only supported on Windows.".into(),
        ))
    }
}

/// Whether Tanjiro Flow currently owns the folder/drive "open" action.
pub fn is_default_file_manager() -> FlowResult<bool> {
    platform::is_default()
}

/// Turn the override on or off for the current user.
pub fn set_default_file_manager(enable: bool) -> FlowResult<()> {
    platform::set_default(enable)
}
