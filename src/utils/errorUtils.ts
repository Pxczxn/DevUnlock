/**
 * 统一的错误格式化工具
 * 处理 Tauri invoke 返回的各种错误类型
 */
export function formatError(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  
  if (typeof error === 'string') {
    return error;
  }
  
  if (error && typeof error === 'object' && 'message' in error) {
    return String((error as any).message);
  }
  
  return String(error || '未知错误');
}
