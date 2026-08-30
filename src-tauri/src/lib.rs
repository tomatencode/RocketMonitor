use serialport::SerialPort;
use std::io::{Read, Write};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
use std::time::Duration;
use tauri::{Emitter, Manager};

const HANDSHAKE_SEND: &[u8] = &[0xAA, 0x01, 0x00, 0x15];
const HANDSHAKE_RESPONSE: &[u8] = &[0xAA, 0x02, 0x00, 0x2A];
const BAUD_RATE: u32 = 115200;

struct RocketLinkState(Mutex<Option<Box<dyn SerialPort + Send>>>);
struct SearchActive(Arc<AtomicBool>);

fn try_connect(port_name: &str) -> Option<Box<dyn SerialPort + Send>> {
    let mut port = serialport::new(port_name, BAUD_RATE)
        .timeout(Duration::from_millis(500))
        .open()
        .ok()?;
    if port.write_all(HANDSHAKE_SEND).is_err() {
        return None;
    }
    let mut response = [0u8; HANDSHAKE_RESPONSE.len()];
    if port.read_exact(&mut response).is_err() || response != HANDSHAKE_RESPONSE {
        return None;
    }
    port.set_timeout(Duration::from_millis(100)).ok()?;
    Some(port)
}

/// Starts a background thread that scans for the RocketLink and monitors the connection.
/// Emits `rocket-link-found` (payload: port name), `rocket-link-lost`, and `rocket-link-data` (payload: bytes) events.
#[tauri::command]
fn rocket_link_start_search(app: tauri::AppHandle, search: tauri::State<SearchActive>) {
    if search.0.swap(true, Ordering::SeqCst) {
        return; // already running
    }
    let should_run = Arc::clone(&search.0);
    std::thread::spawn(move || {
        let mut scan_ticker: u32 = 50; // scan immediately on first cycle
        while should_run.load(Ordering::SeqCst) {
            let port_state = app.state::<RocketLinkState>();
            // try_lock skips this cycle instead of blocking frontend sends
            if let Ok(mut guard) = port_state.0.try_lock() {
                if let Some(ref mut port) = *guard {
                    scan_ticker = 0;
                    match port.bytes_to_read() {
                        Err(_) => {
                            *guard = None;
                            drop(guard);
                            let _ = app.emit("rocket-link-lost", ());
                        }
                        Ok(0) => {}
                        Ok(n) => {
                            let mut buf = vec![0u8; n as usize];
                            match port.read(&mut buf) {
                                Ok(read) => {
                                    buf.truncate(read);
                                    drop(guard);
                                    let _ = app.emit("rocket-link-data", buf);
                                }
                                Err(_) => {
                                    *guard = None;
                                    drop(guard);
                                    let _ = app.emit("rocket-link-lost", ());
                                }
                            }
                        }
                    }
                } else {
                    scan_ticker += 1;
                    drop(guard);
                    if scan_ticker >= 50 { // scan ports every ~500ms
                        scan_ticker = 0;
                        if let Ok(ports) = serialport::available_ports() {
                            for port_info in ports {
                                if let Some(new_port) = try_connect(&port_info.port_name) {
                                    let port_name = port_info.port_name.clone();
                                    let mut g = port_state.0.lock().unwrap_or_else(|e| e.into_inner());
                                    *g = Some(new_port);
                                    drop(g);
                                    let _ = app.emit("rocket-link-found", port_name);
                                    break;
                                }
                            }
                        }
                    }
                }
            }
            std::thread::sleep(Duration::from_millis(10));
        }
    });
}

/// Stops the background search/monitor thread.
#[tauri::command]
fn rocket_link_stop_search(search: tauri::State<SearchActive>) {
    search.0.store(false, Ordering::SeqCst);
}

#[tauri::command]
fn rocket_link_is_connected(state: tauri::State<RocketLinkState>) -> bool {
    state.0.lock().unwrap_or_else(|e| e.into_inner()).is_some()
}

#[tauri::command]
fn rocket_link_get_port_name(state: tauri::State<RocketLinkState>) -> Option<String> {
    let guard = state.0.lock().unwrap_or_else(|e| e.into_inner());
    guard.as_ref().map(|port| port.name().unwrap_or_default())
}

/// Sends raw bytes to the connected RocketLink.
#[tauri::command]
fn rocket_link_send(
    app: tauri::AppHandle,
    state: tauri::State<RocketLinkState>,
    data: Vec<u8>,
) -> Result<(), String> {
    let mut guard = state.0.lock().unwrap_or_else(|e| e.into_inner());
    let result = {
        let port = guard.as_mut().ok_or("Not connected to RocketLink")?;
        port.write_all(&data)
    };
    if let Err(e) = result {
        *guard = None;
        drop(guard);
        let _ = app.emit("rocket-link-lost", ());
        return Err(e.to_string());
    }
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .manage(RocketLinkState(Mutex::new(None)))
        .manage(SearchActive(Arc::new(AtomicBool::new(false))))
        .invoke_handler(tauri::generate_handler![
            rocket_link_start_search,
            rocket_link_stop_search,
            rocket_link_is_connected,
            rocket_link_get_port_name,
            rocket_link_send,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
