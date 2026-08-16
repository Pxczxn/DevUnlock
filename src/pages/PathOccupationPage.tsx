import { useState, useEffect } from 'react';
import { Search, FolderOpen, AlertCircle, Trash2 } from 'lucide-react';
import { pathApi, processApi } from '../api';
import { saveQueryHistory } from '../historyUtils';
import type { PathOccupation } from '../types';

interface PathOccupationPageProps {
  initialQuery?: string;
}

function PathOccupationPage({ initialQuery }: PathOccupationPageProps) {
  const [path, setPath] = useState('');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<PathOccupation[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [selectedPids, setSelectedPids] = useState<Set<number>>(new Set());

  // 自动执行查询
  useEffect(() => {
    if (initialQuery) {
      setPath(initialQuery);
      handleQueryWithPath(initialQuery);
    }
  }, [initialQuery]);

  const handleQueryWithPath = async (queryPath: string) => {
    if (!queryPath.trim()) {
      setError('请输入路径');
      return;
    }

    setLoading(true);
    setError(null);
    setResults([]);
    setSelectedPids(new Set());

    try {
      const exists = await pathApi.validate(queryPath);
      if (!exists) {
        setError('路径不存在');
        setLoading(false);
        return;
      }

      const isDir = await pathApi.isDirectory(queryPath);
      const occupations = isDir 
        ? await pathApi.queryPath(queryPath)
        : await pathApi.queryFile(queryPath);
      
      setResults(occupations);
      
      // 保存到历史记录
      saveQueryHistory(isDir ? 'directory' : 'file', queryPath);
      
      if (occupations.length === 0) {
        setError('未发现占用该路径的进程');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '查询失败');
    } finally {
      setLoading(false);
    }
  };

  const handleQuery = () => handleQueryWithPath(path);

  const handleKillProcess = async (pid: number) => {
    if (!confirm(`确定要结束进程 ${pid} 吗？`)) return;

    try {
      await processApi.terminate(pid);
      setResults(results.filter(r => r.pid !== pid));
    } catch (err) {
      alert(`结束进程失败: ${err instanceof Error ? err.message : '未知错误'}`);
    }
  };

  const handleKillProcessTree = async (pid: number) => {
    if (!confirm(`确定要结束进程树 ${pid} 吗？这将结束该进程及其所有子进程。`)) return;

    try {
      await processApi.terminateTree(pid);
      setResults(results.filter(r => r.pid !== pid));
    } catch (err) {
      alert(`结束进程树失败: ${err instanceof Error ? err.message : '未知错误'}`);
    }
  };

  const handleReleasePath = async () => {
    if (selectedPids.size === 0) {
      alert('请选择要结束的进程');
      return;
    }

    if (!confirm(`确定要结束选中的 ${selectedPids.size} 个进程吗？`)) return;

    try {
      const batchResults = await pathApi.release(path, Array.from(selectedPids));
      
      // 统计结果
      const successPids = batchResults.filter(r => r.success).map(r => r.pid);
      const failedResults = batchResults.filter(r => !r.success);
      
      // 只移除成功结束的进程
      setResults(results.filter(r => !successPids.includes(r.pid)));
      setSelectedPids(new Set());
      
      // 显示结果
      if (failedResults.length > 0) {
        const failedMsg = failedResults
          .map(r => `PID ${r.pid}: ${r.message}`)
          .join('\n');
        alert(`部分进程结束失败:\n${failedMsg}\n\n成功: ${successPids.length}/${batchResults.length}`);
      } else {
        alert(`成功结束 ${successPids.length} 个进程`);
      }
    } catch (err) {
      alert(`释放路径失败: ${err instanceof Error ? err.message : '未知错误'}`);
    }
  };

  const togglePid = (pid: number) => {
    const newSelected = new Set(selectedPids);
    if (newSelected.has(pid)) {
      newSelected.delete(pid);
    } else {
      newSelected.add(pid);
    }
    setSelectedPids(newSelected);
  };

  return (
    <>
      <div className="header">
        <div className="search-bar">
          <input
            type="text"
            className="search-input"
            placeholder="输入目录或文件路径，例如：D:\Coding\project\xingyu-community"
            value={path}
            onChange={(e) => setPath(e.target.value)}
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
            <p>正在扫描系统资源...</p>
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
            <div style={{ marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h2 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '4px' }}>
                  发现 {results.length} 个关联进程
                </h2>
                <p className="text-muted" style={{ fontSize: '14px' }}>
                  共 {results.reduce((sum, r) => sum + r.handle_count, 0)} 个关联句柄
                </p>
              </div>
              {selectedPids.size > 0 && (
                <button className="btn btn-danger" onClick={handleReleasePath}>
                  <Trash2 size={18} />
                  释放选中进程 ({selectedPids.size})
                </button>
              )}
            </div>

            {results.map((occupation) => (
              <div key={occupation.pid} className="process-card">
                <div className="process-card-header">
                  <div className="process-info">
                    <input
                      type="checkbox"
                      checked={selectedPids.has(occupation.pid)}
                      onChange={() => togglePid(occupation.pid)}
                      style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                    />
                    <FolderOpen size={20} color="#2563eb" />
                    <div>
                      <div className="process-name">{occupation.process_name}</div>
                      <div className="text-muted" style={{ fontSize: '12px' }}>
                        {occupation.process_path}
                      </div>
                    </div>
                  </div>
                  <span className="process-pid">PID: {occupation.pid}</span>
                </div>

                <div className="process-stats">
                  <div className="stat-item">
                    <span className="stat-label">关联句柄</span>
                    <span className="stat-value">{occupation.handle_count}</span>
                  </div>
                </div>

                <div className="process-actions">
                  <button 
                    className="btn btn-danger" 
                    onClick={() => handleKillProcess(occupation.pid)}
                  >
                    结束进程
                  </button>
                  <button 
                    className="btn btn-secondary" 
                    onClick={() => handleKillProcessTree(occupation.pid)}
                  >
                    结束进程树
                  </button>
                </div>
              </div>
            ))}
          </>
        )}

        {!loading && !error && results.length === 0 && path && (
          <div className="empty-state">
            <FolderOpen size={48} style={{ opacity: 0.5, marginBottom: '16px' }} />
            <p>请输入路径并点击查询</p>
          </div>
        )}
      </div>
    </>
  );
}

export default PathOccupationPage;
