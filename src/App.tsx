import { useState } from "react";
import "./App.css";
import HomePage from "./pages/HomePage";
import PathOccupationPage from "./pages/PathOccupationPage";
import PortOccupationPage from "./pages/PortOccupationPage";
import ProcessPage from "./pages/ProcessPage";
import HistoryPage from "./pages/HistoryPage";
import FavoritesPage from "./pages/FavoritesPage";
import SettingsPage from "./pages/SettingsPage";
import { Home, FolderOpen, Wifi, Activity, Clock, Star, Settings } from "lucide-react";

type Page = 'home' | 'path' | 'port' | 'process' | 'history' | 'favorites' | 'settings';

function App() {
  const [currentPage, setCurrentPage] = useState<Page>('home');

  const renderPage = () => {
    switch (currentPage) {
      case 'home':
        return <HomePage onNavigate={setCurrentPage} />;
      case 'path':
        return <PathOccupationPage />;
      case 'port':
        return <PortOccupationPage />;
      case 'process':
        return <ProcessPage />;
      case 'history':
        return <HistoryPage />;
      case 'favorites':
        return <FavoritesPage />;
      case 'settings':
        return <SettingsPage />;
      default:
        return <HomePage onNavigate={setCurrentPage} />;
    }
  };

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="sidebar-logo">DevUnlock</div>
        <nav className="sidebar-nav">
          <button
            className={`nav-item ${currentPage === 'home' ? 'active' : ''}`}
            onClick={() => setCurrentPage('home')}
          >
            <Home size={20} />
            <span>首页</span>
          </button>
          <button
            className={`nav-item ${currentPage === 'path' ? 'active' : ''}`}
            onClick={() => setCurrentPage('path')}
          >
            <FolderOpen size={20} />
            <span>路径占用</span>
          </button>
          <button
            className={`nav-item ${currentPage === 'port' ? 'active' : ''}`}
            onClick={() => setCurrentPage('port')}
          >
            <Wifi size={20} />
            <span>端口占用</span>
          </button>
          <button
            className={`nav-item ${currentPage === 'process' ? 'active' : ''}`}
            onClick={() => setCurrentPage('process')}
          >
            <Activity size={20} />
            <span>进程</span>
          </button>
          <button
            className={`nav-item ${currentPage === 'history' ? 'active' : ''}`}
            onClick={() => setCurrentPage('history')}
          >
            <Clock size={20} />
            <span>历史记录</span>
          </button>
          <button
            className={`nav-item ${currentPage === 'favorites' ? 'active' : ''}`}
            onClick={() => setCurrentPage('favorites')}
          >
            <Star size={20} />
            <span>收藏</span>
          </button>
          <button
            className={`nav-item ${currentPage === 'settings' ? 'active' : ''}`}
            onClick={() => setCurrentPage('settings')}
          >
            <Settings size={20} />
            <span>设置</span>
          </button>
        </nav>
      </aside>
      <main className="main-content">
        {renderPage()}
      </main>
    </div>
  );
}

export default App;
