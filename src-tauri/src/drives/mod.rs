//! Enumerates the system's drives (fixed, removable, network, optical, RAM
//! disk) with capacity info, for the Home page's Drives grid and the
//! sidebar's Drives section. Mirrors `DriveInfo` in `src/lib/types.ts`.

use crate::error::{FlowError, FlowResult};
use serde::Serialize;

#[derive(Debug, Clone, Copy, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum DriveType {
    Fixed,
    Removable,
    Network,
    Optical,
    RamDisk,
    Unknown,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DriveInfo {
    pub letter: String,
    pub path: String,
    pub label: String,
    pub drive_type: DriveType,
    pub filesystem: String,
    pub total_bytes: u64,
    pub free_bytes: u64,
    pub used_bytes: u64,
    pub ready: bool,
}

#[cfg(windows)]
pub fn list_drives() -> FlowResult<Vec<DriveInfo>> {
    use std::ffi::OsStr;
    use std::iter::once;
    use std::os::windows::ffi::OsStrExt;
    use windows_sys::Win32::Storage::FileSystem::{
        GetDiskFreeSpaceExW, GetDriveTypeW, GetLogicalDrives, GetVolumeInformationW,
    };

    // Stable since Windows NT; not all are exposed as named constants by
    // every windows-sys version, so they're spelled out here directly.
    const DRIVE_REMOVABLE: u32 = 2;
    const DRIVE_FIXED: u32 = 3;
    const DRIVE_REMOTE: u32 = 4;
    const DRIVE_CDROM: u32 = 5;
    const DRIVE_RAMDISK: u32 = 6;

    fn wide(s: &str) -> Vec<u16> {
        OsStr::new(s).encode_wide().chain(once(0)).collect()
    }

    /// Decode a NUL-terminated UTF-16 buffer up to its first NUL.
    fn from_wide(buf: &[u16]) -> String {
        let len = buf.iter().position(|&c| c == 0).unwrap_or(buf.len());
        String::from_utf16_lossy(&buf[..len])
    }

    let mask = unsafe { GetLogicalDrives() };
    if mask == 0 {
        return Err(FlowError::Other("Couldn't enumerate drives.".into()));
    }

    let mut out = Vec::new();
    for i in 0..26u32 {
        if mask & (1 << i) == 0 {
            continue;
        }
        let letter = (b'A' + i as u8) as char;
        let root = format!("{letter}:\\");
        let root_wide = wide(&root);

        let drive_type = unsafe { GetDriveTypeW(root_wide.as_ptr()) };
        let kind = match drive_type {
            DRIVE_FIXED => DriveType::Fixed,
            DRIVE_REMOVABLE => DriveType::Removable,
            DRIVE_REMOTE => DriveType::Network,
            DRIVE_CDROM => DriveType::Optical,
            DRIVE_RAMDISK => DriveType::RamDisk,
            _ => DriveType::Unknown,
        };

        // A not-ready drive (empty optical/card reader, disconnected network
        // share) must not be allowed to hang the whole listing on a slow
        // Win32 call — GetVolumeInformationW's own return code is how we
        // find out, so every field it would have filled just stays empty.
        let mut vol_name = [0u16; 261];
        let mut fs_name = [0u16; 261];
        let got_info = unsafe {
            GetVolumeInformationW(
                root_wide.as_ptr(),
                vol_name.as_mut_ptr(),
                vol_name.len() as u32,
                std::ptr::null_mut(),
                std::ptr::null_mut(),
                std::ptr::null_mut(),
                fs_name.as_mut_ptr(),
                fs_name.len() as u32,
            )
        };
        let ready = got_info != 0;
        let label = if ready { from_wide(&vol_name) } else { String::new() };
        let filesystem = if ready { from_wide(&fs_name) } else { String::new() };

        let (total_bytes, free_bytes, used_bytes) = if ready {
            let mut free_avail = 0u64;
            let mut total = 0u64;
            let mut total_free = 0u64;
            let got_space = unsafe {
                GetDiskFreeSpaceExW(root_wide.as_ptr(), &mut free_avail, &mut total, &mut total_free)
            };
            if got_space != 0 {
                (total, total_free, total.saturating_sub(total_free))
            } else {
                (0, 0, 0)
            }
        } else {
            (0, 0, 0)
        };

        out.push(DriveInfo {
            letter: letter.to_string(),
            path: root.clone(),
            label: if label.is_empty() {
                format!("Local Disk ({letter}:)")
            } else {
                label
            },
            drive_type: kind,
            filesystem,
            total_bytes,
            free_bytes,
            used_bytes,
            ready,
        });
    }

    Ok(out)
}

#[cfg(not(windows))]
pub fn list_drives() -> FlowResult<Vec<DriveInfo>> {
    Ok(Vec::new())
}
