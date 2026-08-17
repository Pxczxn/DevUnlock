import { Settings } from 'lucide-react';

function SettingsPage() {
  return (
    <>
      <div className="header">
        <h1 style={{ fontSize: '20px', fontWeight: 600 }}>设置</h1>
      </div>

      <div className="content-area">
        <div style={{ maxWidth: '600px' }}>
          <div style={{ marginBottom: '32px' }}>
            <h2 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '16px' }}>基础设置</h2>
            <div className="process-card" style={{ opacity: 0.6 }}>
              <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'not-allowed' }}>
                <div>
                  <div style={{ fontWeight: 500, marginBottom: '4px' }}>
                    开机启动 <span style={{ fontSize: '12px', color: '#6b7280' }}>(即将支持)</span>
                  </div>
                  <div className="text-muted" style={{ fontSize: '12px' }}>在系统启动时自动运行 DevUnlock</div>
                </div>
                <input type="checkbox" disabled style={{ width: '20px', height: '20px' }} />
              </label>
            </div>
            <div className="process-card" style={{ opacity: 0.6 }}>
              <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'not-allowed' }}>
                <div>
                  <div style={{ fontWeight: 500, marginBottom: '4px' }}>
                    最小化到托盘 <span style={{ fontSize: '12px', color: '#6b7280' }}>(即将支持)</span>
                  </div>
                  <div className="text-muted" style={{ fontSize: '12px' }}>关闭窗口时最小化到系统托盘</div>
                </div>
                <input type="checkbox" disabled style={{ width: '20px', height: '20px' }} />
              </label>
            </div>
          </div>

          <div style={{ marginBottom: '32px' }}>
            <h2 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '16px' }}>查询设置</h2>
            <div className="process-card" style={{ opacity: 0.6 }}>
              <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'not-allowed' }}>
                <div>
                  <div style={{ fontWeight: 500, marginBottom: '4px' }}>
                    路径包含子目录 <span style={{ fontSize: '12px', color: '#6b7280' }}>(即将支持)</span>
                  </div>
                  <div className="text-muted" style={{ fontSize: '12px' }}>查询目录时包含所有子目录</div>
                </div>
                <input type="checkbox" defaultChecked disabled style={{ width: '20px', height: '20px' }} />
              </label>
            </div>
            <div className="process-card" style={{ opacity: 0.6 }}>
              <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'not-allowed' }}>
                <div>
                  <div style={{ fontWeight: 500, marginBottom: '4px' }}>
                    显示系统进程 <span style={{ fontSize: '12px', color: '#6b7280' }}>(即将支持)</span>
                  </div>
                  <div className="text-muted" style={{ fontSize: '12px' }}>在进程列表中显示系统关键进程</div>
                </div>
                <input type="checkbox" disabled style={{ width: '20px', height: '20px' }} />
              </label>
            </div>
          </div>

          <div style={{ marginBottom: '32px' }}>
            <h2 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '16px' }}>安全设置</h2>
            <div className="process-card">
              <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ fontWeight: 500, marginBottom: '4px' }}>结束进程前确认</div>
                  <div className="text-muted" style={{ fontSize: '12px' }}>结束进程前显示确认对话框（当前始终启用）</div>
                </div>
                <input type="checkbox" defaultChecked disabled style={{ width: '20px', height: '20px' }} />
              </label>
            </div>
            <div className="process-card">
              <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ fontWeight: 500, marginBottom: '4px' }}>保护系统进程</div>
                  <div className="text-muted" style={{ fontSize: '12px' }}>防止误操作结束系统关键进程（当前始终启用）</div>
                </div>
                <input type="checkbox" defaultChecked disabled style={{ width: '20px', height: '20px' }} />
              </label>
            </div>
          </div>

          <div style={{ marginBottom: '32px' }}>
            <h2 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '16px' }}>关于</h2>
            <div className="process-card">
              <div style={{ textAlign: 'center', padding: '16px' }}>
                <Settings size={48} color="var(--accent-color)" style={{ marginBottom: '16px' }} />
                <div style={{ fontSize: '18px', fontWeight: 600, marginBottom: '8px' }}>DevUnlock</div>
                <div className="text-muted" style={{ fontSize: '14px', marginBottom: '16px' }}>版本 0.1.0</div>
                <p className="text-muted" style={{ fontSize: '14px', lineHeight: '1.6' }}>
                  Windows 开发环境资源占用查询与释放工具
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

export default SettingsPage;
