// IndexedDB persistence for gallery items

const DB_NAME = 'MediaStudioDB';
const DB_VERSION = 1;
const STORE_NAME = 'gallery';

/**
 * Initialize IndexedDB
 */
export async function initDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        store.createIndex('timestamp', 'timestamp', { unique: false });
        store.createIndex('type', 'type', { unique: false });
      }
    };
  });
}

/**
 * Save a gallery item to IndexedDB
 */
export async function saveGalleryItem(blob, type, metadata = {}) {
  try {
    const db = await initDB();
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    
    const item = {
      id: `${Date.now()}-${Math.random().toString(36).substring(2)}`,
      blob: blob,
      type: type,
      size: blob.size,
      timestamp: Date.now(),
      ...metadata
    };
    
    await new Promise((resolve, reject) => {
      const request = store.add(item);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    
    return item.id;
  } catch (err) {
    console.error('Failed to save gallery item:', err);
    throw err;
  }
}

/**
 * Load all gallery items from IndexedDB
 */
export async function loadGalleryItems() {
  try {
    const db = await initDB();
    const transaction = db.transaction([STORE_NAME], 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const index = store.index('timestamp');
    
    return new Promise((resolve, reject) => {
      const request = index.getAll();
      request.onsuccess = () => {
        // Sort by timestamp descending (newest first)
        const items = request.result.sort((a, b) => b.timestamp - a.timestamp);
        resolve(items);
      };
      request.onerror = () => reject(request.error);
    });
  } catch (err) {
    console.error('Failed to load gallery items:', err);
    return [];
  }
}

/**
 * Delete a gallery item from IndexedDB
 */
export async function deleteGalleryItem(id) {
  try {
    const db = await initDB();
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    
    return new Promise((resolve, reject) => {
      const request = store.delete(id);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  } catch (err) {
    console.error('Failed to delete gallery item:', err);
    throw err;
  }
}

/**
 * Clear all gallery items from IndexedDB
 */
export async function clearGallery() {
  try {
    const db = await initDB();
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    
    return new Promise((resolve, reject) => {
      const request = store.clear();
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  } catch (err) {
    console.error('Failed to clear gallery:', err);
    throw err;
  }
}

/**
 * Get storage usage statistics
 */
export async function getStorageStats() {
  try {
    const items = await loadGalleryItems();
    const totalSize = items.reduce((sum, item) => sum + (item.size || 0), 0);
    const counts = items.reduce((acc, item) => {
      const category = item.type.startsWith('video/') ? 'video' : 
                     item.type.startsWith('audio/') ? 'audio' : 'image';
      acc[category] = (acc[category] || 0) + 1;
      return acc;
    }, {});
    
    return {
      totalItems: items.length,
      totalSize,
      totalSizeMB: (totalSize / (1024 * 1024)).toFixed(2),
      counts
    };
  } catch (err) {
    console.error('Failed to get storage stats:', err);
    return { totalItems: 0, totalSize: 0, totalSizeMB: '0.00', counts: {} };
  }
}