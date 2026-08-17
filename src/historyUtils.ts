import type { HistoryItem } from './types';

// 保存查询历史
export const saveQueryHistory = (type: 'directory' | 'file' | 'port' | 'process', query: string) => {
  try {
    const history = getQueryHistory();
    
    // 检查是否已存在相同的查询
    const existingIndex = history.findIndex(item => item.type === type && item.query === query);
    
    if (existingIndex !== -1) {
      // 已存在：移除旧的，添加到顶部并刷新时间戳
      history.splice(existingIndex, 1);
    }
    
    const newItem: HistoryItem = {
      id: Date.now().toString(),
      type,
      query,
      timestamp: Date.now(),
    };
    
    // 添加到历史记录开头，最多保留 50 条
    const newHistory = [newItem, ...history].slice(0, 50);
    localStorage.setItem('devunlock-history', JSON.stringify(newHistory));
  } catch (err) {
    console.error('Failed to save history:', err);
  }
};

// 获取查询历史
export const getQueryHistory = (): HistoryItem[] => {
  try {
    const saved = localStorage.getItem('devunlock-history');
    if (saved) {
      const parsed = JSON.parse(saved);
      return Array.isArray(parsed) ? parsed : [];
    }
  } catch (err) {
    console.error('Failed to load history:', err);
  }
  return [];
};
