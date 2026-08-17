// 系统进程保护规则
export const PROTECTED_PROCESSES = [
  'devunlock.exe',
  'system',
  'registry',
  'smss.exe',
  'csrss.exe',
  'wininit.exe',
  'winlogon.exe',
  'services.exe',
  'lsass.exe',
  'svchost.exe',
  'dwm.exe',
  'fontdrvhost.exe',
  'conhost.exe',
];

export interface PathOccupation {
  pid: number;
  process_name: string;
  process_path: string;
  handles: HandleInfo[];
  handle_count: number;
}

export interface HandleInfo {
  handle_type: string;
  name: string;
}

/**
 * 检查进程是否受保护
 */
export const isProtectedProcess = (process: PathOccupation): boolean => {
  const name = process.process_name.toLowerCase();
  
  // 精确匹配，不使用 includes 避免误判
  // 例如：system 不应该匹配 SystemSettings.exe
  return PROTECTED_PROCESSES.includes(name);
};

/**
 * 过滤出可操作的进程
 */
export const getKillableProcesses = (processes: PathOccupation[]): PathOccupation[] => {
  return processes.filter(p => !isProtectedProcess(p));
};

/**
 * 过滤出受保护的进程
 */
export const getProtectedProcesses = (processes: PathOccupation[]): PathOccupation[] => {
  return processes.filter(p => isProtectedProcess(p));
};
