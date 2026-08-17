use serde::{Deserialize, Serialize};
use std::path::Path;
use std::collections::HashMap;
use windows::Win32::Foundation::{HANDLE, CloseHandle, NTSTATUS, STATUS_SUCCESS, STATUS_INFO_LENGTH_MISMATCH, BOOL};
use windows::Win32::System::Threading::{
    OpenProcess, GetCurrentProcess,
    PROCESS_DUP_HANDLE, PROCESS_QUERY_INFORMATION
};
use windows::Win32::Storage::FileSystem::{GetFileType, GetFinalPathNameByHandleW, FILE_TYPE_DISK, FILE_NAME_NORMALIZED};

// 手动定义 DuplicateHandle
extern "system" {
    fn DuplicateHandle(
        hSourceProcessHandle: HANDLE,
        hSourceHandle: HANDLE,
        hTargetProcessHandle: HANDLE,
        lpTargetHandle: *mut HANDLE,
        dwDesiredAccess: u32,
        bInheritHandle: BOOL,
        dwOptions: u32,
    ) -> BOOL;
}

const DUPLICATE_SAME_ACCESS: u32 = 0x00000002;

// NT API 结构体定义
#[repr(C)]
#[derive(Clone, Copy)]
struct SYSTEM_HANDLE_TABLE_ENTRY_INFO {
    process_id: u16,
    creator_back_trace_index: u16,
    object_type_index: u8,
    handle_attributes: u8,
    handle_value: u16,
    object: *mut std::ffi::c_void,
    granted_access: u32,
}

#[repr(C)]
struct SYSTEM_HANDLE_INFORMATION {
    number_of_handles: u32,
    handles: [SYSTEM_HANDLE_TABLE_ENTRY_INFO; 1],
}

const SYSTEM_HANDLE_INFORMATION: u32 = 16;

// 动态加载 NtQuerySystemInformation
#[allow(non_snake_case)]
type NtQuerySystemInformationFn = unsafe extern "system" fn(
    SystemInformationClass: u32,
    SystemInformation: *mut std::ffi::c_void,
    SystemInformationLength: u32,
    ReturnLength: *mut u32,
) -> NTSTATUS;

