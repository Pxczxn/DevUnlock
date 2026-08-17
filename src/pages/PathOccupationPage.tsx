import { useState, useEffect } from 'react';
import { Search, FolderOpen, AlertCircle, Trash2, Shield, ChevronDown, ChevronUp } from 'lucide-react';
import { open } from '@tauri-apps/plugin-dialog';
import { pathApi, processApi } from '../api';
import { saveQueryHistory } from '../historyUtils';
import { isProtectedProcess, getKillableProcesses, getProtectedProcesses } from '../processProtection';
import { formatError } from '../utils/errorUtils';
import type { PathOccupation, ScanDiagnostics } from '../types';

interface PathOccupationPageProps {
  initialQuery?: string;
}

function PathOccupationPage({ initialQuery }: PathOccupationPageProps) {
  const [inputPath, setInputPath] = useState(''); // 输入框路径
  const [activeTarget, setActiveTarget] = useState(''); // 当前查询结果的路径
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<PathOccupation[]>([]);
  const [diagnostics, setDiagnostics] = useState<ScanDiagnostics | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedPids, setSelectedPids] = useState<Set<number>>(new Set());
  const [expandedPids, setExpandedPids] = useState<Set<number>>(new Set());
  const [isDragging, setIsDragging] = useState(false);

  // 自动执行查询
  useEffect(() => {
    if (initialQuery) {
      setInputPath(initialQuery);
      queryTarget(initialQuery);
    }
  }, [initialQuery]);

  // 统一查询入口
  const queryTarget = async (rawPath: string) => {
    const target = rawPath.trim();

    // 早期验证
    if (!target) {
      setError('请输入路径');
      return;
    }

    // 设置加载状态并清空之前的结果
    setLoading(true);
    setError(null);
    setResults([]);
    setSelectedPids(new Set());
    setExpandedPids(new Set());

    const startedAt = performance.now();

    try {
      // 验证路径存在性
      const exists = await pathApi.validate(target);
      if (!exists) {
        setError('路径不存在');
        return;
      }

      // 判断类型
      const isDir = await pathApi.isDirectory(target);

      // 查询后端
      const result = isDir 
        ? await pathApi.queryPath(target)
        : await pathApi.queryFile(target);

      // 计算耗时
      const elapsedMs = Math.round(performance.now() - startedAt);

      // 按句柄数量降序排序
      const sortedOccupations = result.occupations.sort(
        (a, b) => b.handle_count - a.handle_count
      );

      // 更新状态
      setResults(sortedOccupations);
      setDiagnostics({ ...result.diagnostics, elapsedMs });
      setActiveTarget(target);

      // 保存到历史记录
      saveQueryHistory(isDir ? 'directory' : 'file', target);

      // 处理空结果
      if (sortedOccupations.length === 0) {
        setError('未发现占用该路径的进程');
      }
    } catch (err) {
      setError(formatError(err));
    } finally {
      setLoading(false);
    }
  };

  // 刷新当前目标（根据类型自动选择 queryPath 或 queryFile）
  const refreshCurrentTarget = async (): Promise<PathOccupation[]> => {
    if (!activeTarget) return [];
    
    try {
      // 判断是目录还是文件
      const isDir = await pathApi.isDirectory(activeTarget);
      
      const result = isDir 
        ? await pathApi.queryPath(activeTarget)
        : await pathApi.queryFile(activeTarget);
      
      setDiagnostics(result.diagnostics);
      
      // 按句柄数量降序排序
      return result.occupations.sort((a, b) => b.handle_count - a.handle_count);
    } catch (err) {
      // 如果判断失败，默认使用 queryPath
      console.warn('Failed to determine path type, using queryPath:', err);
      const result = await pathApi.queryPath(activeTarget);
      setDiagnostics(result.diagnostics);
      return result.occupations.sort((a, b) => b.handle_count - a.handle_count);
    }
  };

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

  const handleQuery = () => queryTarget(inputPath);

  // 文件/文件夹选择器
  const handleBrowse = async () => {
    // 防止并发操作
    if (loading) return;

    try {
      const selected = await open({
        directory: false,
        multiple: false,
        title: '选择文件或文件夹',
        defaultPath: inputPath || undefined
      });

      if (selected && typeof selected === 'string') {
        setInputPath(selected);
        await queryTarget(selected);
      }
    } catch (err) {
      console.error('File dialog error:', err);
      setError(formatError(err));
    }
  };

  // 拖拽事件处理
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!loading) {
      setIsDragging(true);
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.currentTarget === e.target) {
      setIsDragging(false);
    }
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    if (loading) return;

    const files = e.dataTransfer.files;

    if (files.length === 0) return;

    // 获取第一个文件/文件夹路径
    const firstFile = files[0];
    const path = (firstFile as any).path;

    if (!path) {
      setError('无法获取文件路径');
      return;
    }

    // 处理多个文件拖拽（提示只处理第一个）
    if (files.length > 1) {
      setTimeout(() => {
        alert(`当前仅支持单个目标，已查询 ${firstFile.name}`);
      }, 100);
    }

    setInputPath(path);
    await queryTarget(path);
  };

  const handleKillProcess = async (pid: number) => {
    if (!confirm(`确定要结束进程 ${pid} 吗？`)) return;

    try {
      await processApi.terminate(pid);
      
      // 等待系统稳定
      await new Promise(resolve => setTimeout(resolve, 300));
      
      // 重新查询真实状态
      const newResults = await refreshCurrentTarget();
      setResults(newResults);
      
      // 清理该 PID 的选择和展开状态
      setSelectedPids(prev => {
        const next = new Set(prev);
        next.delete(pid);
        return next;
      });
      setExpandedPids(prev => {
        const next = new Set(prev);
        next.delete(pid);
        return next;
      });
      
      // 如果结果为空，显示提示
      if (newResults.length === 0) {
        setError('当前无占用进程');
      }
    } catch (err) {
      alert(`结束进程失败: ${formatError(err)}`);
    }
  };

  const handleKillProcessTree = async (pid: number) => {
    if (!confirm(`确定要结束进程树 ${pid} 吗？这将结束该进程及其所有子进程。`)) return;

    try {
      await processApi.terminateTree(pid);
      
      // 等待系统稳定
      await new Promise(resolve => setTimeout(resolve, 300));
      
      // 重新查询真实状态
      const newResults = await refreshCurrentTarget();
      setResults(newResults);
      
      // 清理状态
      setSelectedPids(new Set());
      setExpandedPids(new Set());
      
      // 如果结果为空，显示提示
      if (newResults.length === 0) {
        setError('当前无占用进程');
      }
    } catch (err) {
      alert(`结束进程树失败: ${formatError(err)}`);
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
      const batchResults = await pathApi.release(activeTarget, pids);
      
      // 统计结果
      const successCount = batchResults.filter(r => r.success).length;
      const failedResults = batchResults.filter(r => !r.success);
      
      // 等待系统稳定
      await new Promise(resolve => setTimeout(resolve, 300));
      
      // 重新查询真实状态
      const newResults = await refreshCurrentTarget();
      setResults(newResults);
      setSelectedPids(new Set());
      
      // 如果结果为空，显示提示
      if (newResults.length === 0) {
        setError('当前无占用进程');
      }
      
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
      alert(`释放路径失败: ${formatError(err)}`);
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
      const batchResults = await pathApi.release(activeTarget, pids);
      
      // 统计结果
      const successCount = batchResults.filter(r => r.success).length;
      const failedCount = batchResults.filter(r => !r.success).length;
      
      // 等待系统稳定
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // 重新查询真实状态
      const newResults = await refreshCurrentTarget();
      setResults(newResults);
      setSelectedPids(new Set());
      
      // 如果结果为空，显示提示
      if (newResults.length === 0) {
        setError('当前无占用进程');
      }
      
      // 显示结果
      const remainingMsg = newResults.length > 0 
        ? `\n剩余占用：${newResults.length} 个\n\n${newResults.map((p: PathOccupation) => `• ${p.process_name} (PID ${p.pid})`).join('\n')}`
        : '\n所有进程已释放';
      
      alert(`释放完成\n\n成功：${successCount} 个\n失败：${failedCount} 个${remainingMsg}`);
    } catch (err) {
      alert(`一键释放失败: ${formatError(err)}`);
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
        <div 
          className="search-bar"
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          style={{
            borderRadius: '12px',
            padding: isDragging ? '20px' : '0',
            border: isDragging ? '2px dashed var(--accent-color)' : 'none',
            backgroundColor: isDragging ? 'rgba(37, 99, 235, 0.05)' : 'transparent',
            transition: 'all 0.2s ease',
            position: 'relative'
          }}
        >
          {isDragging && (
            <div style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '14px',
              color: 'var(--accent-color)',
              pointerEvents: 'none',
              zIndex: 10
            }}>
              📁 松开以查询
            </div>
          )}
          
          <div style={{ position: 'relative', flex: 1 }}>
            <input
              type="text"
              className="search-input"
              placeholder="输入目录或文件路径，例如：D:\Coding\project\xingyu-community"
              value={inputPath}
              onChange={(e) => setInputPath(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && !loading && queryTarget(inputPath)}
              disabled={loading}
              style={{ paddingRight: '48px' }}
            />
            <button
              onClick={handleBrowse}
              disabled={loading}
              style={{
                position: 'absolute',
                right: '8px',
                top: '50%',
                transform: 'translateY(-50%)',
                background: 'none',
                border: 'none',
                cursor: loading ? 'not-allowed' : 'pointer',
                opacity: loading ? 0.5 : 1,
                fontSize: '18px',
                padding: '4px'
              }}
              title="选择文件或文件夹"
            >
              📁
            </button>
          </div>
          <button 
            className="btn btn-primary" 
            onClick={handleQuery} 
            disabled={loading}
          >
            <Search size={18} />
            {loading ? '查询中...' : '查询'}
          </button>
        </div>
      </div>

      <div className="content-area">
        {loading && (
          <div className="loading">
            <div className="spinner"></div>
            <p>正在扫描系统 Handle...</p>
            <p style={{ fontSize: '12px', opacity: 0.7, marginTop: '4px' }}>
              这可能需要几秒
            </p>
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
                    {diagnostics?.elapsedMs && ` · 扫描耗时 ${diagnostics.elapsedMs} ms`}
                  </p>
                  {diagnostics && (
                    <p className="text-muted" style={{ fontSize: '12px', marginTop: '4px' }}>
                      扫描统计: {diagnostics.total_processes} 个进程 · 
                      {diagnostics.handles_duplicated} 个句柄复制 · 
                      {diagnostics.handles_resolved} 个解析 · 
                      {diagnostics.handles_matched} 个匹配
                      {diagnostics.skipped_access_denied > 0 && ` · ${diagnostics.skipped_access_denied} 个无权限`}
                    </p>
                  )}
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

        {!loading && !error && results.length === 0 && !activeTarget && (
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
