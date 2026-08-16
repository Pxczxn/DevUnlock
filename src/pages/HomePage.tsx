import { useState } from 'react';
import { Search, FolderOpen, Wifi } from 'lucide-react';

interface HomePageProps {
  onNavigate: (page: 'home' | 'path' | 'port' | 'process' | 'history' | 'favorites' | 'settings') => void;
}

function HomePage({ onNavigate }: HomePageProps) {
  const [searchQuery, setSearchQuery] = useState('');

  const handleSearch = () => {
    if (!searchQuery.trim()) return;

    // Auto-detect query type
    const query = searchQuery.trim();
    
    // Check if it's a port number
    if (/^\d+$/.test(query)) {
      const port = parseInt(query);
      if (port >= 1 && port <= 65535) {
        // Navigate to port page with query
        onNavigate('port');
        return;
      }
    }

    // Check if it's a path
    if (query.includes('\\') || query.includes('/') || query.includes(':')) {
      onNavigate('path');
      return;
    }

    // Default to process search
    onNavigate('process');
  };

  const commonPorts = [3000, 5173, 8080, 8000, 8888, 6379];

  return (
    <>
      <div className="header">
        <div className="search-bar">
          <input
            type="text"
            className="search-input"
            placeholder="输入目录、文件、端口或进程名称..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
          />
          <button className="btn btn-primary" onClick={handleSearch}>
            <Search size={18} />
            查询
          </button>
        </div>
      </div>
      <div className="content-area">
        <div style={{ marginBottom: '32px' }}>
          <h2 style={{ marginBottom: '16px', fontSize: '18px', fontWeight: 600 }}>快速查询</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
            <div
              className="process-card"
              style={{ cursor: 'pointer' }}
              onClick={() => onNavigate('path')}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
                <FolderOpen size={24} color="#2563eb" />
                <h3 style={{ fontSize: '16px', fontWeight: 600 }}>目录查询</h3>
              </div>
              <p className="text-muted" style={{ fontSize: '14px' }}>查询占用目录的进程</p>
            </div>
            
            <div
              className="process-card"
              style={{ cursor: 'pointer' }}
              onClick={() => onNavigate('port')}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
                <Wifi size={24} color="#2563eb" />
                <h3 style={{ fontSize: '16px', fontWeight: 600 }}>端口查询</h3>
              </div>
              <p className="text-muted" style={{ fontSize: '14px' }}>查询占用端口的进程</p>
            </div>
          </div>
        </div>

        <div>
          <h2 style={{ marginBottom: '16px', fontSize: '18px', fontWeight: 600 }}>常用开发端口</h2>
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
            {commonPorts.map(port => (
              <button
                key={port}
                className="btn btn-secondary"
                onClick={() => {
                  setSearchQuery(port.toString());
                  onNavigate('port');
                }}
              >
                {port}
              </button>
            ))}
          </div>
        </div>

        <div style={{ marginTop: '32px', padding: '24px', backgroundColor: 'var(--bg-secondary)', borderRadius: '8px' }}>
          <h3 style={{ marginBottom: '12px', fontSize: '16px', fontWeight: 600 }}>DevUnlock 是什么？</h3>
          <p style={{ marginBottom: '12px', color: 'var(--text-secondary)', fontSize: '14px', lineHeight: '1.6' }}>
            DevUnlock 是一个面向开发者的 Windows 资源占用管理工具，帮助你快速查询并释放被占用的目录、文件和端口。
          </p>
          <ul style={{ color: 'var(--text-secondary)', fontSize: '14px', lineHeight: '1.8', paddingLeft: '20px' }}>
            <li>快速查询目录/文件占用情况</li>
            <li>一键释放被占用的端口</li>
            <li>批量管理进程</li>
            <li>查看进程树结构</li>
          </ul>
        </div>
      </div>
    </>
  );
}

export default HomePage;
