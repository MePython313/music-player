const HyperPlayerStorage = {
  getTheme() {
    return parseInt(localStorage.getItem('hp_theme') || '0', 10);
  },
  setTheme(index) {
    localStorage.setItem('hp_theme', index.toString());
  },
  getRating(songName) {
    return parseInt(localStorage.getItem('hp_rating_' + songName) || '0', 10);
  },
  setRating(songName, value) {
    localStorage.setItem('hp_rating_' + songName, value.toString());
  },
  getVolume() {
    const v = parseFloat(localStorage.getItem('hp_volume') || '0.7');
    return isNaN(v) ? 0.7 : Math.max(0, Math.min(1, v));
  },
  setVolume(value) {
    localStorage.setItem('hp_volume', Math.max(0, Math.min(1, value)).toString());
  },
  getSidebarWidth() {
    const w = parseInt(localStorage.getItem('hp_sidebar_w') || '340', 10);
    return isNaN(w) ? 340 : Math.max(200, Math.min(600, w));
  },
  setSidebarWidth(w) {
    localStorage.setItem('hp_sidebar_w', Math.max(200, Math.min(600, w)).toString());
  },

  _dbPromise: null,

  _getDB() {
    if (!this._dbPromise) {
      this._dbPromise = new Promise((resolve, reject) => {
        if (!window.indexedDB) return reject(new Error('IndexedDB not supported'));
        const r = indexedDB.open('HyperPlayerDB', 1);
        r.onupgradeneeded = () => {
          if (!r.result.objectStoreNames.contains('handles')) {
            r.result.createObjectStore('handles');
          }
        };
        r.onsuccess = () => resolve(r.result);
        r.onerror = () => reject(r.error);
      });
    }
    return this._dbPromise;
  },

  async saveDirHandle(handle) {
    try {
      const db = await this._getDB();
      const tx = db.transaction('handles', 'readwrite');
      tx.objectStore('handles').put(handle, 'dirHandle');
      await new Promise((resolve, reject) => {
        tx.oncomplete = resolve;
        tx.onerror = () => reject(tx.error);
      });
    } catch (e) {
      console.warn('saveDirHandle failed:', e);
    }
  },

  async loadDirHandle() {
    try {
      const db = await this._getDB();
      const tx = db.transaction('handles', 'readonly');
      const store = tx.objectStore('handles');
      const r = store.get('dirHandle');
      return await new Promise((resolve, reject) => {
        r.onsuccess = () => resolve(r.result || null);
        r.onerror = () => reject(r.error);
      });
    } catch (e) {
      console.warn('loadDirHandle failed:', e);
      return null;
    }
  },

  async clearDirHandle() {
    try {
      const db = await this._getDB();
      const tx = db.transaction('handles', 'readwrite');
      tx.objectStore('handles').delete('dirHandle');
      await new Promise((resolve, reject) => {
        tx.oncomplete = resolve;
        tx.onerror = () => reject(tx.error);
      });
    } catch (e) {
      console.warn('clearDirHandle failed:', e);
    }
  }
};
