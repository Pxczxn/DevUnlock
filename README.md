# DevUnlock

> Windows 开发环境资源占用查询与释放工具

DevUnlock 是一个现代化的 Windows 桌面应用，专为开发者设计，用于快速查询和释放被占用的目录、文件和端口。

![DevUnlock Screenshot](./screenshot.png)

## 功能特性

### 核心功能

- **路径占用查询** - 查询哪些进程正在占用指定的目录或文件
- **端口占用查询** - 快速查询端口占用情况，支持单端口、多端口和端口范围查询
- **进程管理** - 查看系统进程列表，搜索和管理进程
- **批量操作** - 批量结束进程，一键释放目录/端口
- **进程树** - 支持结束整个进程树
- **历史记录** - 记录查询历史，快速重复查询
- **收藏夹** - 收藏常用项目路径

### 特色优势

相比 Windows 原生工具（资源监视器、netstat、taskkill）：

- ✅ 现代化的用户界面
- ✅ 统一的操作入口
- ✅ 更快的查询速度
- ✅ 更直观的结果展示
- ✅ 一键批量操作
- ✅ 面向开发者优化

## 技术栈

- **后端**: Rust + Tauri
- **前端**: React + TypeScript + Vite
- **UI**: Lucide Icons
- **系统 API**: Windows API (Process, Port, Handle 查询)

## 开发环境设置

### 前置要求

1. **Node.js** (推荐 v18 或更高版本)
   - 下载: https://nodejs.org/

2. **Rust** (推荐最新稳定版)
   - 下载: https://www.rust-lang.org/tools/install
   - Windows 安装: 访问上述链接下载 rustup-init.exe

3. **Visual Studio C++ Build Tools** (Windows)
   - 下载: https://visualstudio.microsoft.com/visual-cpp-build-tools/
   - 安装 "Desktop development with C++" 工作负载

### 安装依赖

```bash
# 安装前端依赖
npm install

# Rust 依赖会在首次构建时自动下载
```

### 开发模式

```bash
# 启动开发服务器（热重载）
npm run tauri dev
```

这将：
1. 启动 Vite 开发服务器（前端）
2. 编译 Rust 后端
3. 打开 DevUnlock 应用窗口

### 构建生产版本

```bash
# 构建应用程序
npm run tauri build
```

生成的可执行文件位于 `src-tauri/target/release/`

## 项目结构

```
DevUnlock/
├── src/                      # 前端源代码
│   ├── pages/               # 页面组件
│   │   ├── HomePage.tsx
│   │   ├── PathOccupationPage.tsx
│   │   ├── PortOccupationPage.tsx
│   │   ├── ProcessPage.tsx
│   │   ├── HistoryPage.tsx
│   │   ├── FavoritesPage.tsx
│   │   └── SettingsPage.tsx
│   ├── api.ts               # Tauri API 封装
│   ├── types.ts             # TypeScript 类型定义
│   ├── App.tsx              # 主应用组件
│   └── App.css              # 全局样式
├── src-tauri/               # 后端源代码
│   ├── src/
│   │   ├── process.rs       # 进程管理模块
│   │   ├── port.rs          # 端口查询模块
│   │   ├── handle.rs        # 文件句柄查询模块
│   │   └── lib.rs           # 主入口和命令注册
│   └── Cargo.toml           # Rust 依赖配置
├── package.json             # Node.js 依赖配置
└── 功能文档.md              # 详细功能规范
```

## 使用指南

### 首页

首页提供快速查询入口和常用开发端口快捷按钮。

### 路径占用查询

1. 点击侧边栏"路径占用"
2. 输入目录或文件完整路径，例如：`D:\Coding\project\xingyu-community`
3. 点击"查询"按钮
4. 查看占用该路径的进程列表
5. 可以选择多个进程批量结束，或单独结束某个进程

### 端口占用查询

1. 点击侧边栏"端口占用"
2. 输入端口号（支持以下格式）：
   - 单端口: `8080`
   - 多端口: `8080,5173,3000`
   - 端口范围: `3000-3010`
3. 点击"查询"按钮
4. 查看端口占用情况
5. 点击"释放端口"一键结束占用进程

### 进程管理

1. 点击侧边栏"进程"
2. 查看所有系统进程
3. 使用搜索框过滤进程（支持进程名、PID、路径搜索）
4. 结束进程或进程树

## 已知限制

1. **句柄枚举**: 当前版本的文件句柄枚举功能使用简化实现，主要检测进程可执行文件路径。完整的句柄枚举需要内核级访问权限。

2. **权限要求**: 某些系统进程需要管理员权限才能查询或结束。

3. **平台支持**: 目前仅支持 Windows 平台（Windows 10/11）。

## 路线图

### MVP (v0.1) ✅
- [x] 基础 UI 框架
- [x] 端口占用查询
- [x] 进程管理
- [x] 路径占用查询（简化版）
- [x] 历史记录
- [x] 收藏夹

### v0.2 (计划中)
- [ ] 增强的文件句柄枚举
- [ ] 拖拽文件/文件夹查询
- [ ] 系统托盘支持
- [ ] 全局快捷键
- [ ] 进程详情页面

## 许可证

本项目采用 MIT 许可证。

## 致谢

- [Tauri](https://tauri.app/) - 构建跨平台桌面应用
- [React](https://react.dev/) - 用户界面框架
- [Lucide Icons](https://lucide.dev/) - 图标库

---

**DevUnlock** - 让 Windows 开发更高效 🚀
