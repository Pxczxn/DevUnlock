import { useState, useEffect } from 'react';
import { Search, FolderOpen, AlertCircle, Trash2, Shield, ChevronDown, ChevronUp } from 'lucide-react';
import { pathApi, processApi } from '../api';
import { saveQueryHistory } from '../historyUtils';
import { isProtectedProcess, getKillableProcesses, getProtectedProcesses } from '../processProtection';
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
  const [expandedPids, setExpandedPids] = useState<Set<number>>(new Set());

  // 自动执行查询
  useEffect(() => {
    if (initialQuery) {
      setPath(initialQuery);
      handleQueryWithPath(initialQuery);
    }
  }, [initialQuery]);

  // 获取全选状态
  const getSelectAllState = (): 'none' | 'partial' | 'all' => {
    const killable = getKillableProcesses(results);
    const selectedKillable = killable.filter(p => selectedPids.has(p.pid));
    
    if (selectedKillable.length === 0) return 'none';
    if (selectedKillable.length === killable.length) return 'all';
    return 'partial';
  };

  // 全选/取消全选
  const handleSelectAll = () => {
    const state = getSelectAllState();
    
    if (state === 'all') {
      // 取消全选
      setSelectedPids(new Set());
    } else {
      // 全选（只选择可结束的进程）
      const killable = getKillableProcesses(results);
      setSelectedPids(new Set(killable.map(p => p.pid)));
    }
  };

  // 切换展开/收起
  const toggleExpand = (pid: number) => {
    setExpandedPids(prev => {
      const next = new Set(prev);
      if (next.has(pid)) {
        next.delete(pid);
      } else {
        next.add(pid);
      }
      return next;
    });
  };

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
      
      // 等待系统稳定
      await new Promise(resolve => setTimeout(resolve, 300));
      
      // 重新查询真实状态
      const newResults = await pathApi.queryPath(path);
      setResults(newResults);
    } catch (err) {
      alert(`结束进程失败: ${err instanceof Error ? err.message : '未知错误'}`);
    }
  };

  const handleKillProcessTree = async (pid: number) => {
    if (!confirm(`确定要结束进程树 ${pid} 吗？这将结束该进程及其所有子进程。`)) return;

    try {
      await processApi.terminateTree(pid);
      
      // 等待系统稳定
      await new Promise(resolve => setTimeout(resolve, 300));
      
      // 重新查询真实状态
      const newResults = await pathApi.queryPath(path);
      setResults(newResults);
    } catch (err) {
      alert(`结束进程树失败: ${err instanceof Error ? err.message : '未知错误'}`);
    }
  };

  const handleReleasePath = async () => {
    if (selectedPids.size === 0) {
      alert('请选择要结束的进程');
      return;
    }

    const selectedProcesses = results.filter(r => selectedPids.has(r.pid));
    const processNames = selectedProcesses.map(p => `• ${p.process_name} (PID ${p.pid})`).join('\n');
    
    if (!confirm(`确定要结束以下 ${selectedPids.size} 个进程吗？\n\n${processNames}`)) return;

    try {
      const pids = Array.from(selectedPids);
      const batchResults = await pathApi.release(path, pids);
      
      // 统计结果
      const successCount = batchResults.filter(r => r.success).length;
      const failedResults = batchResults.filter(r => !r.success);
      
      // 等待系统稳定
      await new Promise(resolve => setTimeout(resolve, 300));
      
      // 重新查询真实状态
      const newResults = await pathApi.queryPath(path);
      setResults(newResults);
      setSelectedPids(new Set());
      
      // 显示结果
      if (failedResults.length > 0) {
        const failedMsg = failedResults
          .map(r => `PID ${r.pid}: ${r.message}`)
          .join('\n');
        alert(`释放完成\n\n成功：${successCount} 个\n失败：${failedResults.length} 个\n\n失败详情：\n${failedMsg}`);
      } else {
        alert(`成功释放 ${successCount} 个进程`);
      }
    } catch (err) {
      alert(`释放路径失败: ${err instanceof Error ? err.message : '未知错误'}`);
    }
  };

  // 一键释放全部
  const handleReleaseAll = async () => {
    const killable = getKillableProcesses(results);
    const protected_ = getProtectedProcesses(results);
    
    if (killable.length === 0) {
      alert('没有可结束的进程');
      return;
    }

    const killableNames = killable.map(p => `• ${p.process_name} (PID ${p.pid})`).join('\n');
    const protectedNames = protected_.length > 0 
      ? `\n\n受保护进程（不会结束）：\n${protected_.map(p => `• ${p.process_name} (PID ${p.pid})`).join('\n')}`
      : '';
    
    if (!confirm(`一键释放全部\n\n将结束以下 ${killable.length} 个进程：\n${killableNames}${protectedNames}`)) return;

    try {
      const pids = killable.map(p => p.pid);
      const batchResults = await pathApi.release(path, pids);
      
      // 统计结果
      const successCount = batchResults.filter(r => r.success).length;
      const failedCount = batchResults.filter(r => !r.success).length;
      
      // 等待系统稳定
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // 重新查询真实状态
      const newResults = await pathApi.queryPath(path);
      setResults(newResults);
      setSelectedPids(new Set());
      
      // 显示结果
      const remainingMsg = newResults.length > 0 
        ? `\n剩余占用：${newResults.length} 个\n\n${newResults.map((p: PathOccupation) => `• ${p.process_name} (PID ${p.pid})`).join('\n')}`
        : '\n所有进程已释放';
      
      alert(`释放完成\n\n成功：${successCount} 个\n失败：${failedCount} 个${remainingMsg}`);
    } catch (err) {
      alert(`一键释放失败: ${err instanceof Error ? err.message : '未知错误'}`);
    }
  };

  const togglePid = (pid: number) => {
    // 检查是否受保护
    const process = results.find(r => r.pid === pid);
    if (process && isProtectedProcess(process)) {
      return; // 受保护的进程不能选择
    }
    
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
            <div style={{ marginBottom: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <div>
                  <h2 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '4px' }}>
                    发现 {results.length} 个关联进程
                  </h2>
                  <p className="text-muted" style={{ fontSize: '14px' }}>
                    共 {results.reduce((sum, r) => sum + r.handle_count, 0)} 个关联句柄
                  </p>
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button 
                    className="btn btn-danger" 
                    onClick={handleReleaseAll}
                    style={{ background: '#dc2626' }}
                  >
                    🔥 一键释放全部
                  </button>
                  {selectedPids.size > 0 && (
                    <button className="btn btn-danger" onClick={handleReleasePath}>
                      <Trash2 size={18} />
                      释放选中 ({selectedPids.size})
                    </button>
                  )}
                </div>
              </div>
              
              {/* 全选 */}
              <div style={{ 
                padding: '12px', 
                background: '#f9fafb', 
                borderRadius: '8px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}>
                <input
                  type="checkbox"
                  checked={getSelectAllState() === 'all'}
                  ref={el => {
                    if (el) el.indeterminate = getSelectAllState() === 'partial';
                  }}
                  onChange={handleSelectAll}
                  style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                />
                <span style={{ fontSize: '14px', fontWeight: 500 }}>
                  {getSelectAllState() === 'all' ? '取消全选' : '全选'} 
                  {getSelectAllState() === 'partial' && ` (${selectedPids.size}/${getKillableProcesses(results).length})`}
                </span>
                <span className="text-muted" style={{ fontSize: '12px', marginLeft: 'auto' }}>
                  可结束：{getKillableProcesses(results).length} 个 | 
                  受保护：{getProtectedProcesses(results).length} 个
                </span>
              </div>
            </div>

            {results.map((occupation) => {
              const isProtected = isProtectedProcess(occupation);
              const isExpanded = expandedPids.has(occupation.pid);
              
              return (
              <div key={occupation.pid} className="process-card">
                <div className="process-card-header">
                  <div className="process-info">
                    <input
                      type="checkbox"
                      checked={selectedPids.has(occupation.pid)}
                      onChange={() => togglePid(occupation.pid)}
                      disabled={isProtected}
                      style={{ 
                        width: '18px', 
                        height: '18px', 
                        cursor: isProtected ? 'not-allowed' : 'pointer',
                        opacity: isProtected ? 0.5 : 1
                      }}
                    />
                    {isProtected ? (
                      <Shield size={20} color="#dc2626" />
                    ) : (
                      <FolderOpen size={20} color="#2563eb" />
                    )}
                    <div>
                      <div className="process-name">
                        {occupation.process_name}
                        {isProtected && (
                          <span style={{ 
                            marginLeft: '8px', 
                            fontSize: '12px', 
                            color: '#dc2626',
                            fontWeight: 'normal'
                          }}>
                            [受保护]
                          </span>
                        )}
                      </div>
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
                  {occupation.handles && occupation.handles.length > 0 && (
                    <button
                      onClick={() => toggleExpand(occupation.pid)}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: '#2563eb',
                        cursor: 'pointer',
                        fontSize: '13px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                        padding: '4px 8px'
                      }}
                    >
                      {isExpanded ? (
                        <>收起关联资源 <ChevronUp size={16} /></>
                      ) : (
                        <>展开关联资源 <ChevronDown size={16} /></>
                      )}
                    </button>
                  )}
                </div>

                {/* Handle 详情展开 */}
                {isExpanded && occupation.handles && occupation.handles.length > 0 && (
                  <div style={{
                    marginTop: '12px',
                    padding: '12px',
                    background: '#f9fafb',
                    borderRadius: '6px',
                    maxHeight: '300px',
                    overflowY: 'auto'
                  }}>
                    {occupation.handles.slice(0, 20).map((handle, idx) => (
                      <div key={idx} style={{
                        padding: '6px 0',
                        fontSize: '13px',
                        color: '#374151',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        borderBottom: idx < Math.min(19, occupation.handles.length - 1) ? '1px solid #e5e7eb' : 'none'
                      }}>
                        <span>{handle.name.includes('.') || handle.name.match(/\.[a-z]+$/i) ? '📄' : '📁'}</span>
                        <span style={{ 
                          wordBreak: 'break-all',
                          flex: 1
                        }}>
                          {handle.name}
                        </span>
                      </div>
                    ))}
                    {occupation.handles.length > 20 && (
                      <div style={{
                        padding: '8px 0',
                        fontSize: '13px',
                        color: '#6b7280',
                        textAlign: 'center'
                      }}>
                        ... +{occupation.handles.length - 20} 个
                      </div>
                    )}
                  </div>
                )}

                <div className="process-actions">
                  <button 
                    className="btn btn-danger" 
                    onClick={() => handleKillProcess(occupation.pid)}
                    disabled={isProtected}
                    style={{ opacity: isProtected ? 0.5 : 1, cursor: isProtected ? 'not-allowed' : 'pointer' }}
                  >
                    结束进程
                  </button>
                  <button 
                    className="btn btn-danger" 
                    onClick={() => handleKillProcessTree(occupation.pid)}
                    disabled={isProtected}
                    style={{ opacity: isProtected ? 0.5 : 1, cursor: isProtected ? 'not-allowed' : 'pointer' }}
                  >
                    结束进程树
                  </button>
                </div>
              </div>
            );
            })}
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
