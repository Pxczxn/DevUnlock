import { invoke } from '@tauri-apps/api/core';
import type { ProcessInfo, PortInfo, TcpConnection, PathOccupation } from './types';

// Process APIs
export const processApi = {
  listAll: () => invoke<ProcessInfo[]>('list_all_processes'),
  getInfo: (pid: number) => invoke<ProcessInfo>('get_process_info', { pid }),
  terminate: (pid: number) => invoke<void>('terminate_process', { pid }),
  terminateTree: (pid: number) => invoke<void>('terminate_process_tree', { pid }),
};

// Port APIs
export const portApi = {
  querySingle: (port: number, protocol?: string) =>
    invoke<PortInfo[]>('query_single_port', { port, protocol }),
  queryMultiple: (ports: number[]) =>
    invoke<PortInfo[]>('query_multiple_ports', { ports }),
  queryRange: (start: number, end: number) =>
    invoke<PortInfo[]>('query_ports_range', { start, end }),
  getAllTcp: () => invoke<TcpConnection[]>('get_all_tcp_connections'),
  getAllUdp: () => invoke<PortInfo[]>('get_all_udp_listeners'),
  release: (port: number) => invoke<void>('release_port', { port }),
};

// Path/File APIs
export const pathApi = {
  queryPath: (path: string) => invoke<PathOccupation[]>('query_path', { path }),
  queryFile: (path: string) => invoke<PathOccupation[]>('query_file', { path }),
  validate: (path: string) => invoke<boolean>('validate_path', { path }),
  isDirectory: (path: string) => invoke<boolean>('check_is_directory', { path }),
  isFile: (path: string) => invoke<boolean>('check_is_file', { path }),
  release: (path: string, pids: number[]) => invoke<void>('release_path', { path, pids }),
};

// Utility functions
export const formatBytes = (bytes: number): string => {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${Math.round(bytes / Math.pow(k, i) * 100) / 100} ${sizes[i]}`;
};

export const formatTimestamp = (timestamp: number): string => {
  const date = new Date(timestamp);
  return date.toLocaleString();
};
