use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use windows::Win32::Foundation::{CloseHandle, HANDLE};
use windows::Win32::System::Diagnostics::ToolHelp::{
    CreateToolhelp32Snapshot, Process32First, Process32Next, PROCESSENTRY32, TH32CS_SNAPPROCESS,
};
use windows::Win32::System::ProcessStatus::{GetModuleFileNameExA, K32GetProcessMemoryInfo, PROCESS_MEMORY_COUNTERS};
use windows::Win32::System::Threading::{
    OpenProcess, TerminateProcess, PROCESS_QUERY_INFORMATION, PROCESS_TERMINATE, PROCESS_VM_READ,
};

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
                let name = String::from_utf8_lossy(&entry.szExeFile)
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
            PROCESS_QUERY_INFORMATION | PROCESS_VM_READ,
            false,
            pid,
        )
        .map_err(|e| format!("Failed to open process: {:?}", e))?;

        let mut buffer = vec![0u8; 1024];
        let len = GetModuleFileNameExA(process, None, &mut buffer);
        let _ = CloseHandle(process);

        if len > 0 {
            Ok(String::from_utf8_lossy(&buffer[..len as usize]).to_string())
        } else {
            Err("Failed to get process path".to_string())
        }
    }
}

pub fn get_process_memory(pid: u32) -> Result<u64, String> {
    unsafe {
        let process = OpenProcess(
            PROCESS_QUERY_INFORMATION | PROCESS_VM_READ,
            false,
            pid,
        )
        .map_err(|_| "Failed to open process".to_string())?;

        let mut pmc = PROCESS_MEMORY_COUNTERS {
            cb: std::mem::size_of::<PROCESS_MEMORY_COUNTERS>() as u32,
            ..Default::default()
        };

        if K32GetProcessMemoryInfo(process, &mut pmc, pmc.cb).is_ok() {
            let _ = CloseHandle(process);
            Ok(pmc.WorkingSetSize as u64)
        } else {
            let _ = CloseHandle(process);
            Err("Failed to get memory info".to_string())
        }
    }
}

pub fn kill_process(pid: u32) -> Result<(), String> {
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

    fn kill_recursive(
        pid: u32,
        tree: &HashMap<u32, Vec<u32>>,
        errors: &mut Vec<String>,
    ) {
        if let Some(children) = tree.get(&pid) {
            for &child_pid in children {
                kill_recursive(child_pid, tree, errors);
            }
        }

        if let Err(e) = kill_process(pid) {
            errors.push(format!("Failed to kill process {}: {}", pid, e));
        }
    }

    let mut errors = Vec::new();
    kill_recursive(pid, &tree, &mut errors);

    if errors.is_empty() {
        Ok(())
    } else {
        Err(errors.join("; "))
    }
}
