//! Nearby Devices + Sharing: LAN-only, mDNS-based device discovery and a
//! simple length-prefixed TCP file-transfer protocol. There is no cloud
//! relay and no account system here — this only ever talks to other
//! Tanjiro Flow instances that answer on the same local network segment,
//! found the same way AirDrop/KDE Connect find each other.

pub mod discovery;
pub mod transfer;

use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use std::sync::{Arc, Mutex};

pub use discovery::DeviceInfo;
pub use transfer::{FileHeader, IncomingOfferPayload, ReceivedItem};

/// This install's stable identity, persisted to disk so a device keeps the
/// same ID — and therefore the same place in a peer's discovered-devices
/// list — across restarts, even after the display name changes.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DeviceIdentity {
    pub id: String,
    pub name: String,
}

fn identity_path() -> Option<PathBuf> {
    dirs::config_dir().map(|d| d.join("Tanjiro Flow").join("identity.json"))
}

pub fn load_or_create_identity() -> DeviceIdentity {
    if let Some(path) = identity_path() {
        if let Ok(text) = fs::read_to_string(&path) {
            if let Ok(identity) = serde_json::from_str::<DeviceIdentity>(&text) {
                return identity;
            }
        }
    }
    let id = uuid::Uuid::new_v4().to_string();
    let who = std::env::var("USERNAME")
        .or_else(|_| std::env::var("USER"))
        .unwrap_or_else(|_| "Someone".into());
    let identity = DeviceIdentity {
        id,
        name: format!("{who}'s PC"),
    };
    save_identity(&identity);
    identity
}

pub fn save_identity(identity: &DeviceIdentity) {
    if let Some(path) = identity_path() {
        if let Some(parent) = path.parent() {
            let _ = fs::create_dir_all(parent);
        }
        if let Ok(text) = serde_json::to_string_pretty(identity) {
            let _ = fs::write(&path, text);
        }
    }
}

/// Where incoming shares land. A subfolder of Downloads, same as most other
/// LAN-sharing tools, so it's somewhere the user already knows to look.
pub fn shares_dir() -> PathBuf {
    let base = dirs::download_dir().unwrap_or_else(|| PathBuf::from("."));
    let dir = base.join("Tanjiro Flow Shares");
    let _ = fs::create_dir_all(&dir);
    dir
}

fn received_log_path() -> PathBuf {
    shares_dir().join(".received.json")
}

pub fn load_received() -> Vec<ReceivedItem> {
    fs::read_to_string(received_log_path())
        .ok()
        .and_then(|t| serde_json::from_str(&t).ok())
        .unwrap_or_default()
}

pub fn record_received(item: ReceivedItem) -> Vec<ReceivedItem> {
    let mut items = load_received();
    items.insert(0, item);
    items.truncate(200);
    if let Ok(text) = serde_json::to_string_pretty(&items) {
        let _ = fs::write(received_log_path(), text);
    }
    items
}

/// Tauri-managed state backing every sharing/discovery command.
pub struct SharingState {
    pub identity: Mutex<DeviceIdentity>,
    pub discovery: Mutex<Option<discovery::Discovery>>,
    pub transfer: Arc<transfer::TransferState>,
}

impl SharingState {
    pub fn new() -> Self {
        Self {
            identity: Mutex::new(load_or_create_identity()),
            discovery: Mutex::new(None),
            transfer: Arc::new(transfer::TransferState::new()),
        }
    }

    pub fn transfer_arc(&self) -> Arc<transfer::TransferState> {
        self.transfer.clone()
    }
}

impl Default for SharingState {
    fn default() -> Self {
        Self::new()
    }
}
