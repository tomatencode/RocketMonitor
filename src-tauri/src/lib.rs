use serialport::SerialPort;
use std::io::{Read, Write};
use std::sync::Mutex;
use std::time::Duration;

const HANDSHAKE_SEND: &[u8] = &[0xAA, 0x01, 0x00, 0x01];
const HANDSHAKE_RESPONSE: &[u8] = &[
    0xAA, 0x02, 0x0A, 0x52, 0x6F, 0x63, 0x6B, 0x65, 0x74, 0x4C, 0x69, 0x6E, 0x6B, 0x0C,
];
const BAUD_RATE: u32 = 115200;

struct RocketLinkState(Mutex<Option<Box<dyn SerialPort + Send>>>);

fn try_handshake(port_name: &str) -> bool {
    let Ok(mut port) = serialport::new(port_name, BAUD_RATE)
        .timeout(Duration::from_millis(500))
        .open()
    else {
        return false;
    };
    if port.write_all(HANDSHAKE_SEND).is_err() {
        return false;
    }
    let mut response = [0u8; 14];
    port.read_exact(&mut response).is_ok() && response == HANDSHAKE_RESPONSE
}

/// Opens a connection to the RocketLink
#[tauri::command]
fn rocket_link_connect(
    state: tauri::State<RocketLinkState>
) -> Result<String, String> {
    let ports = serialport::available_ports().map_err(|e| e.to_string())?;
    for port_info in ports {
        if try_handshake(&port_info.port_name) {
                let port = serialport::new(&port_info.port_name, BAUD_RATE)
                .timeout(Duration::from_millis(100))
                .open()
                .map_err(|e| e.to_string())?;
            *state.0.lock().unwrap() = Some(port);
            return Ok(port_info.port_name);
        }
    }
    Err("RocketLink device not found".to_string())
}

/// Closes the active RocketLink connection.
#[tauri::command]
fn rocket_link_disconnect(state: tauri::State<RocketLinkState>) {
    *state.0.lock().unwrap() = None;
}

#[tauri::command]
fn rocket_link_is_connected(state: tauri::State<RocketLinkState>) -> bool {
    state.0.lock().unwrap().is_some()
}

#[tauri::command]
fn rocket_link_get_port_name(state: tauri::State<RocketLinkState>) -> Option<String> {
    let guard = state.0.lock().unwrap();
    guard.as_ref().map(|port| port.name().unwrap_or_default())
}

/// Sends raw bytes to the connected RocketLink.
#[tauri::command]
fn rocket_link_send(
    state: tauri::State<RocketLinkState>,
    data: Vec<u8>,
) -> Result<(), String> {
    let mut guard = state.0.lock().unwrap();
    let port = guard.as_mut().ok_or("Not connected to RocketLink")?;
    port.write_all(&data).map_err(|e| e.to_string())
}

/// Returns all bytes currently available in the receive buffer.
#[tauri::command]
fn rocket_link_read(state: tauri::State<RocketLinkState>) -> Result<Vec<u8>, String> {
    let mut guard = state.0.lock().unwrap();
    let port = guard.as_mut().ok_or("Not connected to RocketLink")?;
    let n = port.bytes_to_read().map_err(|e| e.to_string())?;
    if n == 0 {
        return Ok(vec![]);
    }
    let mut buf = vec![0u8; n as usize];
    let read = port.read(&mut buf).map_err(|e| e.to_string())?;
    buf.truncate(read);
    Ok(buf)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .manage(RocketLinkState(Mutex::new(None)))
        .invoke_handler(tauri::generate_handler![
            rocket_link_connect,
            rocket_link_disconnect,
            rocket_link_is_connected,
            rocket_link_get_port_name,
            rocket_link_send,
            rocket_link_read,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
