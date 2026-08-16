import { useState, useEffect } from 'react';
import { Search, Activity, AlertCircle, Trash2 } from 'lucide-react';
import { processApi, formatBytes } from '../api';
import type { ProcessInfo } from '../types';

function ProcessPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [processes, setProcesses] = useState<ProcessInfo[]>([]);
  const [filteredProcesses, setFilteredProcesses] = useState<ProcessInfo[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadProcesses();
  }, []);

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

  const loadProcesses = async () => {
    setLoading(true);
    setError(null);
    try {
      const allProcesses = await processApi.listAll();
      setProcesses(allProcesses);
      setFilteredProcesses(allProcesses);
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载进程列表失败');
    } finally {
      setLoading(false);
    }
  };

  const handleKillProcess = async (pid: number, name: string) => {
    if (!confirm(`确定要结束进程 ${name} (PID: ${pid}) 吗？`)) return;

    try {
      await processApi.terminate(pid);
      setProcesses(processes.filter(p => p.pid !== pid));
      alert('进程已结束');
    } catch (err) {
      alert(`结束进程失败: ${err instanceof Error ? err.message : '未知错误'}`);
    }
  };

  const handleKillProcessTree = async (pid: number, name: string) => {
    if (!confirm(`确定要结束进程树 ${name} (PID: ${pid}) 吗？这将结束该进程及其所有子进程。`)) return;

    try {
      await processApi.terminateTree(pid);
      setProcesses(processes.filter(p => p.pid !== pid));
      alert('进程树已结束');
    } catch (err) {
      alert(`结束进程树失败: ${err instanceof Error ? err.message : '未知错误'}`);
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

            {filteredProcesses.map((process) => (
              <div key={process.pid} className="process-card">
                <div className="process-card-header">
                  <div className="process-info">
                    <Activity size={20} color="#2563eb" />
                    <div>
                      <div className="process-name">{process.name}</div>
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
                  >
                    <Trash2 size={18} />
                    结束进程
                  </button>
                  <button 
                    className="btn btn-secondary"
                    onClick={() => handleKillProcessTree(process.pid, process.name)}
                  >
                    结束进程树
                  </button>
                </div>
              </div>
            ))}

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