fn get_nt_query_system_information() -> Option<NtQuerySystemInformationFn> {
    unsafe {
        let ntdll = windows::Win32::System::LibraryLoader::LoadLibraryA(
            windows::core::s!("ntdll.dll")
        ).ok()?;
        
        let proc = windows::Win32::System::LibraryLoader::GetProcAddress(
            ntdll,
            windows::core::s!("NtQuerySystemInformation")
        )?;
        
        Some(std::mem::transmute(proc))
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HandleInfo {
    pub handle_type: String,
    pub name: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PathOccupation {
    pub pid: u32,
    pub process_name: String,
    pub process_path: String,
    pub handles: Vec<HandleInfo>,
    pub handle_count: u32,
}

// RAII Handle 包装器，自动关闭
struct AutoHandle(HANDLE);

impl AutoHandle {
    fn new(handle: HANDLE) -> Self {
        AutoHandle(handle)
    }
}

impl Drop for AutoHandle {
    fn drop(&mut self) {
        unsafe {
            let _ = CloseHandle(self.0);
        }
    }
}

// 查询系统所有 Handle
fn query_system_handles() -> Result<Vec<SYSTEM_HANDLE_TABLE_ENTRY_INFO>, String> {
    let nt_query = get_nt_query_system_information()
        .ok_or("Failed to load NtQuerySystemInformation")?;
    
    unsafe {
        let mut buffer_size = 1024 * 1024; // 1MB 初始大小
        let mut buffer: Vec<u8>;
        let mut return_length: u32 = 0;
        
        loop {
            buffer = vec![0u8; buffer_size];
            
            let status = nt_query(
                SYSTEM_HANDLE_INFORMATION,
                buffer.as_mut_ptr() as *mut _,
                buffer_size as u32,
                &mut return_length,
            );
            
            if status == STATUS_SUCCESS {
                break;
            } else if status == STATUS_INFO_LENGTH_MISMATCH {
                // 缓冲区太小，扩大并重试
                buffer_size = return_length as usize + 1024;
            } else {
                return Err(format!("NtQuerySystemInformation failed: {:?}", status));
            }
        }
        
        let info = &*(buffer.as_ptr() as *const SYSTEM_HANDLE_INFORMATION);
        let handle_count = info.number_of_handles as usize;
        
        // 复制所有 Handle 信息
        let handles_ptr = &info.handles as *const _ as *const SYSTEM_HANDLE_TABLE_ENTRY_INFO;
        let handles = std::slice::from_raw_parts(handles_ptr, handle_count);
        
        Ok(handles.to_vec())
    }
}

// 获取 Handle 的文件路径
fn get_handle_path(process_handle: HANDLE, handle_value: u16) -> Option<String> {
    unsafe {
        // 复制 Handle 到当前进程
        let mut duplicated_handle = HANDLE::default();
        let duplicate_result = DuplicateHandle(
            process_handle,
            HANDLE(handle_value as isize as *mut _),
            GetCurrentProcess(),
            &mut duplicated_handle,
            0,
            BOOL(0),
            DUPLICATE_SAME_ACCESS,
        );
        
        if duplicate_result.0 == 0 {
            return None;
        }
        
        let _auto_handle = AutoHandle::new(duplicated_handle);
        
        // 检查是否为磁盘文件
        let file_type = GetFileType(duplicated_handle);
        if file_type != FILE_TYPE_DISK {
            return None;
        }
        
        // 获取文件路径
        let mut path_buffer = vec![0u16; 32768]; // MAX_PATH * 8
        let length = GetFinalPathNameByHandleW(
            duplicated_handle,
            &mut path_buffer,
            FILE_NAME_NORMALIZED,
        );
        
        if length == 0 || length as usize >= path_buffer.len() {
            return None;
        }
        
        // 转换为 UTF-8 String
        let path = String::from_utf16_lossy(&path_buffer[..length as usize]);
        
        // 移除 \\?\ 前缀
        let path = path.strip_prefix(r"\\?\").unwrap_or(&path);
        
        Some(path.to_string())
    }
}

// 路径规范化
fn normalize_path(path: &str) -> String {
    let path = path.replace('/', "\\");
    let path = path.trim_end_matches('\\');
    path.to_uppercase()
}

// 路径匹配（带边界检查）
fn is_path_match(file_path: &str, target_path: &str) -> bool {
    let normalized_file = normalize_path(file_path);
    let normalized_target = normalize_path(target_path);
    
    // 完全匹配
    if normalized_file == normalized_target {
        return true;
    }
    
    // 子路径匹配：必须以 "target\" 开头
    let target_with_sep = format!("{}\\", normalized_target);
    normalized_file.starts_with(&target_with_sep)
}

// 主查询函数
pub fn query_path_occupation(path: &str) -> Result<Vec<PathOccupation>, String> {
    let normalized_target = normalize_path(path);
    
    // 查询系统所有 Handle
    let all_handles = query_system_handles()?;
    
    // 按 PID 分组
    let mut handles_by_pid: HashMap<u32, Vec<SYSTEM_HANDLE_TABLE_ENTRY_INFO>> = HashMap::new();
    for handle in all_handles {
        let pid = handle.process_id as u32;
        handles_by_pid.entry(pid).or_insert_with(Vec::new).push(handle);
    }
    
    // 结果集合
    let mut results: HashMap<u32, PathOccupation> = HashMap::new();
    
    unsafe {
        // 遍历每个进程
        for (pid, handles) in handles_by_pid {
            // 打开进程
            let process = match OpenProcess(
                PROCESS_DUP_HANDLE | PROCESS_QUERY_INFORMATION,
                false,
                pid,
            ) {
                Ok(p) => p,
                Err(_) => continue, // 无权限，跳过
            };
            
            let _auto_process = AutoHandle::new(process);
            
            // 遍历该进程的所有 Handle
            for handle in handles {
                if let Some(file_path) = get_handle_path(process, handle.handle_value) {
                    // 检查路径是否匹配
                    if is_path_match(&file_path, &normalized_target) {
                        let entry = results.entry(pid).or_insert_with(|| {
                            let process_name = crate::process::get_process_path(pid)
                                .unwrap_or_default()
                                .rsplit('\\')
                                .next()
                                .unwrap_or("Unknown")
                                .to_string();
                            
                            let process_path = crate::process::get_process_path(pid)
                                .unwrap_or_default();
                            
                            PathOccupation {
                                pid,
                                process_name,
                                process_path,
                                handles: Vec::new(),
                                handle_count: 0,
                            }
                        });
                        
                        entry.handles.push(HandleInfo {
                            handle_type: "File".to_string(),
                            name: file_path,
                        });
                        entry.handle_count += 1;
                    }
                }
            }
        }
    }
    
    Ok(results.into_values().collect())
}

pub fn query_file_occupation(file_path: &str) -> Result<Vec<PathOccupation>, String> {
    query_path_occupation(file_path)
}

pub fn check_path_exists(path: &str) -> bool {
    Path::new(path).exists()
}

pub fn is_directory(path: &str) -> bool {
    Path::new(path).is_dir()
}

pub fn is_file(path: &str) -> bool {
    Path::new(path).is_file()
}
