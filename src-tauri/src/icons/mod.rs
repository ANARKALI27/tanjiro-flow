//! Extracts a file's *real* Windows icon (the one Explorer shows) as a PNG
//! data URL, for `.exe` / `.lnk` and friends where Tanjiro Flow's built-in
//! `KindIcon` glyphs are too generic to tell one app apart from another.
//!
//! `SHGetFileInfoW` is the one call that does the hard part for us: given a
//! path it resolves `.lnk` shortcuts to their target automatically and pulls
//! whichever icon Explorer itself would show (embedded exe icon, shell
//! association icon, etc). What's left is turning the `HICON` it hands back
//! into pixels: `GetIconInfo` gets us the icon's color bitmap, `GetObjectW`
//! tells us its size, and `GetDIBits` copies out the raw 32bpp pixels as a
//! top-down BGRA buffer. Windows stores that buffer's color channels
//! premultiplied by alpha, so before it's usable as ordinary RGBA we have to
//! undo that and swap channel order — both done in one pass below.

use crate::error::{FlowError, FlowResult};

#[cfg(windows)]
pub fn file_icon_data_url(path: &str) -> FlowResult<String> {
    use base64::Engine;
    use std::ffi::OsStr;
    use std::iter::once;
    use std::os::windows::ffi::OsStrExt;
    use windows_sys::Win32::Graphics::Gdi::{
        CreateCompatibleDC, DeleteDC, DeleteObject, GetDIBits, GetObjectW, BITMAP, BITMAPINFO,
        BITMAPINFOHEADER, BI_RGB, DIB_RGB_COLORS,
    };
    use windows_sys::Win32::System::Com::{CoInitializeEx, CoUninitialize, COINIT_APARTMENTTHREADED};
    use windows_sys::Win32::UI::Shell::{SHFILEINFOW, SHGFI_ICON, SHGFI_LARGEICON, SHGetFileInfoW};
    use windows_sys::Win32::UI::WindowsAndMessaging::{DestroyIcon, GetIconInfo, ICONINFO};

    let wide: Vec<u16> = OsStr::new(path).encode_wide().chain(once(0)).collect();

    unsafe {
        // SHGetFileInfoW resolves `.lnk` targets via IShellLink/IPersistFile under
        // the hood, which needs COM initialized on *this* thread — and since this
        // runs on a tokio blocking-pool thread (a fresh OS thread with no COM
        // state), it silently returns a null icon without this. (S_OK/S_FALSE are
        // both fine here; S_FALSE just means some other call already initialized
        // COM on this thread with a compatible model.)
        let hr_init = CoInitializeEx(std::ptr::null(), COINIT_APARTMENTTHREADED as u32);
        let com_ready = hr_init >= 0;

        let mut sfi: SHFILEINFOW = std::mem::zeroed();
        let got = SHGetFileInfoW(
            wide.as_ptr(),
            0,
            &mut sfi,
            std::mem::size_of::<SHFILEINFOW>() as u32,
            SHGFI_ICON | SHGFI_LARGEICON,
        );
        if got == 0 || sfi.hIcon.is_null() {
            if com_ready {
                CoUninitialize();
            }
            return Err(FlowError::Other(format!("No icon available for {path}")));
        }
        let hicon = sfi.hIcon;

        let mut icon_info: ICONINFO = std::mem::zeroed();
        if GetIconInfo(hicon, &mut icon_info) == 0 {
            DestroyIcon(hicon);
            if com_ready {
                CoUninitialize();
            }
            return Err(FlowError::Other("Couldn't read icon info".into()));
        }
        // The mask bitmap only matters for 1bpp legacy icons; modern 32bpp
        // icons carry their own alpha channel in the color bitmap, so it's
        // safe to free the mask immediately.
        if !icon_info.hbmMask.is_null() {
            DeleteObject(icon_info.hbmMask);
        }
        let hbm_color = icon_info.hbmColor;
        if hbm_color.is_null() {
            DestroyIcon(hicon);
            if com_ready {
                CoUninitialize();
            }
            return Err(FlowError::Other("Icon has no color bitmap".into()));
        }

        let mut bmp: BITMAP = std::mem::zeroed();
        let got_bmp = GetObjectW(
            hbm_color,
            std::mem::size_of::<BITMAP>() as i32,
            &mut bmp as *mut BITMAP as *mut core::ffi::c_void,
        );
        if got_bmp == 0 {
            DeleteObject(hbm_color);
            DestroyIcon(hicon);
            if com_ready {
                CoUninitialize();
            }
            return Err(FlowError::Other("Couldn't read bitmap dimensions".into()));
        }

        let width = bmp.bmWidth;
        let height = bmp.bmHeight;
        if width <= 0 || height <= 0 {
            DeleteObject(hbm_color);
            DestroyIcon(hicon);
            if com_ready {
                CoUninitialize();
            }
            return Err(FlowError::Other("Icon bitmap has invalid dimensions".into()));
        }

        let hdc = CreateCompatibleDC(std::ptr::null_mut());
        if hdc.is_null() {
            DeleteObject(hbm_color);
            DestroyIcon(hicon);
            if com_ready {
                CoUninitialize();
            }
            return Err(FlowError::Other("CreateCompatibleDC failed".into()));
        }

        let mut bmi: BITMAPINFO = std::mem::zeroed();
        bmi.bmiHeader.biSize = std::mem::size_of::<BITMAPINFOHEADER>() as u32;
        bmi.bmiHeader.biWidth = width;
        // Negative height requests a top-down DIB, matching how we'll hand
        // the buffer straight to `image::RgbaImage` without a manual flip.
        bmi.bmiHeader.biHeight = -height;
        bmi.bmiHeader.biPlanes = 1;
        bmi.bmiHeader.biBitCount = 32;
        bmi.bmiHeader.biCompression = BI_RGB;

        let mut buffer = vec![0u8; (width as usize) * (height as usize) * 4];
        let lines = GetDIBits(
            hdc,
            hbm_color,
            0,
            height as u32,
            buffer.as_mut_ptr() as *mut core::ffi::c_void,
            &mut bmi,
            DIB_RGB_COLORS,
        );

        DeleteDC(hdc);
        DeleteObject(hbm_color);
        DestroyIcon(hicon);
        if com_ready {
            CoUninitialize();
        }

        if lines == 0 {
            return Err(FlowError::Other("GetDIBits returned no scanlines".into()));
        }

        // Un-premultiply alpha and reorder BGRA -> RGBA in one pass.
        for px in buffer.chunks_exact_mut(4) {
            let (b, g, r, a) = (px[0], px[1], px[2], px[3]);
            if a == 0 {
                px[0] = 0;
                px[1] = 0;
                px[2] = 0;
                px[3] = 0;
            } else {
                let unpremul = |c: u8| -> u8 { ((c as u32 * 255) / a as u32).min(255) as u8 };
                px[0] = unpremul(r);
                px[1] = unpremul(g);
                px[2] = unpremul(b);
                px[3] = a;
            }
        }

        let img = image::RgbaImage::from_raw(width as u32, height as u32, buffer)
            .ok_or_else(|| FlowError::Other("Icon pixel buffer had the wrong size".into()))?;
        let dynimg = image::DynamicImage::ImageRgba8(img);

        let mut png_bytes: Vec<u8> = Vec::new();
        {
            let mut cursor = std::io::Cursor::new(&mut png_bytes);
            dynimg
                .write_to(&mut cursor, image::ImageFormat::Png)
                .map_err(|e| FlowError::Other(format!("PNG encode failed: {e}")))?;
        }

        let b64 = base64::engine::general_purpose::STANDARD.encode(&png_bytes);
        Ok(format!("data:image/png;base64,{b64}"))
    }
}

#[cfg(not(windows))]
pub fn file_icon_data_url(path: &str) -> FlowResult<String> {
    let _ = path;
    Err(FlowError::Unsupported("Only implemented on Windows.".into()))
}
