/** Shared calendar and word-allocation rules for the learning plan. */
const PlanEngine = (() => {
  const DAY_MS = 24 * 60 * 60 * 1000;

  function parseLocalDate(value) {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value || ''));
    if (!match) throw new TypeError(`Invalid date: ${value}`);
    const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
    if (date.getFullYear() !== Number(match[1]) || date.getMonth() !== Number(match[2]) - 1 || date.getDate() !== Number(match[3])) {
      throw new TypeError(`Invalid date: ${value}`);
    }
    return date;
  }

  function formatLocalDate(date) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  }

  function getPlanDeadline(startDate) {
    const start = parseLocalDate(startDate);
    const year = start.getFullYear();
    const month = start.getMonth() + 1;
    const day = start.getDate();
    if (month < 6 || (month === 6 && day <= 10)) return `${year}-06-10`;
    if (month < 9 || (month === 9 && day <= 10)) return `${year}-09-10`;
    return `${year + 1}-06-10`;
  }

  function getStudyCalendar(startDate, deadline) {
    const start = parseLocalDate(startDate);
    const end = parseLocalDate(deadline);
    if (start > end) throw new RangeError('Start date must not be after deadline');
    const days = [];
    for (let date = new Date(start); date <= end; date.setDate(date.getDate() + 1)) {
      const dayOffset = Math.round((Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) - Date.UTC(start.getFullYear(), start.getMonth(), start.getDate())) / DAY_MS);
      const isStudyDay = dayOffset % 7 < 6;
      days.push({
        date: formatLocalDate(date),
        dayNum: dayOffset + 1,
        studyDayNum: isStudyDay ? Math.floor(dayOffset / 7) * 6 + Math.min(dayOffset % 7, 6) + 1 : null,
        isStudyDay,
        isRestDay: !isStudyDay,
        wordCount: 0,
        words: []
      });
    }
    return days;
  }

  function distributeWords(words, studyDays) {
    const totalWords = words.length;
    const baseCount = studyDays.length ? Math.floor(totalWords / studyDays.length) : 0;
    const remainder = studyDays.length ? totalWords % studyDays.length : 0;
    let offset = 0;
    return studyDays.map((day, index) => {
      const count = baseCount + (index < remainder ? 1 : 0);
      const assigned = words.slice(offset, offset + count);
      offset += count;
      return { ...day, words: assigned, wordCount: assigned.length };
    });
  }

  function hashPlan(startDate, deadline, words) {
    const source = JSON.stringify([startDate, deadline, words.map(word => [word.en, word.cn, word.phonetic || '', word.example || ''])]);
    let hash = 2166136261;
    for (let i = 0; i < source.length; i++) {
      hash ^= source.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }
    return `plan-v2-${(hash >>> 0).toString(16)}`;
  }

  // Copy every source entry in its existing order. Words.addWord/import paths already reject case-insensitive duplicates; any legacy duplicate records are preserved here.
  function generateLearningPlan(config) {
    const startDate = config.startDate;
    const deadline = getPlanDeadline(startDate);
    const words = Array.from(config.words || [], word => ({ ...word }));
    const calendar = getStudyCalendar(startDate, deadline);
    const studyDays = calendar.filter(day => day.isStudyDay);
    const allocatedStudyDays = distributeWords(words, studyDays);
    let studyIndex = 0;
    const planId = hashPlan(startDate, deadline, words);
    const plan = calendar.map(day => {
      if (day.isRestDay) {
        return { ...day, planId, task: '休息日：无需完成新的计划单词。', review: '', duration: 0, taskStatus: null };
      }
      const allocated = allocatedStudyDays[studyIndex++];
      return {
        ...allocated,
        planId,
        task: `学习今日分配的 ${allocated.wordCount} 个 CET-4 单词，并完成听写。`,
        review: '',
        duration: 15,
        taskStatus: null
      };
    });
    return { startDate, deadline, totalWords: words.length, studyDayCount: studyDays.length, planId, days: plan };
  }

  function syncDictationDates(plan) {
    return plan.days.map(day => ({
      date: day.date,
      dayNum: day.dayNum,
      wordCount: day.wordCount,
      isStudyDay: day.isStudyDay,
      isRestDay: day.isRestDay,
      planId: day.planId
    }));
  }

  return { parseLocalDate, formatLocalDate, getPlanDeadline, getStudyCalendar, distributeWords, generateLearningPlan, syncDictationDates };
})();

if (typeof module !== 'undefined' && module.exports) module.exports = PlanEngine;
