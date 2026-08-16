import { useState, useEffect } from 'react';
import { Search, Wifi, AlertCircle, Trash2 } from 'lucide-react';
import { portApi, processApi } from '../api';
import { saveQueryHistory } from '../historyUtils';
import type { PortInfo } from '../types';

interface PortOccupationPageProps {
  initialQuery?: string;
}

function PortOccupationPage({ initialQuery }: PortOccupationPageProps) {
  const [portInput, setPortInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<PortInfo[]>([]);
  const [error, setError] = useState<string | null>(null);

  // 自动执行查询
  useEffect(() => {
    if (initialQuery) {
      setPortInput(initialQuery);
      handleQueryWithInput(initialQuery);
    }
  }, [initialQuery]);

  const handleQueryWithInput = async (input: string) => {
    if (!input.trim()) {
      setError('请输入端口号');
      return;
    }

    setLoading(true);
    setError(null);
    setResults([]);

    try {
      const trimmedInput = input.trim();

      // Check if it's a port range (e.g., 3000-3010)
      if (trimmedInput.includes('-')) {
        const [start, end] = trimmedInput.split('-').map(s => parseInt(s.trim()));
        if (isNaN(start) || isNaN(end) || start < 1 || end > 65535 || start > end) {
          setError('无效的端口范围，格式应为: 3000-3010');
          setLoading(false);
          return;
        }
        const ports = await portApi.queryRange(start, end);
        setResults(ports);
        saveQueryHistory('port', trimmedInput);
      }
      // Check if it's multiple ports (e.g., 3000,5173,8080)
      else if (trimmedInput.includes(',') || trimmedInput.includes(' ')) {
        const ports = trimmedInput
          .split(/[,\s]+/)
          .map(s => parseInt(s.trim()))
          .filter(p => !isNaN(p) && p >= 1 && p <= 65535);
        
        if (ports.length === 0) {
          setError('无效的端口列表');
          setLoading(false);
          return;
        }
        
        const allResults = await portApi.queryMultiple(ports);
        setResults(allResults);
        saveQueryHistory('port', trimmedInput);
      }
      // Single port
      else {
        const port = parseInt(trimmedInput);
        if (isNaN(port) || port < 1 || port > 65535) {
          setError('端口范围必须为 1 - 65535');
          setLoading(false);
          return;
        }
        
        const portInfo = await portApi.querySingle(port);
        setResults(portInfo);
        saveQueryHistory('port', trimmedInput);
        
        if (portInfo.length === 0) {
          setError(`端口 ${port} 当前未被占用`);
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '查询失败');
    } finally {
      setLoading(false);
    }
  };

  const handleQuery = () => handleQueryWithInput(portInput);

  const handleReleasePort = async (port: number) => {
    if (!confirm(`确定要释放端口 ${port} 吗？`)) return;

    try {
      await portApi.release(port);
      // 端口释放后，从结果中移除所有该端口的条目
      setResults(results.filter(r => r.port !== port));
      alert(`端口 ${port} 已释放`);
    } catch (err) {
      alert(`释放端口失败: ${err instanceof Error ? err.message : '未知错误'}`);
    }
  };

  const handleKillProcess = async (pid: number, port: number) => {
    if (!confirm(`确定要结束进程 ${pid} 以释放端口 ${port} 吗？`)) return;

    try {
      await processApi.terminate(pid);
      setResults(results.filter(r => r.pid !== pid));
      alert('进程已结束');
    } catch (err) {
      alert(`结束进程失败: ${err instanceof Error ? err.message : '未知错误'}`);
    }
  };

  return (
    <>
      <div className="header">
        <div className="search-bar">
          <input
            type="text"
            className="search-input"
            placeholder="输入端口号（如：8080）、多端口（8080,5173,3000）或端口范围（3000-3010）"
            value={portInput}
            onChange={(e) => setPortInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleQuery()}
          />
          <button className="btn btn-primary" onClick={handleQuery} disabled={loading}>
            <Search size={18} />
            {loading ? '查询中...' : '查询'}
          </button>
        </div>
      </div>

      <div className="content-area">
        {loading && (
          <div className="loading">
            <div className="spinner"></div>
            <p>正在查询端口信息...</p>
          </div>
        )}

        {error && (
          <div className="empty-state">
            <AlertCircle size={48} style={{ opacity: 0.5, marginBottom: '16px' }} />
            <p>{error}</p>
          </div>
        )}

        {!loading && !error && results.length > 0 && (
          <>
            <div style={{ marginBottom: '16px' }}>
              <h2 style={{ fontSize: '18px', fontWeight: 600 }}>
                发现 {results.length} 个端口占用
              </h2>
            </div>

            {results.map((portInfo, index) => (
              <div key={`${portInfo.port}-${portInfo.pid}-${index}`} className="process-card">
                <div className="process-card-header">
                  <div className="process-info">
                    <Wifi size={20} color="#2563eb" />
                    <div>
                      <div className="process-name">端口 {portInfo.port}</div>
                      <div className="text-muted" style={{ fontSize: '12px' }}>
                        {portInfo.local_address}
                        {portInfo.remote_address && ` → ${portInfo.remote_address}`}
                      </div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <span className={`port-badge ${portInfo.protocol.toLowerCase()}`}>
                      {portInfo.protocol}
                    </span>
                    <span className={`status-badge ${portInfo.state.toLowerCase()}`}>
                      {portInfo.state}
                    </span>
                  </div>
                </div>

                <div className="process-stats">
                  <div className="stat-item">
                    <span className="stat-label">进程 PID</span>
                    <span className="stat-value">{portInfo.pid}</span>
                  </div>
                </div>

                <div className="process-actions">
                  <button 
                    className="btn btn-danger"
                    onClick={() => handleReleasePort(portInfo.port)}
                  >
                    <Trash2 size={18} />
                    释放端口
                  </button>
                  <button 
                    className="btn btn-secondary"
                    onClick={() => handleKillProcess(portInfo.pid, portInfo.port)}
                  >
                    结束进程
                  </button>
                </div>
              </div>
            ))}
          </>
        )}

        {!loading && !error && results.length === 0 && portInput && (
          <div className="empty-state">
            <Wifi size={48} style={{ opacity: 0.5, marginBottom: '16px' }} />
            <p>请输入端口号并点击查询</p>
          </div>
        )}
      </div>
    </>
  );
}

export default PortOccupationPage;
