/**
 * words.js - 单词数据管理
 * 负责：单词 CRUD、CSV/TXT 导入导出、错词管理
 */
const Words = (() => {
  let wordList = [];      // 当前单词缓存
  let wrongList = [];     // 错词缓存

  /**
   * 从数据库加载全部单词
   */
  async function loadAll() {
    wordList = await dbGetAll(STORES.words);
    wrongList = await dbGetAll(STORES.wrong);
    return { words: wordList, wrong: wrongList };
  }

  /**
   * 获取全部单词
   */
  function getAll() {
    return wordList;
  }

  /**
   * 获取错题列表
   */
  function getWrong() {
    return wrongList;
  }

  /**
   * 添加单个单词
   */
  async function addWord(en, cn, phonetic = '', example = '') {
    en = (en || '').trim().toLowerCase();
    if (!en) return null;

    // 检查重复
    const exist = wordList.find(w => w.en === en);
    if (exist) {
      showToast('该单词已存在');
      return null;
    }

    const id = await dbAdd(STORES.words, {
      en,
      cn: (cn || '').trim(),
      phonetic: (phonetic || '').trim(),
      example: (example || '').trim(),
      createdAt: Date.now()
    });

    wordList.push({ id, en, cn, phonetic, example });
    return id;
  }

  /**
   * 删除单词
   */
  async function removeWord(id) {
    await dbDelete(STORES.words, id);
    wordList = wordList.filter(w => w.id !== id);
  }

  /**
   * 更新单词
   */
  async function updateWord(id, data) {
    const word = wordList.find(w => w.id === id);
    if (!word) return false;
    const en = (data.en ?? word.en).trim().toLowerCase();
    if (!en || wordList.some(item => item.id !== id && item.en.toLowerCase() === en)) return false;
    const updated = {
      ...word,
      ...data,
      en,
      cn: (data.cn ?? word.cn).trim(),
      phonetic: (data.phonetic ?? word.phonetic ?? '').trim(),
      example: (data.example ?? word.example ?? '').trim()
    };
    await dbPut(STORES.words, updated);
    Object.assign(word, updated);
    return true;
  }

  /**
   * 记录错题
   */
  async function addWrong(word) {
    if (!word || !word.en) return;

    // 检查是否已在错题本
    const exist = wrongList.find(w => w.en === word.en);
    if (exist) {
      exist.wrongCount = (exist.wrongCount || 1) + 1;
      exist.lastWrongAt = Date.now();
      await dbPut(STORES.wrong, exist);
    } else {
      await dbAdd(STORES.wrong, {
        en: word.en,
        cn: word.cn,
        phonetic: word.phonetic || '',
        wrongCount: 1,
        lastWrongAt: Date.now()
      });
    }

    // 刷新缓存
    wrongList = await dbGetAll(STORES.wrong);
  }

  /**
   * 从错题本移除（答对后调用）
   */
  async function removeWrong(en) {
    const wrong = wrongList.find(w => w.en === en);
    if (wrong) {
      await dbDelete(STORES.wrong, wrong.id);
      wrongList = wrongList.filter(w => w.en !== en);
    }
  }

  /**
   * 清空错题本
   */
  async function clearWrong() {
    await dbClear(STORES.wrong);
    wrongList = [];
  }

  /**
   * 解析 CSV / TXT 文本为单词数组
   * 格式：每行一个，用逗号或 Tab 分隔
   * 第1列：英文，第2列：中文，第3列：音标(可选)，第4列：例句(可选)
   */
  function parseText(text) {
    const lines = text.split(/\r?\n/);
    const result = [];
    let skipped = 0;

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      // 支持逗号、Tab、中文逗号分隔
      const parts = trimmed.split(/[,，\t]/).map(s => s.trim());
      if (parts.length < 2) {
        skipped++;
        continue;
      }

      const en = parts[0].toLowerCase();
      const cn = parts[1];
      const phonetic = parts[2] || '';
      const example = parts[3] || '';

      if (en && cn) {
        result.push({ en, cn, phonetic, example });
      } else {
        skipped++;
      }
    }

    return { words: result, skipped };
  }

  /**
   * 批量导入单词
   */
  async function importFromText(text) {
    const { words, skipped } = parseText(text);

    let added = 0;
    let dup = 0;

    for (const w of words) {
      const exist = wordList.find(x => x.en === w.en);
      if (exist) {
        dup++;
        continue;
      }
      await addWord(w.en, w.cn, w.phonetic, w.example);
      added++;
    }

    return { added, dup, skipped };
  }

  /**
   * 导出为 CSV 文本
   */
  function exportToCSV() {
    const header = '英文,中文释义,音标,例句\n';
    const rows = wordList.map(w =>
      `${w.en},${w.cn},${w.phonetic || ''},${w.example || ''}`
    ).join('\n');
    return '﻿' + header + rows; // BOM 头确保 Excel 识别 UTF-8
  }

  /**
   * 导出全部数据为 JSON
   */
  function exportAllJSON() {
    return JSON.stringify({
      words: wordList,
      wrong: wrongList,
      exportAt: new Date().toISOString()
    }, null, 2);
  }

  /**
   * 加载内置示例单词
   */
  async function loadSample() {
    const sampleWords = [
      ['abandon', 'v. 放弃，抛弃'],
      ['ability', 'n. 能力，才能'],
      ['absence', 'n. 缺席，不在'],
      ['absolute', 'adj. 绝对的，完全的'],
      ['absorb', 'v. 吸收，吸引'],
      ['abstract', 'adj. 抽象的 n. 摘要'],
      ['academic', 'adj. 学术的，学院的'],
      ['accept', 'v. 接受，认可'],
      ['access', 'n. 通道，入口 v. 访问'],
      ['accident', 'n. 事故，意外'],
      ['account', 'n. 账户，解释'],
      ['accurate', 'adj. 准确的，精确的'],
      ['achieve', 'v. 实现，达到'],
      ['acquire', 'v. 获得，取得'],
      ['active', 'adj. 积极的，活跃的']
    ];

    for (const [en, cn] of sampleWords) {
      await addWord(en, cn);
    }
  }

  /**
   * 从数组中随机取 n 个
   */
  function pickRandom(arr, n) {
    const shuffled = [...arr].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, Math.min(n, arr.length));
  }

  /**
   * 按顺序取 n 个
   */
  function pickOrder(arr, n, offset = 0) {
    return arr.slice(offset, offset + n);
  }

  return {
    loadAll,
    getAll,
    getWrong,
    addWord,
    removeWord,
    updateWord,
    addWrong,
    removeWrong,
    clearWrong,
    importFromText,
    exportToCSV,
    exportAllJSON,
    loadSample,
    pickRandom,
    pickOrder
  };
})();
