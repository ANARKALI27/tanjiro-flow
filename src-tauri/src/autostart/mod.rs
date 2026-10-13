//! Lets the user have Tanjiro Flow launch automatically when they sign in
//! to Windows.
//!
//! Like `default_manager`, this uses a per-user registry entry rather than
//! anything machine-wide or admin-gated: writing a value under
//! `HKEY_CURRENT_USER\...\CurrentVersion\Run` tells Windows to start the
//! named program at login for the current user only, with no elevation
//! prompt and no installer-level "startup task" needed. Removing the value
//! fully undoes it.
//!
//! The launched command includes `--minimized` so a login-time start comes
//! up straight into the tray (see `lib.rs`'s arg handling) instead of
//! popping the main window in the user's face before they've touched
//! anything.

use crate::error::{FlowError, FlowResult};

#[cfg(windows)]
mod platform {
    use super::*;
    use winreg::enums::*;
    use winreg::RegKey;

    const RUN_KEY: &str = r"Software\Microsoft\Windows\CurrentVersion\Run";
    const VALUE_NAME: &str = "Tanjiro Flow";

    fn launch_command() -> FlowResult<String> {
        let exe = std::env::current_exe().map_err(|e| {
            FlowError::Other(format!("Couldn't locate Tanjiro Flow's own program file: {e}"))
        })?;
        Ok(format!("\"{}\" --minimized", exe.to_string_lossy()))
    }

    pub fn is_enabled() -> FlowResult<bool> {
        let expected = launch_command()?;
        let hkcu = RegKey::predef(HKEY_CURRENT_USER);
        let matches = hkcu
            .open_subkey(RUN_KEY)
            .ok()
            .and_then(|key| key.get_value::<String, _>(VALUE_NAME).ok())
            .map(|v| v == expected)
            .unwrap_or(false);
        Ok(matches)
    }

    pub fn set_enabled(enable: bool) -> FlowResult<()> {
        let hkcu = RegKey::predef(HKEY_CURRENT_USER);

        if enable {
            let command = launch_command()?;
            let (key, _) = hkcu
                .create_subkey(RUN_KEY)
                .map_err(|e| FlowError::Other(format!("Couldn't update the registry: {e}")))?;
            key.set_value(VALUE_NAME, &command)
                .map_err(|e| FlowError::Other(format!("Couldn't update the registry: {e}")))?;
        } else if let Ok(key) = hkcu.open_subkey_with_flags(RUN_KEY, KEY_SET_VALUE) {
            // Missing value is fine — already off.
            let _ = key.delete_value(VALUE_NAME);
        }

        Ok(())
    }
}

#[cfg(not(windows))]
mod platform {
    use super::*;

    pub fn is_enabled() -> FlowResult<bool> {
        Ok(false)
    }

    pub fn set_enabled(_enable: bool) -> FlowResult<()> {
        Err(FlowError::Unsupported(
            "Launching at startup is only supported on Windows.".into(),
        ))
    }
}

/// Whether Tanjiro Flow is currently registered to launch at Windows login.
pub fn is_autostart_enabled() -> FlowResult<bool> {
    platform::is_enabled()
}

/// Turn launch-at-login on or off for the current user.
pub fn set_autostart_enabled(enable: bool) -> FlowResult<()> {
    platform::set_enabled(enable)
}
