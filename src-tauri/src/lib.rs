mod process;
mod port;
mod handle;

use process::{ProcessInfo, list_processes, kill_process, kill_process_tree};
use port::{PortInfo, TcpConnection, query_port, query_port_range, get_tcp_connections, get_udp_listeners};
use handle::{PathOccupation, query_path_occupation, query_file_occupation, check_path_exists, is_directory, is_file};
use serde::Serialize;

#[derive(Debug, Serialize)]
struct BatchResult {
    pid: u32,
    success: bool,
    message: String,
}

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
    // 查询端口占用
    let port_info = query_port(port, None)?;
    
    // PID 去重
    let mut unique_pids = std::collections::HashSet::new();
    for info in port_info {
        unique_pids.insert(info.pid);
    }
    
    // 结束所有占用该端口的进程
    for pid in unique_pids {
        if let Err(e) = kill_process(pid) {
            eprintln!("Failed to kill process {}: {}", pid, e);
            // 继续尝试结束其他进程
        }
    }
    
    // 二次验证：重新查询端口，确认已释放
    std::thread::sleep(std::time::Duration::from_millis(500));
    let verify_result = query_port(port, None)?;
    
    if verify_result.is_empty() {
        Ok(())
    } else {
        Err(format!("端口 {} 仍被占用，可能需要管理员权限", port))
    }
}

#[tauri::command]
fn release_path(_path: String, pids: Vec<u32>) -> Result<Vec<BatchResult>, String> {
    let mut results = Vec::new();
    
    for pid in pids {
        match kill_process(pid) {
            Ok(_) => {
                results.push(BatchResult {
                    pid,
                    success: true,
                    message: "成功".to_string(),
                });
            }
            Err(e) => {
                results.push(BatchResult {
                    pid,
                    success: false,
                    message: e,
                });
            }
        }
    }
    
    Ok(results)
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
