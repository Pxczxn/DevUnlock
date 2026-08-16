mod process;
mod port;
mod handle;

use process::{ProcessInfo, list_processes, kill_process, kill_process_tree, get_process_path};
use port::{PortInfo, TcpConnection, query_port, query_port_range, get_tcp_connections, get_udp_listeners};
use handle::{PathOccupation, query_path_occupation, query_file_occupation, check_path_exists, is_directory, is_file};

// Process commands
#[tauri::command]
fn list_all_processes() -> Result<Vec<ProcessInfo>, String> {
    list_processes()
}

#[tauri::command]
fn get_process_info(pid: u32) -> Result<ProcessInfo, String> {
    let processes = list_processes()?;
    processes
        .into_iter()
        .find(|p| p.pid == pid)
        .ok_or_else(|| "Process not found".to_string())
}

#[tauri::command]
fn terminate_process(pid: u32) -> Result<(), String> {
    kill_process(pid)
}

#[tauri::command]
fn terminate_process_tree(pid: u32) -> Result<(), String> {
    kill_process_tree(pid)
}

// Port commands
#[tauri::command]
fn query_single_port(port: u16, protocol: Option<String>) -> Result<Vec<PortInfo>, String> {
    query_port(port, protocol)
}

#[tauri::command]
fn query_multiple_ports(ports: Vec<u16>) -> Result<Vec<PortInfo>, String> {
    let mut results = Vec::new();
    for port in ports {
        match query_port(port, None) {
            Ok(mut port_infos) => results.append(&mut port_infos),
            Err(_) => continue,
        }
    }
    Ok(results)
}

#[tauri::command]
fn query_ports_range(start: u16, end: u16) -> Result<Vec<PortInfo>, String> {
    query_port_range(start, end)
}

#[tauri::command]
fn get_all_tcp_connections() -> Result<Vec<TcpConnection>, String> {
    get_tcp_connections()
}

#[tauri::command]
fn get_all_udp_listeners() -> Result<Vec<PortInfo>, String> {
    get_udp_listeners()
}

// Path/File occupation commands
#[tauri::command]
fn query_path(path: String) -> Result<Vec<PathOccupation>, String> {
    query_path_occupation(&path)
}

#[tauri::command]
fn query_file(path: String) -> Result<Vec<PathOccupation>, String> {
    query_file_occupation(&path)
}

#[tauri::command]
fn validate_path(path: String) -> Result<bool, String> {
    Ok(check_path_exists(&path))
}

#[tauri::command]
fn check_is_directory(path: String) -> Result<bool, String> {
    Ok(is_directory(&path))
}

#[tauri::command]
fn check_is_file(path: String) -> Result<bool, String> {
    Ok(is_file(&path))
}

// Batch operations
#[tauri::command]
fn release_port(port: u16) -> Result<(), String> {
    let port_info = query_port(port, None)?;
    for info in port_info {
        kill_process(info.pid)?;
    }
    Ok(())
}

#[tauri::command]
fn release_path(path: String, pids: Vec<u32>) -> Result<(), String> {
    for pid in pids {
        if let Err(e) = kill_process(pid) {
            eprintln!("Failed to kill process {}: {}", pid, e);
        }
    }
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .invoke_handler(tauri::generate_handler![
            list_all_processes,
            get_process_info,
            terminate_process,
            terminate_process_tree,
            query_single_port,
            query_multiple_ports,
            query_ports_range,
            get_all_tcp_connections,
            get_all_udp_listeners,
            query_path,
            query_file,
            validate_path,
            check_is_directory,
            check_is_file,
            release_port,
            release_path,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
