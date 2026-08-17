use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use windows::Win32::Foundation::CloseHandle;
use windows::Win32::System::Diagnostics::ToolHelp::{
    CreateToolhelp32Snapshot, Process32First, Process32Next, PROCESSENTRY32, TH32CS_SNAPPROCESS,
};
use windows::Win32::System::ProcessStatus::{K32GetProcessMemoryInfo, PROCESS_MEMORY_COUNTERS};
use windows::Win32::System::Threading::{
    OpenProcess, TerminateProcess, QueryFullProcessImageNameW,
    PROCESS_QUERY_LIMITED_INFORMATION, PROCESS_TERMINATE, PROCESS_VM_READ, PROCESS_NAME_WIN32,
};
use windows::core::PWSTR;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProcessInfo {
    pub pid: u32,
    pub name: String,
    pub path: String,
    pub parent_pid: u32,
    pub threads: u32,
    pub memory: u64,
}

pub fn list_processes() -> Result<Vec<ProcessInfo>, String> {
    unsafe {
        let snapshot = CreateToolhelp32Snapshot(TH32CS_SNAPPROCESS, 0)
            .map_err(|e| format!("Failed to create snapshot: {:?}", e))?;

        let mut processes = Vec::new();
        let mut entry = PROCESSENTRY32 {
            dwSize: std::mem::size_of::<PROCESSENTRY32>() as u32,
            ..Default::default()
        };

        if Process32First(snapshot, &mut entry).is_ok() {
            loop {
                let pid = entry.th32ProcessID;
                // 将 i8 数组转换为 u8 数组
                let name_bytes: Vec<u8> = entry.szExeFile.iter().map(|&b| b as u8).collect();
                let name = String::from_utf8_lossy(&name_bytes)
                    .trim_end_matches('\0')
                    .to_string();

                let path = get_process_path(pid).unwrap_or_default();
                let memory = get_process_memory(pid).unwrap_or(0);

                processes.push(ProcessInfo {
                    pid,
                    name,
                    path,
                    parent_pid: entry.th32ParentProcessID,
                    threads: entry.cntThreads,
                    memory,
                });

                if Process32Next(snapshot, &mut entry).is_err() {
                    break;
                }
            }
        }

        let _ = CloseHandle(snapshot);
        Ok(processes)
    }
}

pub fn get_process_path(pid: u32) -> Result<String, String> {
    unsafe {
        let process = OpenProcess(
            PROCESS_QUERY_LIMITED_INFORMATION,
            false,
            pid,
        )
        .map_err(|e| format!("Failed to open process: {:?}", e))?;

        let mut buffer = vec![0u16; 32768]; // MAX_PATH * 8
        let mut size = buffer.len() as u32;
        
        let result = QueryFullProcessImageNameW(
            process,
            PROCESS_NAME_WIN32,
            PWSTR(buffer.as_mut_ptr()),
            &mut size,
        );
        
        let _ = CloseHandle(process);

        if result.is_ok() && size > 0 {
            // 转换 UTF-16 到 String
            let path = String::from_utf16_lossy(&buffer[..size as usize]);
            Ok(path)
        } else {
            Err("Failed to get process path".to_string())
        }
    }
}

pub fn get_process_memory(pid: u32) -> Result<u64, String> {
    unsafe {
        let process = OpenProcess(
            PROCESS_QUERY_LIMITED_INFORMATION | PROCESS_VM_READ,
            false,
            pid,
        )
        .map_err(|_| "Failed to open process".to_string())?;

        let mut pmc = PROCESS_MEMORY_COUNTERS {
            cb: std::mem::size_of::<PROCESS_MEMORY_COUNTERS>() as u32,
            ..Default::default()
        };

        if K32GetProcessMemoryInfo(process, &mut pmc, pmc.cb).as_bool() {
            let _ = CloseHandle(process);
            Ok(pmc.WorkingSetSize as u64)
        } else {
            let _ = CloseHandle(process);
            Err("Failed to get memory info".to_string())
        }
    }
}

// 系统关键进程列表 - 与前端保持一致
const SYSTEM_CRITICAL_PROCESSES: &[&str] = &[
    "devunlock.exe",
    "system",
    "registry",
    "smss.exe",
    "csrss.exe",
    "wininit.exe",
    "winlogon.exe",
    "services.exe",
    "lsass.exe",
    "svchost.exe",
    "dwm.exe",
    "fontdrvhost.exe",
    "conhost.exe",
];

