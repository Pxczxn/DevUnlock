import { useState, useEffect } from 'react';
import { Star, FolderOpen, Trash2, Plus } from 'lucide-react';
import type { FavoriteItem } from '../types';

function FavoritesPage() {
  const [favorites, setFavorites] = useState<FavoriteItem[]>([]);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [newFavorite, setNewFavorite] = useState({ name: '', path: '' });

  useEffect(() => {
    loadFavorites();
  }, []);

  const loadFavorites = () => {
    const savedFavorites = localStorage.getItem('devunlock-favorites');
    if (savedFavorites) {
      setFavorites(JSON.parse(savedFavorites));
    }
  };

  const saveFavorites = (items: FavoriteItem[]) => {
    localStorage.setItem('devunlock-favorites', JSON.stringify(items));
    setFavorites(items);
  };

  const addFavorite = () => {
    if (!newFavorite.name || !newFavorite.path) {
      alert('请输入名称和路径');
      return;
    }

    const favorite: FavoriteItem = {
      id: Date.now().toString(),
      name: newFavorite.name,
      path: newFavorite.path,
      type: 'directory',
    };

    saveFavorites([...favorites, favorite]);
    setNewFavorite({ name: '', path: '' });
    setShowAddDialog(false);
  };

  const deleteFavorite = (id: string) => {
    if (!confirm('确定要删除此收藏吗？')) return;
    saveFavorites(favorites.filter(f => f.id !== id));
  };

  return (
    <>
      <div className="header">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h1 style={{ fontSize: '20px', fontWeight: 600 }}>收藏夹</h1>
          <button className="btn btn-primary" onClick={() => setShowAddDialog(true)}>
            <Plus size={18} />
            添加收藏
          </button>
        </div>
      </div>

      <div className="content-area">
        {showAddDialog && (
          <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
          }}>
            <div style={{
              backgroundColor: 'var(--bg-primary)',
              padding: '24px',
              borderRadius: '8px',
              width: '500px',
              maxWidth: '90%',
            }}>
              <h2 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '16px' }}>
                添加收藏
              </h2>
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px' }}>
                  名称
                </label>
                <input
                  type="text"
                  className="search-input"
                  placeholder="例如：星语社区"
                  value={newFavorite.name}
                  onChange={(e) => setNewFavorite({ ...newFavorite, name: e.target.value })}
                />
              </div>
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px' }}>
                  路径
                </label>
                <input
                  type="text"
                  className="search-input"
                  placeholder="D:\Coding\project\xingyu-community"
                  value={newFavorite.path}
                  onChange={(e) => setNewFavorite({ ...newFavorite, path: e.target.value })}
                />
              </div>
              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                <button className="btn btn-secondary" onClick={() => setShowAddDialog(false)}>
                  取消
                </button>
                <button className="btn btn-primary" onClick={addFavorite}>
                  添加
                </button>
              </div>
            </div>
          </div>
        )}

        {favorites.length === 0 ? (
          <div className="empty-state">
            <Star size={48} style={{ opacity: 0.5, marginBottom: '16px' }} />
            <p>暂无收藏项目</p>
            <p className="text-muted" style={{ fontSize: '14px', marginTop: '8px' }}>
              收藏常用的项目路径，快速查询占用情况
            </p>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '16px' }}>
            {favorites.map((favorite) => (
              <div key={favorite.id} className="process-card">
                <div style={{ marginBottom: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                    <FolderOpen size={20} color="#2563eb" />
                    <div className="process-name">{favorite.name}</div>
                  </div>
                  <div className="text-muted" style={{ fontSize: '12px', wordBreak: 'break-all' }}>
                    {favorite.path}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button className="btn btn-primary" style={{ flex: 1 }}>
                    查询占用
                  </button>
                  <button 
                    className="btn btn-secondary"
                    onClick={() => deleteFavorite(favorite.id)}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}

export default FavoritesPage;
