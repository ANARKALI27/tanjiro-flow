//! The wire protocol: a 4-byte big-endian length prefix followed by that
//! many bytes of UTF-8 JSON (the "offer" header), then a single response
//! byte (1 = accept, 0 = decline) from the receiver, then — if accepted —
//! every file's raw bytes back to back, in the order listed in the header.
//! Deliberately simple: this only ever needs to talk to another copy of
//! this same app.

use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs::File;
use std::io::{Read, Write};
use std::net::{IpAddr, TcpListener, TcpStream};
use std::path::PathBuf;
use std::sync::Mutex;
use tauri::{AppHandle, Emitter};

const CHUNK: usize = 64 * 1024;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FileHeader {
    pub name: String,
    pub size: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct OfferHeader {
    sender_id: String,
    sender_name: String,
    files: Vec<FileHeader>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct IncomingOfferPayload {
    pub transfer_id: String,
    pub from_name: String,
    pub files: Vec<FileHeader>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProgressEvent {
    pub transfer_id: String,
    pub direction: &'static str,
    pub done: u64,
    pub total: u64,
    pub current_file: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CompleteEvent {
    pub transfer_id: String,
    pub ok: bool,
    pub error: Option<String>,
    pub direction: &'static str,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ReceivedItem {
    pub name: String,
    pub path: String,
    pub size: u64,
    pub from_name: String,
    pub received_at: u64,
}

struct PendingOffer {
    stream: TcpStream,
    files: Vec<FileHeader>,
    from_name: String,
}

pub struct TransferState {
    pending: Mutex<HashMap<String, PendingOffer>>,
}

impl TransferState {
    pub fn new() -> Self {
        Self {
            pending: Mutex::new(HashMap::new()),
        }
    }
}

fn write_header<W: Write>(w: &mut W, header: &OfferHeader) -> std::io::Result<()> {
    let bytes = serde_json::to_vec(header).map_err(std::io::Error::other)?;
    w.write_all(&(bytes.len() as u32).to_be_bytes())?;
    w.write_all(&bytes)
}

fn read_header<R: Read>(r: &mut R) -> std::io::Result<OfferHeader> {
    let mut len_buf = [0u8; 4];
    r.read_exact(&mut len_buf)?;
    let len = u32::from_be_bytes(len_buf) as usize;
    if len > 8 * 1024 * 1024 {
        return Err(std::io::Error::other("offer header too large"));
    }
    let mut buf = vec![0u8; len];
    r.read_exact(&mut buf)?;
    serde_json::from_slice(&buf).map_err(std::io::Error::other)
}

fn now_millis() -> u64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_millis() as u64)
        .unwrap_or(0)
}

// ---------------------------------------------------------------------------
// Receiving
// ---------------------------------------------------------------------------

/// Starts the TCP listener for incoming shares. Every accepted connection is
/// handled on its own thread: read the offer, surface it to the frontend,
/// and park the open socket in `state.pending` until the user responds.
pub fn run_listener(app: AppHandle, pending: std::sync::Arc<TransferState>, port: u16) {
    std::thread::spawn(move || {
        let listener = match TcpListener::bind(("0.0.0.0", port)) {
            Ok(l) => l,
            Err(e) => {
                eprintln!("Tanjiro Flow: could not start the sharing listener on port {port}: {e}");
                return;
            }
        };
        for conn in listener.incoming().flatten() {
            let app = app.clone();
            let pending = pending.clone();
            std::thread::spawn(move || {
                let _ = handle_incoming_connection(conn, app, pending);
            });
        }
    });
}

fn handle_incoming_connection(
    mut stream: TcpStream,
    app: AppHandle,
    state: std::sync::Arc<TransferState>,
) -> std::io::Result<()> {
    let header = read_header(&mut stream)?;
    let transfer_id = uuid::Uuid::new_v4().to_string();

    let payload = IncomingOfferPayload {
        transfer_id: transfer_id.clone(),
        from_name: header.sender_name.clone(),
        files: header.files.clone(),
    };

    state.pending.lock().unwrap().insert(
        transfer_id.clone(),
        PendingOffer {
            stream,
            files: header.files,
            from_name: header.sender_name,
        },
    );

    let _ = app.emit("share://incoming-offer", payload);
    Ok(())
}

/// Called from the `share_respond` command once the user accepts or
/// declines a toast. Runs on its own thread since a large transfer can take
/// a while and must never block the IPC thread.
pub fn respond(
    state: &TransferState,
    transfer_id: String,
    accept: bool,
    app: AppHandle,
) -> Result<(), String> {
    let offer = state
        .pending
        .lock()
        .unwrap()
        .remove(&transfer_id)
        .ok_or_else(|| "That transfer is no longer waiting.".to_string())?;

    std::thread::spawn(move || {
        if let Err(e) = receive_files(offer, transfer_id.clone(), accept, &app) {
            let _ = app.emit(
                "share://complete",
                CompleteEvent {
                    transfer_id,
                    ok: false,
                    error: Some(e.to_string()),
                    direction: "receive",
                },
            );
        }
    });
    Ok(())
}

fn receive_files(
    mut offer: PendingOffer,
    transfer_id: String,
    accept: bool,
    app: &AppHandle,
) -> std::io::Result<()> {
    offer.stream.write_all(&[if accept { 1 } else { 0 }])?;

    if !accept {
        let _ = app.emit(
            "share://complete",
            CompleteEvent {
                transfer_id,
                ok: false,
                error: Some("Declined.".into()),
                direction: "receive",
            },
        );
        return Ok(());
    }

    let dest_dir = super::shares_dir();
    let total: u64 = offer.files.iter().map(|f| f.size).sum();
    let mut done: u64 = 0;
    let mut buf = vec![0u8; CHUNK];
    let mut saved: Vec<ReceivedItem> = Vec::new();

    for f in &offer.files {
        let dest_path = crate::filesystem::unique_destination(&dest_dir.join(&f.name));
        let mut file = File::create(&dest_path)?;
        let mut remaining = f.size;
        while remaining > 0 {
            let to_read = remaining.min(buf.len() as u64) as usize;
            offer.stream.read_exact(&mut buf[..to_read])?;
            file.write_all(&buf[..to_read])?;
            remaining -= to_read as u64;
            done += to_read as u64;
            let _ = app.emit(
                "share://progress",
                ProgressEvent {
                    transfer_id: transfer_id.clone(),
                    direction: "receive",
                    done,
                    total,
                    current_file: f.name.clone(),
                },
            );
        }
        saved.push(ReceivedItem {
            name: dest_path
                .file_name()
                .map(|n| n.to_string_lossy().to_string())
                .unwrap_or_else(|| f.name.clone()),
            path: dest_path.to_string_lossy().to_string(),
            size: f.size,
            from_name: offer.from_name.clone(),
            received_at: now_millis(),
        });
    }

    let mut latest = Vec::new();
    for item in saved {
        latest = super::record_received(item);
    }
    let _ = app.emit("shared://received", &latest);

    let _ = app.emit(
        "share://complete",
        CompleteEvent {
            transfer_id,
            ok: true,
            error: None,
            direction: "receive",
        },
    );
    Ok(())
}

// ---------------------------------------------------------------------------
// Sending
// ---------------------------------------------------------------------------

pub fn send_files(
    app: AppHandle,
    sender_id: String,
    sender_name: String,
    addresses: Vec<String>,
    port: u16,
    paths: Vec<String>,
) -> Result<String, String> {
    let transfer_id = uuid::Uuid::new_v4().to_string();
    let app2 = app.clone();
    let tid = transfer_id.clone();

    std::thread::spawn(move || {
        if let Err(e) = send_files_inner(&app2, &tid, sender_id, sender_name, addresses, port, paths)
        {
            let _ = app2.emit(
                "share://complete",
                CompleteEvent {
                    transfer_id: tid,
                    ok: false,
                    error: Some(e),
                    direction: "send",
                },
            );
        }
    });

    Ok(transfer_id)
}

fn send_files_inner(
    app: &AppHandle,
    transfer_id: &str,
    sender_id: String,
    sender_name: String,
    addresses: Vec<String>,
    port: u16,
    paths: Vec<String>,
) -> Result<(), String> {
    let mut headers = Vec::new();
    let mut sources: Vec<PathBuf> = Vec::new();
    for p in &paths {
        let path = PathBuf::from(p);
        let meta = std::fs::metadata(&path).map_err(|e| format!("Couldn't read \"{p}\": {e}"))?;
        if meta.is_dir() {
            return Err(format!(
                "\"{}\" is a folder — only individual files can be sent right now.",
                path.file_name().map(|n| n.to_string_lossy().to_string()).unwrap_or_default()
            ));
        }
        let name = path
            .file_name()
            .map(|n| n.to_string_lossy().to_string())
            .unwrap_or_else(|| "file".into());
        headers.push(FileHeader { name, size: meta.len() });
        sources.push(path);
    }

    let mut stream = connect_any(&addresses, port)?;
    write_header(
        &mut stream,
        &OfferHeader {
            sender_id,
            sender_name,
            files: headers.clone(),
        },
    )
    .map_err(|e| e.to_string())?;

    let mut ack = [0u8; 1];
    stream.read_exact(&mut ack).map_err(|e| e.to_string())?;
    if ack[0] != 1 {
        return Err("The other device declined the transfer.".into());
    }

    let total: u64 = headers.iter().map(|f| f.size).sum();
    let mut done: u64 = 0;
    let mut buf = vec![0u8; CHUNK];

    for (path, header) in sources.iter().zip(headers.iter()) {
        let mut file = File::open(path).map_err(|e| e.to_string())?;
        loop {
            let n = file.read(&mut buf).map_err(|e| e.to_string())?;
            if n == 0 {
                break;
            }
            stream.write_all(&buf[..n]).map_err(|e| e.to_string())?;
            done += n as u64;
            let _ = app.emit(
                "share://progress",
                ProgressEvent {
                    transfer_id: transfer_id.to_string(),
                    direction: "send",
                    done,
                    total,
                    current_file: header.name.clone(),
                },
            );
        }
    }

    let _ = app.emit(
        "share://complete",
        CompleteEvent {
            transfer_id: transfer_id.to_string(),
            ok: true,
            error: None,
            direction: "send",
        },
    );
    Ok(())
}

fn connect_any(addresses: &[String], port: u16) -> Result<TcpStream, String> {
    let mut ips: Vec<IpAddr> = addresses.iter().filter_map(|a| a.parse().ok()).collect();
    // Prefer IPv4 — it's the common case on a home LAN and avoids link-local
    // IPv6 scope-id headaches.
    ips.sort_by_key(|ip| if ip.is_ipv4() { 0 } else { 1 });

    for ip in &ips {
        if let Ok(stream) = TcpStream::connect_timeout(
            &std::net::SocketAddr::new(*ip, port),
            std::time::Duration::from_secs(4),
        ) {
            return Ok(stream);
        }
    }
    Err("Couldn't reach that device — it may have gone offline or left the network.".into())
}
