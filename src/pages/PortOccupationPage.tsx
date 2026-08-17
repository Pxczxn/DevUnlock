import { useState, useEffect } from 'react';
import { Search, Wifi, AlertCircle, Trash2 } from 'lucide-react';
import { portApi, processApi } from '../api';
import { saveQueryHistory } from '../historyUtils';
import { formatError } from '../utils/errorUtils';
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
        // 严格验证格式：^\d+\s*-\s*\d+$
        if (!/^\d+\s*-\s*\d+$/.test(trimmedInput)) {
          setError('无效的端口范围格式，应为: 3000-3010');
          setLoading(false);
          return;
        }
        
        const [startStr, endStr] = trimmedInput.split('-').map(s => s.trim());
        const start = parseInt(startStr, 10);
        const end = parseInt(endStr, 10);
        
        if (start < 1 || end > 65535 || start > end) {
          setError('端口范围必须在 1-65535 之间，且起始端口不能大于结束端口');
          setLoading(false);
          return;
        }
        
        const ports = await portApi.queryRange(start, end);
        // 按端口号升序排序
        const sortedPorts = ports.sort((a, b) => a.port - b.port);
        setResults(sortedPorts);
        saveQueryHistory('port', trimmedInput);
        
        if (ports.length === 0) {
          setError(`端口范围 ${start}-${end} 当前未被占用`);
        }
      }
      // Check if it's multiple ports (e.g., 3000,5173,8080)
      else if (trimmedInput.includes(',') || trimmedInput.includes(' ')) {
        const portList = trimmedInput.split(/[,\s]+/).map(s => s.trim()).filter(s => s.length > 0);
        
        // 严格验证每个端口：必须是纯数字
        const invalidPorts = portList.filter(s => !/^\d+$/.test(s));
        
        if (invalidPorts.length > 0) {
          setError(`无效的端口号格式: ${invalidPorts.join(', ')}`);
          setLoading(false);
          return;
        }
        
        // 转换并验证范围
        const ports = portList.map(s => parseInt(s, 10));
        const outOfRange = ports.filter(p => p < 1 || p > 65535);
        
        if (outOfRange.length > 0) {
          setError(`端口号超出范围 (1-65535): ${outOfRange.join(', ')}`);
          setLoading(false);
          return;
        }
        
        const allResults = await portApi.queryMultiple(ports);
        // 按端口号升序排序
        const sortedResults = allResults.sort((a, b) => a.port - b.port);
        setResults(sortedResults);
        saveQueryHistory('port', trimmedInput);
        
        if (allResults.length === 0) {
          setError(`端口 ${trimmedInput} 当前未被占用`);
        }
      }
      // Single port
      else {
        // 严格验证：必须是纯数字
        if (!/^\d+$/.test(trimmedInput)) {
          setError('端口号必须是纯数字');
          setLoading(false);
          return;
        }
        
        const port = parseInt(trimmedInput, 10);
        if (port < 1 || port > 65535) {
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
      setError(formatError(err));
    } finally {
      setLoading(false);
    }
  };

  const handleQuery = () => handleQueryWithInput(portInput);

  const handleReleasePort = async (port: number) => {
    if (!confirm(`确定要释放端口 ${port} 吗？`)) return;

    try {
      await portApi.release(port);
      
      // 等待系统稳定
      await new Promise(resolve => setTimeout(resolve, 300));
      
      // 重新查询当前输入
      await handleQueryWithInput(portInput);
      
      alert(`端口 ${port} 已释放`);
    } catch (err) {
      alert(`释放端口失败: ${formatError(err)}`);
    }
  };

  const handleKillProcess = async (pid: number, port: number) => {
    if (!confirm(`确定要结束进程 ${pid} 以释放端口 ${port} 吗？`)) return;

    try {
      await processApi.terminate(pid);
      
      // 等待系统稳定
      await new Promise(resolve => setTimeout(resolve, 300));
      
      // 重新查询当前输入
      await handleQueryWithInput(portInput);
      
      alert(`进程 ${pid} 已结束`);
    } catch (err) {
      alert(`结束进程失败: ${formatError(err)}`);
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
