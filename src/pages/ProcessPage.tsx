import { useState, useEffect } from 'react';
import { Search, Activity, AlertCircle, Shield } from 'lucide-react';
import { processApi, formatBytes } from '../api';
import { saveQueryHistory } from '../historyUtils';
import { isProtectedProcess } from '../processProtection';
import { formatError } from '../utils/errorUtils';
import type { ProcessInfo } from '../types';
import type { PathOccupation } from '../types';

interface ProcessPageProps {
  initialQuery?: string;
}

function ProcessPage({ initialQuery }: ProcessPageProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [lastSubmittedQuery, setLastSubmittedQuery] = useState(''); // 追踪已提交的查询
  const [loading, setLoading] = useState(false);
  const [processes, setProcesses] = useState<ProcessInfo[]>([]);
  const [filteredProcesses, setFilteredProcesses] = useState<ProcessInfo[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadProcesses();
  }, []);

  // 设置初始查询
  useEffect(() => {
    if (initialQuery) {
      setSearchQuery(initialQuery);
      setLastSubmittedQuery(initialQuery);
      // 保存初始查询到历史
      saveQueryHistory('process', initialQuery);
    }
  }, [initialQuery]);

  // 实时过滤，不保存历史
  useEffect(() => {
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      const filtered = processes.filter(p =>
        p.name.toLowerCase().includes(query) ||
        p.path.toLowerCase().includes(query) ||
        p.pid.toString().includes(query)
      );
      setFilteredProcesses(filtered);
    } else {
      setFilteredProcesses(processes);
    }
  }, [searchQuery, processes]);

  // 处理搜索提交（Enter 或失焦）
  const handleSearchSubmit = () => {
    const trimmed = searchQuery.trim();
    if (trimmed && trimmed !== lastSubmittedQuery) {
      saveQueryHistory('process', trimmed);
      setLastSubmittedQuery(trimmed);
    }
  };

  const loadProcesses = async () => {
    setLoading(true);
    setError(null);
    try {
      const allProcesses = await processApi.listAll();
      // 按内存使用量降序排序
      const sortedProcesses = allProcesses.sort((a, b) => b.memory - a.memory);
      setProcesses(sortedProcesses);
      setFilteredProcesses(sortedProcesses);
    } catch (err) {
      setError(formatError(err));
    } finally {
      setLoading(false);
    }
  };

  const handleKillProcess = async (pid: number, name: string) => {
    if (!confirm(`确定要结束进程 ${name} (PID: ${pid}) 吗？`)) return;

    try {
      await processApi.terminate(pid);
      
      // 等待系统稳定
      await new Promise(resolve => setTimeout(resolve, 300));
      
      // 重新查询真实状态
      await loadProcesses();
      
      alert('进程已结束');
    } catch (err) {
      alert(`结束进程失败: ${formatError(err)}`);
    }
  };

  const handleKillProcessTree = async (pid: number, name: string) => {
    if (!confirm(`确定要结束进程树 ${name} (PID: ${pid}) 吗？这将结束该进程及其所有子进程。`)) return;

    try {
      await processApi.terminateTree(pid);
      
      // 等待系统稳定
      await new Promise(resolve => setTimeout(resolve, 300));
      
      // 重新查询真实状态
      await loadProcesses();
      
      alert('进程树已结束');
    } catch (err) {
      alert(`结束进程树失败: ${formatError(err)}`);
    }
  };

  return (
    <>
      <div className="header">
        <div className="search-bar">
          <input
            type="text"
            className="search-input"
            placeholder="搜索进程名称、PID 或路径..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearchSubmit()}
            onBlur={handleSearchSubmit}
          />
          <button className="btn btn-primary" onClick={loadProcesses} disabled={loading}>
            <Search size={18} />
            刷新
          </button>
        </div>
      </div>

      <div className="content-area">
        {loading && (
          <div className="loading">
            <div className="spinner"></div>
            <p>正在加载进程列表...</p>
          </div>
        )}

        {error && (
          <div className="empty-state">
            <AlertCircle size={48} style={{ opacity: 0.5, marginBottom: '16px' }} />
            <p>{error}</p>
          </div>
        )}

        {!loading && !error && (
          <>
            <div style={{ marginBottom: '16px' }}>
              <h2 style={{ fontSize: '18px', fontWeight: 600 }}>
                进程列表 ({filteredProcesses.length} / {processes.length})
              </h2>
            </div>

            {filteredProcesses.map((process) => {
              // 检查是否受保护
              const processOccupation: PathOccupation = {
                pid: process.pid,
                process_name: process.name,
                process_path: process.path,
                handles: [],
                handle_count: 0
              };
              const isProtected = isProtectedProcess(processOccupation);
              
              return (
              <div key={process.pid} className="process-card">
                <div className="process-card-header">
                  <div className="process-info">
                    {isProtected ? (
                      <Shield size={20} color="#ef4444" />
                    ) : (
                      <Activity size={20} color="#2563eb" />
                    )}
                    <div>
                      <div className="process-name">
                        {process.name}
                        {isProtected && <span style={{ marginLeft: '8px', color: '#ef4444', fontSize: '12px' }}>[受保护]</span>}
                      </div>
                      <div className="text-muted" style={{ fontSize: '12px' }}>
                        {process.path || '路径不可用'}
                      </div>
                    </div>
                  </div>
                  <span className="process-pid">PID: {process.pid}</span>
                </div>

                <div className="process-stats">
                  <div className="stat-item">
                    <span className="stat-label">父进程 PID</span>
                    <span className="stat-value">{process.parent_pid}</span>
                  </div>
                  <div className="stat-item">
                    <span className="stat-label">线程数</span>
                    <span className="stat-value">{process.threads}</span>
                  </div>
                  <div className="stat-item">
                    <span className="stat-label">内存</span>
                    <span className="stat-value">{formatBytes(process.memory)}</span>
                  </div>
                </div>

                <div className="process-actions">
                  <button 
                    className="btn btn-danger"
                    onClick={() => handleKillProcess(process.pid, process.name)}
                    disabled={isProtected}
                    style={{ opacity: isProtected ? 0.5 : 1, cursor: isProtected ? 'not-allowed' : 'pointer' }}
                  >
                    结束进程
                  </button>
                  <button 
                    className="btn btn-secondary"
                    onClick={() => handleKillProcessTree(process.pid, process.name)}
                    disabled={isProtected}
                    style={{ opacity: isProtected ? 0.5 : 1, cursor: isProtected ? 'not-allowed' : 'pointer' }}
                  >
                    结束进程树
                  </button>
                </div>
              </div>
            )})}

            {filteredProcesses.length === 0 && searchQuery && (
              <div className="empty-state">
                <AlertCircle size={48} style={{ opacity: 0.5, marginBottom: '16px' }} />
                <p>未找到匹配的进程</p>
              </div>
            )}
          </>
        )}
      </div>
    </>
  );
}

export default ProcessPage;
