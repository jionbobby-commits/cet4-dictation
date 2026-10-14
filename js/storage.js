/**
 * storage.js - IndexedDB 本地存储封装
 * 负责：单词表、错题本、学习记录、设置 等数据的持久化
 */
const DB_NAME = 'english_dictation_db';
const DB_VERSION = 1;

// 数据表定义
const STORES = {
  words: 'word_list',        // 单词表 { id, en, cn, phonetic, example, createdAt }
  wrong: 'wrong_list',       // 错题本 { id, en, cn, wrongCount, lastWrongAt }
  records: 'study_records',  // 学习记录 { id, date, total, right, wrong, words: [] }
  settings: 'settings'       // 键值对设置
};

let dbInstance = null;

/**
 * 初始化数据库
 */
function openDB() {
  return new Promise((resolve, reject) => {
    if (dbInstance) return resolve(dbInstance);

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (e) => {
      const db = e.target.result;

      // 单词表
      if (!db.objectStoreNames.contains(STORES.words)) {
        const store = db.createObjectStore(STORES.words, { keyPath: 'id', autoIncrement: true });
        store.createIndex('en', 'en', { unique: true });
      }

      // 错题本
      if (!db.objectStoreNames.contains(STORES.wrong)) {
        db.createObjectStore(STORES.wrong, { keyPath: 'id', autoIncrement: true });
      }

      // 学习记录
      if (!db.objectStoreNames.contains(STORES.records)) {
        const store = db.createObjectStore(STORES.records, { keyPath: 'id', autoIncrement: true });
        store.createIndex('date', 'date', { unique: false });
      }

      // 设置
      if (!db.objectStoreNames.contains(STORES.settings)) {
        db.createObjectStore(STORES.settings, { keyPath: 'key' });
      }
    };

    request.onsuccess = (e) => {
      dbInstance = e.target.result;
      resolve(dbInstance);
    };

    request.onerror = (e) => {
      console.error('IndexedDB 打开失败:', e.target.error);
      reject(e.target.error);
    };
  });
}

/**
 * 通用添加数据
 */
async function dbAdd(storeName, data) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    const store = tx.objectStore(storeName);
    const req = store.add(data);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

/**
 * 通用批量添加
 */
async function dbBulkAdd(storeName, items) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    const store = tx.objectStore(storeName);
    let count = 0;
    items.forEach(item => {
      const req = store.add(item);
      req.onsuccess = () => { count++; };
      req.onerror = () => { /* 忽略重复 */ };
    });
    tx.oncomplete = () => resolve(count);
    tx.onerror = () => reject(tx.error);
  });
}

/**
 * 获取全部数据
 */
async function dbGetAll(storeName) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly');
    const store = tx.objectStore(storeName);
    const req = store.getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  });
}

/**
 * 按 ID 获取单条
 */
async function dbGetById(storeName, id) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly');
    const store = tx.objectStore(storeName);
    const req = store.get(id);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

/**
 * 更新数据
 */
async function dbPut(storeName, data) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    const store = tx.objectStore(storeName);
    const req = store.put(data);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

/**
 * 按 ID 删除
 */
async function dbDelete(storeName, id) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    const store = tx.objectStore(storeName);
    const req = store.delete(id);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

/**
 * 清空表
 */
async function dbClear(storeName) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    const store = tx.objectStore(storeName);
    const req = store.clear();
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

/**
 * 按索引查询
 */
async function dbGetByIndex(storeName, indexName, value) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly');
    const store = tx.objectStore(storeName);
    const index = store.index(indexName);
    const req = index.getAll(value);
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  });
}

// ========== 设置项的便捷方法 ==========
async function getSetting(key, defaultValue = null) {
  const db = await openDB();
  return new Promise((resolve) => {
    const tx = db.transaction(STORES.settings, 'readonly');
    const store = tx.objectStore(STORES.settings);
    const req = store.get(key);
    req.onsuccess = () => resolve(req.result ? req.result.value : defaultValue);
    req.onerror = () => resolve(defaultValue);
  });
}

async function setSetting(key, value) {
  return dbPut(STORES.settings, { key, value });
}
