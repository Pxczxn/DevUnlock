import { useState, useEffect } from 'react';
import { Clock, FolderOpen, Wifi, Activity, Trash2 } from 'lucide-react';
import type { HistoryItem } from '../types';
import type { QueryIntent } from '../App';

interface HistoryPageProps {
  onNavigate: (page: 'home' | 'path' | 'port' | 'process' | 'history' | 'favorites' | 'settings', intent?: QueryIntent) => void;
}

function HistoryPage({ onNavigate }: HistoryPageProps) {
  const [history, setHistory] = useState<HistoryItem[]>([]);

  useEffect(() => {
    loadHistory();
  }, []);

  const loadHistory = () => {
    const savedHistory = localStorage.getItem('devunlock-history');
    if (savedHistory) {
      setHistory(JSON.parse(savedHistory));
    }
  };

  const clearHistory = () => {
    if (!confirm('确定要清空所有历史记录吗？')) return;
    localStorage.removeItem('devunlock-history');
    setHistory([]);
  };

  const deleteItem = (id: string) => {
    const newHistory = history.filter(item => item.id !== id);
    setHistory(newHistory);
    localStorage.setItem('devunlock-history', JSON.stringify(newHistory));
  };

  const replayQuery = (item: HistoryItem) => {
    let page: 'path' | 'port' | 'process';
    let intentType: 'path' | 'port' | 'process';
    
    if (item.type === 'directory' || item.type === 'file') {
      page = 'path';
      intentType = 'path';
    } else if (item.type === 'port') {
      page = 'port';
      intentType = 'port';
    } else {
      page = 'process';
      intentType = 'process';
    }
    
    onNavigate(page, { type: intentType, value: item.query });
  };

  const getIcon = (type: string) => {
    switch (type) {
      case 'directory':
      case 'file':
        return <FolderOpen size={20} />;
      case 'port':
        return <Wifi size={20} />;
      case 'process':
        return <Activity size={20} />;
      default:
        return <Clock size={20} />;
    }
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'directory':
        return '目录';
      case 'file':
        return '文件';
      case 'port':
        return '端口';
      case 'process':
        return '进程';
      default:
        return '未知';
    }
  };

  return (
    <>
      <div className="header">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h1 style={{ fontSize: '20px', fontWeight: 600 }}>历史记录</h1>
          {history.length > 0 && (
            <button className="btn btn-secondary" onClick={clearHistory}>
              <Trash2 size={18} />
              清空历史
            </button>
          )}
        </div>
      </div>

      <div className="content-area">
        {history.length === 0 ? (
          <div className="empty-state">
            <Clock size={48} style={{ opacity: 0.5, marginBottom: '16px' }} />
            <p>暂无历史记录</p>
          </div>
        ) : (
          history.map((item) => (
            <div 
              key={item.id} 
              className="history-item"
              onClick={() => replayQuery(item)}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: '8px',
                  backgroundColor: 'var(--bg-secondary)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--accent-color)'
                }}>
                  {getIcon(item.type)}
                </div>
                <div>
                  <div style={{ fontWeight: 500, marginBottom: '4px' }}>{item.query}</div>
                  <div className="text-muted" style={{ fontSize: '12px' }}>
                    {getTypeLabel(item.type)} · {new Date(item.timestamp).toLocaleString()}
                  </div>
                </div>
              </div>
              <button
                className="btn btn-secondary"
                onClick={() => deleteItem(item.id)}
                style={{ padding: '8px 16px' }}
              >
                <Trash2 size={16} />
              </button>
            </div>
          ))
        )}
      </div>
    </>
  );
}

export default HistoryPage;
