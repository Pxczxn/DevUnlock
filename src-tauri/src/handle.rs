use serde::{Deserialize, Serialize};
use std::path::Path;

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

// Note: Full handle enumeration requires kernel-level access
// This is a simplified version that works with available APIs
// For production, you might need to use third-party tools or drivers

pub fn query_path_occupation(path: &str) -> Result<Vec<PathOccupation>, String> {
    // Normalize the path
    let normalized_path = normalize_path(path);
    
    // For MVP, we'll use a combination of process querying and open file detection
    // This is a placeholder that would need to be enhanced with proper handle enumeration
    let processes = crate::process::list_processes()?;
    
    let mut occupations = Vec::new();
    
    for process in processes {
        // Check if process path is within the target directory
        if is_path_related(&process.path, &normalized_path) {
            occupations.push(PathOccupation {
                pid: process.pid,
                process_name: process.name.clone(),
                process_path: process.path.clone(),
                handles: vec![HandleInfo {
                    handle_type: "Process".to_string(),
                    name: process.path.clone(),
                }],
                handle_count: 1,
            });
        }
    }
    
    Ok(occupations)
}

pub fn query_file_occupation(file_path: &str) -> Result<Vec<PathOccupation>, String> {
    // Similar to path occupation but for specific files
    query_path_occupation(file_path)
}

fn normalize_path(path: &str) -> String {
    // Convert forward slashes to backslashes
    let path = path.replace('/', "\\");
    
    // Remove trailing backslash
    let path = path.trim_end_matches('\\');
    
    // Convert to uppercase for case-insensitive comparison on Windows
    path.to_uppercase()
}

fn is_path_related(process_path: &str, target_path: &str) -> bool {
    let normalized_process_path = normalize_path(process_path);
    let normalized_target_path = normalize_path(target_path);
    
    normalized_process_path.starts_with(&normalized_target_path)
}

// Helper function to check if a file exists
pub fn check_path_exists(path: &str) -> bool {
    Path::new(path).exists()
}

// Helper function to check if path is a directory
pub fn is_directory(path: &str) -> bool {
    Path::new(path).is_dir()
}

// Helper function to check if path is a file
pub fn is_file(path: &str) -> bool {
    Path::new(path).is_file()
}
