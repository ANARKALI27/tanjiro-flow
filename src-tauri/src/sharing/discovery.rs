//! mDNS-based LAN discovery. Every running Tanjiro Flow instance publishes
//! itself as a `_tanjiroflow._tcp.local.` service (id + display name as TXT
//! records) and browses for the same service type, so any two copies on the
//! same network segment find each other within a second or two — no server,
//! no accounts, nothing leaves the LAN.

use super::DeviceIdentity;
use mdns_sd::{ServiceDaemon, ServiceEvent, ServiceInfo};
use serde::Serialize;
use std::collections::HashMap;
use std::sync::{Arc, Mutex};
use tauri::{AppHandle, Emitter};

pub const SERVICE_TYPE: &str = "_tanjiroflow._tcp.local.";
/// Fixed port for the file-transfer TCP listener, advertised via mDNS so a
/// peer never has to guess it.
pub const TRANSFER_PORT: u16 = 53217;

#[derive(Debug, Clone, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct DeviceInfo {
    pub id: String,
    pub name: String,
    pub host: String,
    pub port: u16,
    pub addresses: Vec<String>,
}

pub struct Discovery {
    pub daemon: ServiceDaemon,
    pub devices: Arc<Mutex<HashMap<String, DeviceInfo>>>,
}

impl Discovery {
    pub fn list(&self) -> Vec<DeviceInfo> {
        let mut list: Vec<DeviceInfo> = self.devices.lock().unwrap().values().cloned().collect();
        list.sort_by(|a, b| a.name.cmp(&b.name));
        list
    }
}

/// Registers this install on the LAN and starts browsing for peers. Runs the
/// browse loop on its own background thread for the lifetime of the app; the
/// thread exits naturally when the mDNS channel closes at shutdown.
pub fn start(app: AppHandle, identity: &DeviceIdentity) -> Result<Discovery, String> {
    let daemon = ServiceDaemon::new().map_err(|e| e.to_string())?;

    let safe_id = identity
        .id
        .chars()
        .filter(|c| c.is_ascii_alphanumeric() || *c == '-')
        .collect::<String>();
    let host_name = format!("tanjiro-{safe_id}.local.");
    let props: Vec<(&str, &str)> = vec![("id", identity.id.as_str()), ("name", identity.name.as_str())];

    let service = ServiceInfo::new(
        SERVICE_TYPE,
        &identity.id,
        &host_name,
        "",
        TRANSFER_PORT,
        &props[..],
    )
    .map_err(|e| e.to_string())?
    .enable_addr_auto();

    daemon.register(service).map_err(|e| e.to_string())?;

    let receiver = daemon.browse(SERVICE_TYPE).map_err(|e| e.to_string())?;
    let devices: Arc<Mutex<HashMap<String, DeviceInfo>>> = Arc::new(Mutex::new(HashMap::new()));

    let self_id = identity.id.clone();
    let devices_for_thread = devices.clone();
    std::thread::spawn(move || {
        while let Ok(event) = receiver.recv() {
            match event {
                ServiceEvent::ServiceResolved(info) => {
                    let Some(id) = info.get_property_val_str("id") else {
                        continue;
                    };
                    if id == self_id.as_str() {
                        continue; // never show ourselves in the list
                    }
                    let name = info
                        .get_property_val_str("name")
                        .unwrap_or("Unknown Device")
                        .to_string();
                    let addresses: Vec<String> = info
                        .get_addresses()
                        .iter()
                        .map(|ip| ip.to_string())
                        .collect();
                    if addresses.is_empty() {
                        continue; // not resolvable yet
                    }
                    let device = DeviceInfo {
                        id: id.to_string(),
                        name,
                        host: info.get_hostname().to_string(),
                        port: info.get_port(),
                        addresses,
                    };
                    devices_for_thread
                        .lock()
                        .unwrap()
                        .insert(device.id.clone(), device);
                    emit_list(&app, &devices_for_thread);
                }
                ServiceEvent::ServiceRemoved(_ty, fullname) => {
                    let removed_id = fullname.split('.').next().unwrap_or("").to_string();
                    devices_for_thread.lock().unwrap().remove(&removed_id);
                    emit_list(&app, &devices_for_thread);
                }
                _ => {}
            }
        }
    });

    Ok(Discovery { daemon, devices })
}

fn emit_list(app: &AppHandle, devices: &Arc<Mutex<HashMap<String, DeviceInfo>>>) {
    let mut list: Vec<DeviceInfo> = devices.lock().unwrap().values().cloned().collect();
    list.sort_by(|a, b| a.name.cmp(&b.name));
    let _ = app.emit("devices://changed", list);
}