// 检查是否为系统关键进程
pub fn is_system_critical_process(pid: u32, name: &str) -> bool {
    // PID 0-10 通常是系统保留
    if pid <= 10 {
        return true;
    }
    
    // 精确匹配进程名称，不使用 starts_with 避免误判
    // 例如：system 不应该匹配 SystemSettings.exe
    let name_lower = name.to_lowercase();
    SYSTEM_CRITICAL_PROCESSES.iter().any(|&critical| {
        name_lower == critical
    })
}

// 公开 API 供前端查询保护状态
pub fn check_process_protected(pid: u32, name: &str) -> bool {
    is_system_critical_process(pid, name)
}

pub fn kill_process(pid: u32) -> Result<(), String> {
    // 获取当前进程 PID，防止自杀
    let current_pid = std::process::id();
    if pid == current_pid {
        return Err("不能结束 DevUnlock 自身进程".to_string());
    }
    
    // 检查是否为系统关键进程 - fail-safe: 无法确认时拒绝
    let processes = list_processes()
        .map_err(|_| "无法枚举进程列表，出于安全考虑拒绝操作".to_string())?;
    
    if let Some(process) = processes.iter().find(|p| p.pid == pid) {
        if is_system_critical_process(pid, &process.name) {
            return Err(format!(
                "拒绝结束系统关键进程: {} (PID: {})",
                process.name, pid
            ));
        }
    } else {
        // 找不到进程信息，出于安全考虑拒绝
        return Err(format!("无法获取进程 {} 的信息，拒绝操作", pid));
    }
    
    unsafe {
        let process = OpenProcess(PROCESS_TERMINATE, false, pid)
            .map_err(|e| format!("Failed to open process for termination: {:?}", e))?;

        let result = TerminateProcess(process, 1);
        let _ = CloseHandle(process);

        result.map_err(|e| format!("Failed to terminate process: {:?}", e))
    }
}

pub fn get_process_tree(processes: &[ProcessInfo]) -> HashMap<u32, Vec<u32>> {
    let mut tree: HashMap<u32, Vec<u32>> = HashMap::new();

    for process in processes {
        tree.entry(process.parent_pid)
            .or_insert_with(Vec::new)
            .push(process.pid);
    }

    tree
}

pub fn kill_process_tree(pid: u32) -> Result<(), String> {
    let processes = list_processes()?;
    let tree = get_process_tree(&processes);
    
    // 先检查根节点是否受保护，如果是则立即拒绝
    if let Some(root_process) = processes.iter().find(|p| p.pid == pid) {
        if is_system_critical_process(pid, &root_process.name) {
            return Err(format!(
                "拒绝结束系统关键进程树: {} (PID: {})",
                root_process.name, pid
            ));
        }
    }
    
    // 构建进程信息映射，用于快速查找
    let process_map: HashMap<u32, &ProcessInfo> = processes
        .iter()
        .map(|p| (p.pid, p))
        .collect();

    fn kill_recursive(
        pid: u32,
        tree: &HashMap<u32, Vec<u32>>,
        process_map: &HashMap<u32, &ProcessInfo>,
        errors: &mut Vec<String>,
    ) {
        // 先检查当前节点是否受保护
        if let Some(process) = process_map.get(&pid) {
            if is_system_critical_process(pid, &process.name) {
                // 受保护的子进程，跳过整个子树
                errors.push(format!(
                    "跳过受保护进程及其子树: {} (PID: {})",
                    process.name, pid
                ));
                return;
            }
        }
        
        // 递归处理子进程
        if let Some(children) = tree.get(&pid) {
            for &child_pid in children {
                kill_recursive(child_pid, tree, process_map, errors);
            }
        }

        // 最后结束当前进程
        if let Err(e) = kill_process(pid) {
            errors.push(format!("Failed to kill process {}: {}", pid, e));
        }
    }

    let mut errors = Vec::new();
    kill_recursive(pid, &tree, &process_map, &mut errors);

    if errors.is_empty() {
        Ok(())
    } else {
        Err(errors.join("; "))
    }
}
