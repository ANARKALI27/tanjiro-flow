use crate::error::{FlowError, FlowResult};
use std::path::Path;

/// Launch a path with its registered Windows handler. This is the only place in
/// Tanjiro Flow that hands something to the OS to execute, and it is never called
/// without an explicit user action.
#[cfg(windows)]
pub fn open_path(path: &str) -> FlowResult<()> {
    use std::os::windows::ffi::OsStrExt;
    use windows_sys::Win32::UI::Shell::ShellExecuteW;
    use windows_sys::Win32::UI::WindowsAndMessaging::SW_SHOWNORMAL;

    let p = Path::new(path);
    if !p.exists() {
        return Err(FlowError::NotFound(format!(
            "\"{path}\" could not be found. It may have been moved or deleted."
        )));
    }

    let wide = |s: &str| -> Vec<u16> {
        std::ffi::OsStr::new(s)
            .encode_wide()
            .chain(std::iter::once(0))
            .collect()
    };
    let verb = wide("open");
    let file = wide(path);

    let result = unsafe {
        ShellExecuteW(
            std::ptr::null_mut(),
            verb.as_ptr(),
            file.as_ptr(),
            std::ptr::null(),
            std::ptr::null(),
            SW_SHOWNORMAL as i32,
        )
    };

    // ShellExecuteW returns a value <= 32 on failure.
    let code = result as isize;
    if code <= 32 {
        return Err(match code {
            2 | 3 => FlowError::NotFound(format!("\"{path}\" could not be found.")),
            5 => FlowError::AccessDenied(format!("Windows refused to open \"{path}\".")),
            31 => FlowError::Unsupported(
                "No app is associated with this file type. Try \"Open with\".".into(),
            ),
            _ => FlowError::Other(format!("Windows couldn't open this item (code {code}).")),
        });
    }
    Ok(())
}

#[cfg(not(windows))]
pub fn open_path(path: &str) -> FlowResult<()> {
    let _ = path;
    Err(FlowError::Unsupported(
        "Opening files is only implemented on Windows.".into(),
    ))
}

/// Show the Windows "Open with" chooser.
#[cfg(windows)]
pub fn open_with(path: &str) -> FlowResult<()> {
    use std::process::Command;
    if !Path::new(path).exists() {
        return Err(FlowError::NotFound(format!("\"{path}\" could not be found.")));
    }
    Command::new("rundll32.exe")
        .arg("shell32.dll,OpenAs_RunDLL")
        .arg(path)
        .spawn()
        .map_err(|e| FlowError::Other(format!("Couldn't show the app chooser: {e}")))?;
    Ok(())
}

#[cfg(not(windows))]
pub fn open_with(path: &str) -> FlowResult<()> {
    let _ = path;
    Err(FlowError::Unsupported(
        "\"Open with\" is only implemented on Windows.".into(),
    ))
}

/// Reveal an item in Windows Explorer. Deliberately kept — Tanjiro Flow does not
/// replace Explorer, it sits beside it.
///
/// Uses `SHOpenFolderAndSelectItems` (the same shell API Explorer itself exposes
/// for "reveal" style integrations) instead of spawning `explorer.exe /select,...`
/// as a helper process. That command-line approach turned out unreliable on
/// modern (tabbed) Explorer: neither `/n` (an old pane-mode flag, not a
/// new-window flag despite the common belief) nor `/separate` reliably force a
/// new OS-level window anymore once one is already open — the request gets
/// silently swallowed, which looked like nothing happened at all. Calling the
/// shell API in-process via COM sidesteps that entirely: it always navigates to
/// and selects the item, opening a new window when one isn't already showing
/// that location, regardless of what's already open.
#[cfg(windows)]
pub fn reveal_in_explorer(path: &str) -> FlowResult<()> {
    use std::ffi::OsStr;
    use std::iter::once;
    use std::os::windows::ffi::OsStrExt;
    use windows_sys::Win32::System::Com::{CoInitializeEx, CoUninitialize, COINIT_APARTMENTTHREADED};
    use windows_sys::Win32::UI::Shell::{ILFree, SHOpenFolderAndSelectItems, SHParseDisplayName};

    let wide: Vec<u16> = OsStr::new(path).encode_wide().chain(once(0)).collect();

    unsafe {
        let hr_init = CoInitializeEx(std::ptr::null(), COINIT_APARTMENTTHREADED as u32);
        // S_OK (0) or S_FALSE (1) both mean COM is usable on this thread; anything
        // negative is a real failure. RPC_E_CHANGED_MODE (also negative) would mean
        // this thread was already initialized with a different concurrency model,
        // which we still treat as fatal since we can't safely proceed.
        let com_ready = hr_init >= 0;

        let mut pidl: *mut windows_sys::Win32::UI::Shell::Common::ITEMIDLIST = std::ptr::null_mut();
        let mut sfgao: u32 = 0;
        let hr = SHParseDisplayName(wide.as_ptr(), std::ptr::null_mut(), &mut pidl, 0, &mut sfgao);
        if hr < 0 || pidl.is_null() {
            if com_ready {
                CoUninitialize();
            }
            return Err(FlowError::Other(format!(
                "Couldn't resolve path for Explorer: {path} (hr={hr:#x})"
            )));
        }

        let open_hr = SHOpenFolderAndSelectItems(pidl, 0, std::ptr::null(), 0);
        ILFree(pidl);
        if com_ready {
            CoUninitialize();
        }

        if open_hr < 0 {
            return Err(FlowError::Other(format!(
                "Couldn't open Explorer (hr={open_hr:#x})"
            )));
        }
    }

    Ok(())
}

#[cfg(not(windows))]
pub fn reveal_in_explorer(path: &str) -> FlowResult<()> {
    let _ = path;
    Err(FlowError::Unsupported("Only implemented on Windows.".into()))
}
