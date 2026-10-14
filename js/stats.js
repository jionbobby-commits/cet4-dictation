/**
 * stats.js - 学习统计模块
 * 负责：每日记录、累计统计、连续学习天数计算
 */
const Stats = (() => {
  /**
   * 获取今天日期字符串 YYYY-MM-DD
   */
  function todayStr() {
    const d = new Date();
    return formatDate(d);
  }

  /**
   * 格式化日期为 YYYY-MM-DD
   */
  function formatDate(d) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  /**
   * 记录一次听写结果
   * @param {object} result - { total, right, wrong, words: [{en, cn, isRight}] }
   */
  async function recordSession(result) {
    const today = todayStr();
    const words = (result.words || []).map(word => result.taskDate
      ? { ...word, taskDate: result.taskDate }
      : word);

    // 查找今天是否已有记录
    const allRecords = await dbGetByIndex(STORES.records, 'date', today);
    const existing = allRecords[0];

    if (existing) {
      // 累加今天的数据
      existing.total = (existing.total || 0) + result.total;
      existing.right = (existing.right || 0) + result.right;
      existing.wrong = (existing.wrong || 0) + result.wrong;
      // 合并单词列表
      existing.words = existing.words || [];
      existing.words = existing.words.concat(words);
      existing.updatedAt = Date.now();
      await dbPut(STORES.records, existing);
      return existing;
    } else {
      // 新建今天的记录
      const id = await dbAdd(STORES.records, {
        date: today,
        total: result.total,
        right: result.right,
        wrong: result.wrong,
        words,
        createdAt: Date.now()
      });
      return { id, date: today, ...result };
    }
  }

  /**
   * 获取今天的学习记录
   */
  async function getTodayRecord() {
    const today = todayStr();
    const records = await dbGetByIndex(STORES.records, 'date', today);
    return records[0] || { total: 0, right: 0, wrong: 0 };
  }

  /**
   * 获取累计统计
   */
  async function getAllStats() {
    const records = await dbGetAll(STORES.records);

    let total = 0;
    let right = 0;
    let wrong = 0;
    const learnedWords = new Set(); // 去重的已学单词

    records.forEach(r => {
      total += r.total || 0;
      right += r.right || 0;
      wrong += r.wrong || 0;
      // 收集所有学过的单词
      if (r.words) {
        r.words.forEach(w => {
          if (w.en) learnedWords.add(w.en.toLowerCase());
        });
      }
    });

    const acc = total > 0 ? Math.round(right / total * 100) : 0;

    return {
      total,
      right,
      wrong,
      accuracy: acc,
      days: records.length,
      learnedWordsCount: learnedWords.size
    };
  }

  /**
   * 计算连续学习天数
   */
  async function getStreak() {
    const records = await dbGetAll(STORES.records);
    if (!records.length) return 0;

    // 提取所有学习日期，去重并排序
    const dates = [...new Set(records.map(r => r.date))].sort().reverse();

    if (!dates.length) return 0;

    let streak = 0;
    const today = todayStr();

    // 检查今天是否有记录，没有则从昨天开始算
    let checkDate = new Date();
    if (dates[0] !== today) {
      checkDate.setDate(checkDate.getDate() - 1);
    }

    while (true) {
      const dateStr = formatDate(checkDate);
      if (dates.includes(dateStr)) {
        streak++;
        checkDate.setDate(checkDate.getDate() - 1);
      } else {
        break;
      }
    }

    return streak;
  }

  /**
   * 获取最近 N 天的记录
   */
  async function getRecentDays(n = 7) {
    const records = await dbGetAll(STORES.records);

    // 按日期分组
    const map = {};
    records.forEach(r => {
      if (!map[r.date]) map[r.date] = { total: 0, right: 0, wrong: 0 };
      map[r.date].total += r.total || 0;
      map[r.date].right += r.right || 0;
      map[r.date].wrong += r.wrong || 0;
    });

    // 生成最近 n 天的数组
    const result = [];
    for (let i = n - 1; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = formatDate(d);
      const data = map[dateStr] || { total: 0, right: 0, wrong: 0 };
      result.push({ date: dateStr, ...data });
    }

    return result;
  }

  /**
   * 获取最近的学习记录列表（用于首页）
   */
  async function getRecentList(limit = 5) {
    const records = await dbGetAll(STORES.records);
    return records
      .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
      .slice(0, limit);
  }

  /**
   * 获取全部学习记录
   */
  async function getAllRecords() {
    return await dbGetAll(STORES.records);
  }

  return {
    recordSession,
    getTodayRecord,
    getAllStats,
    getStreak,
    getRecentDays,
    getRecentList,
    getAllRecords,
    formatDate
  };
})();
