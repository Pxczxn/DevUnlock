export interface ProcessInfo {
  pid: number;
  name: string;
  path: string;
  parent_pid: number;
  threads: number;
  memory: number;
}

export interface PortInfo {
  port: number;
  protocol: string;
  state: string;
  local_address: string;
  remote_address: string;
  pid: number;
}

export interface TcpConnection {
  local_address: string;
  local_port: number;
  remote_address: string;
  remote_port: number;
  state: string;
  pid: number;
}

export interface HandleInfo {
  handle_type: string;
  name: string;
}

export interface PathOccupation {
  pid: number;
  process_name: string;
  process_path: string;
  handles: HandleInfo[];
  handle_count: number;
}

export interface ScanDiagnostics {
  total_processes: number;
  skipped_access_denied: number;
  handles_duplicated: number;
  handles_resolved: number;
  handles_matched: number;
  elapsedMs?: number;
}

export interface PathOccupationResult {
  occupations: PathOccupation[];
  diagnostics: ScanDiagnostics;
}

export interface HistoryItem {
  id: string;
  type: 'directory' | 'file' | 'port' | 'process';
  query: string;
  timestamp: number;
}

export interface FavoriteItem {
  id: string;
  name: string;
  path: string;
  type: 'directory' | 'file';
}
