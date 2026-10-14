/**
 * app.js - 主应用逻辑
 * 负责：标签切换、听写流程、自动批改、UI 交互
 */

// ========== 每日计划模块（简化版） ==========
const DailyPlan = (() => {
  let todayWords = [];
  let allPlans = [];
  let todayDayNum = -1;

  function getTodayStr() {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  // 格式化日期显示：2026-10-14 → 10/14
  function formatDateShort(dateStr) {
    const parts = dateStr.split('-');
    return `${parts[1]}/${parts[2]}`;
  }

  function load() {
    try {
      if (typeof DAILY_PLAN_DATA === 'undefined') {
        console.warn('每日计划数据未加载');
        return;
      }
      
      allPlans = DAILY_PLAN_DATA;
      const today = getTodayStr();
      const todayPlan = allPlans.find(d => d.date === today);

      if (todayPlan) {
        todayWords = todayPlan.words;
        todayDayNum = todayPlan.dayNum;
      }

      // 初始化听写设置里的日期选择器
      initDatePicker();

      // 初始化日期范围选择器
      initDateRangePicker();

      // 恢复用户的口音设置
      initAccentSettings();

      // 更新首页的天数和日期显示
      updateHomeDisplay();

      // 渲染计划页面列表
      renderPlanList();

    } catch (e) {
      console.warn('每日计划加载失败:', e);
    }
  }

  // 初始化口音设置：从 localStorage 恢复，并绑定保存事件
  function initAccentSettings() {
    // 英文口音
    const enAccent = document.getElementById('selAccent');
    if (enAccent) {
      const savedEn = localStorage.getItem('enAccent');
      if (savedEn) enAccent.value = savedEn;
      enAccent.addEventListener('change', () => {
        localStorage.setItem('enAccent', enAccent.value);
      });
    }
    
    // 中文口音
    const cnAccent = document.getElementById('selChineseAccent');
    if (cnAccent) {
      const savedCn = localStorage.getItem('cnAccent');
      if (savedCn) cnAccent.value = savedCn;
      cnAccent.addEventListener('change', () => {
        localStorage.setItem('cnAccent', cnAccent.value);
      });
    }
  }

  // 初始化听写设置里的日期下拉框
  function initDatePicker() {
    const datePicker = document.getElementById('selDailyDate');
    if (!datePicker) return;

    datePicker.innerHTML = '';
    let selectedValue = '';

    for (let i = 0; i < allPlans.length; i++) {
      const plan = allPlans[i];
      const opt = document.createElement('option');
      opt.value = plan.date;
      opt.textContent = `第${plan.dayNum}天 · ${formatDateShort(plan.date)}（${plan.wordCount}词）`;
      
      // 默认选中今天
      if (todayDayNum === plan.dayNum) {
        opt.selected = true;
        selectedValue = plan.date;
      }
      
      datePicker.appendChild(opt);
    }

    // 如果今天不在计划里，默认选第一天
    if (!selectedValue && allPlans.length > 0) {
      datePicker.value = allPlans[0].date;
    }
  }

  // 获取用户自定义状态（从 localStorage 读取）
  function getUserStatus(dateStr) {
    try {
      const saved = localStorage.getItem('planTaskStatus');
      if (saved) {
        const obj = JSON.parse(saved);
        return obj[dateStr] || null;
      }
    } catch (e) {
      console.warn('读取用户状态失败:', e);
    }
    return null;
  }

  // 保存用户自定义状态到 localStorage
  function saveUserStatus(dateStr, status) {
    try {
      const saved = localStorage.getItem('planTaskStatus');
      const obj = saved ? JSON.parse(saved) : {};
      obj[dateStr] = status;
      localStorage.setItem('planTaskStatus', JSON.stringify(obj));
    } catch (e) {
      console.warn('保存用户状态失败:', e);
    }
  }

  // 根据日期自动计算默认状态
  function getAutoStatus(plan) {
    const today = getTodayStr();
    const planDate = plan.date;
    
    // 已完成的任务始终保留已完成状态
    if (plan.taskStatus === '✓' || plan.taskStatus === 'done') {
      return 'done';
    }
    
    // 未来日期：未标记
    if (planDate > today) {
      return 'unmarked';
    }
    // 今天：未标记
    else if (planDate === today) {
      return 'unmarked';
    }
    // 过去日期，未完成：补做
    else {
      return 'redo';
    }
  }

  // 获取当前日期的有效状态（用户修改优先，其次自动计算的默认状态）
  function getEffectiveStatus(plan) {
    const userStatus = getUserStatus(plan.date);
    if (userStatus) {
      return userStatus;
    }
    // 如果 Excel 原始状态是已完成，保留；否则根据日期自动计算
    if (plan.taskStatus === '✓') {
      return 'done';
    }
    return getAutoStatus(plan);
  }

  // 获取用户设置的日期范围
  function getDateRange() {
    let start = localStorage.getItem('planStartDate');
    let end = localStorage.getItem('planEndDate');
    
    // 默认值：Excel 的第一天和最后一天
    if (!start && allPlans.length > 0) {
      start = allPlans[0].date;
    }
    if (!end && allPlans.length > 0) {
      end = allPlans[allPlans.length - 1].date;
    }
    
    return { start, end };
  }

  // 初始化日期范围选择器
  function initDateRangePicker() {
    const startInput = document.getElementById('planStartDate');
    const endInput = document.getElementById('planEndDate');
    if (!startInput || !endInput) return;
    
    const { start, end } = getDateRange();
    startInput.value = start;
    endInput.value = end;
    
    // 监听变化
    startInput.addEventListener('change', () => {
      if (startInput.value > endInput.value) {
        alert('起始日期不能晚于结束日期');
        startInput.value = getDateRange().start;
        return;
      }
      localStorage.setItem('planStartDate', startInput.value);
      renderPlanList();
    });
    
    endInput.addEventListener('change', () => {
      if (endInput.value < startInput.value) {
        alert('结束日期不能早于起始日期');
        endInput.value = getDateRange().end;
        return;
      }
      localStorage.setItem('planEndDate', endInput.value);
      renderPlanList();
    });
  }

  // 渲染计划页面列表
  function renderPlanList() {
    const listEl = document.getElementById('planList');
    if (!listEl) return;

    const today = getTodayStr();

    // 根据日期范围过滤
    const { start, end } = getDateRange();
    const filteredPlans = allPlans.filter(p => p.date >= start && p.date <= end);

    // 统计完成情况
    const fragment = document.createDocumentFragment();
    filteredPlans.forEach(plan => {
      const card = document.createElement('article');
      card.className = 'plan-day-card';
      if (plan.date === today) {
        card.classList.add('today');
        card.setAttribute('aria-current', 'date');
      }
      
      // 获取有效状态
      const status = getEffectiveStatus(plan);
      const statusInfo = getStatusPresentation(status);
      
      card.innerHTML = `
        ${createStatusBadge(status, true)}
        <button type="button" class="plan-day-open" aria-label="第 ${plan.dayNum} 天，${formatDateShort(plan.date)}，${statusInfo.label}，${plan.wordCount} 个单词。开始听写。">
          <div class="plan-day-num">第 ${plan.dayNum} 天</div>
          <div class="plan-day-date">${formatDateShort(plan.date)}</div>
          <div class="plan-day-words">${plan.wordCount} 个单词</div>
        </button>
      `;

      // 点击状态标签，弹出菜单修改状态
      bindStatusBadge(card.querySelector('.plan-status-badge'), plan.date, card);

      // 点击卡片跳转到听写页面并开始当天听写
      card.querySelector('.plan-day-open').addEventListener('click', () => startDictationForDate(plan.date));

      fragment.appendChild(card);
    });

    listEl.replaceChildren(fragment);

    // 更新统计数据
    updatePlanStats(summarizePlans(filteredPlans));
  }

  function getStatusPresentation(status) {
    if (status === '✓' || status === 'done') return { key: 'done', label: '已完成', icon: '<path d="m5 12 4 4L19 6"/>' };
    if (status === 'redo') return { key: 'redo', label: '补学', icon: '<path d="M20 7v5h-5M20 12a8 8 0 1 1-2.3-5.6L20 9"/>' };
    if (status === 'unmarked') return { key: 'unmarked', label: '未标记', icon: '<circle cx="12" cy="12" r="8"/><path d="M9 12h6"/>' };
    return { key: 'todo', label: '待学习', icon: '<circle cx="12" cy="12" r="8"/>' };
  }

  function createStatusBadge(status, interactive = false) {
    const info = getStatusPresentation(status);
    const tag = interactive ? 'button type="button"' : 'span';
    const aria = interactive ? `aria-label="${info.label}，点击切换状态"` : '';
    return `<${tag} class="${interactive ? 'plan-status-badge' : 'task-status-badge'} status-${info.key}" ${aria}><svg class="status-icon" viewBox="0 0 24 24" aria-hidden="true">${info.icon}</svg><span>${info.label}</span></${interactive ? 'button' : 'span'}>`;
  }

  function bindStatusBadge(badge, dateStr, card) {
    if (!badge) return;
    badge.addEventListener('click', event => {
      event.stopPropagation();
      cycleStatus(dateStr, card);
    });
  }

  function summarizePlans(plans) {
    return summarizePlanStatuses(plans, getEffectiveStatus);
  }

  // 循环切换状态：已完成 → 未完成 → 补做 → 未标记 → 已完成
  function cycleStatus(dateStr, cardEl) {
    const current = getEffectiveStatus({ date: dateStr });
    let next;
    if (current === '✓' || current === 'done') {
      next = 'todo';
    } else if (current === 'todo' || current === '□' || current === '✗') {
      next = 'redo';
    } else if (current === 'redo') {
      next = 'unmarked';
    } else {
      next = 'done';
    }
    
    saveUserStatus(dateStr, next);

    // 更新本张卡片和汇总，避免整组日期卡片重排或闪烁。
    const badge = cardEl.querySelector('.plan-status-badge');
    if (badge) {
      badge.outerHTML = createStatusBadge(next, true);
      bindStatusBadge(cardEl.querySelector('.plan-status-badge'), dateStr, cardEl);
    }
    const plan = allPlans.find(item => item.date === dateStr);
    if (plan) {
      const info = getStatusPresentation(next);
      const openButton = cardEl.querySelector('.plan-day-open');
      if (openButton) openButton.setAttribute('aria-label', `第 ${plan.dayNum} 天，${formatDateShort(plan.date)}，${info.label}，${plan.wordCount} 个单词。开始听写。`);
      const { start, end } = getDateRange();
      const filteredPlans = allPlans.filter(item => item.date >= start && item.date <= end);
      updatePlanStats(summarizePlans(filteredPlans));
    }
    cardEl.classList.remove('state-updated');
    void cardEl.offsetWidth;
    cardEl.classList.add('state-updated');
    setTimeout(() => cardEl.classList.remove('state-updated'), 420);
    refreshHome();
  }

  // 更新计划页面统计数据
  function updatePlanStats(summary) {
    setMetricText('statTotalDays', summary.total);
    setMetricText('statDoneDays', summary.done);
    setMetricText('statDoneSummary', summary.done);
    setMetricText('statTodoDays', summary.todo);
    setMetricText('statRedoDays', summary.redo);
    setMetricText('statUnmarkedDays', summary.unmarked);
    setMetricText('planProgress', summary.progress + '%');
    setProgressValue('planProgressBar', summary.progress);
  }

  // 更新首页的天数和日期显示
  function updateHomeDisplay() {
    const today = getTodayStr();
    const todayPlan = allPlans.find(d => d.date === today);
    
    const dateEl = document.getElementById('homeTodayDate');
    const dayNumEl = document.getElementById('homeTodayDay');
    const taskListEl = document.getElementById('homeTaskList');
    
    if (todayPlan) {
      dateEl.textContent = formatDateShort(todayPlan.date);
      dayNumEl.textContent = `第 ${todayPlan.dayNum} 天`;
      
      // 渲染今日学习任务列表
      const statusHtml = createStatusBadge(getEffectiveStatus(todayPlan));
      
      taskListEl.innerHTML = `
        <div class="task-item">
          <div class="task-header">
            <span class="task-title">今日学习任务</span>
            ${statusHtml}
          </div>
          <div class="task-content">${todayPlan.task}</div>
          ${todayPlan.review && todayPlan.review !== '（今天是第一批，无需复习旧词）' ? `<div class="task-review">复习安排：${todayPlan.review}</div>` : ''}
          <div class="task-meta">建议时长：${todayPlan.duration} 分钟 | 新词：${todayPlan.wordCount} 个</div>
        </div>
      `;
    } else {
      // 判断是早于开始日期还是晚于结束日期
      const firstDate = allPlans[0]?.date;
      const lastDate = allPlans[allPlans.length - 1]?.date;
      
      dayNumEl.textContent = '计划未开始';
      dateEl.textContent = '--';
      
      if (today < firstDate) {
        taskListEl.innerHTML = `<div class="task-item"><div class="task-content">学习计划尚未开始<br>计划开始日期：${firstDate}</div></div>`;
      } else if (today > lastDate) {
        taskListEl.innerHTML = `<div class="task-item"><div class="task-content">学习计划已结束<br>计划结束日期：${lastDate}<br>你可以查看历史计划进行复习</div></div>`;
      }
    }
  }

  // 根据日期直接开始听写（统一入口）
  function startDictationForDate(dateStr) {
    // 切换到听写 tab
    document.querySelector('[data-tab="dictation"]').click();
    
    // 设置日期选择
    const datePicker = document.getElementById('selDailyDate');
    if (datePicker) datePicker.value = dateStr;
    
    // 自动开始听写
    document.getElementById('btnBegin').click();
  }

  function getTodayWords() {
    return todayWords;
  }

  function getWordsByDay(dayNum) {
    if (dayNum === -1) return todayWords;
    const plan = allPlans.find(p => p.dayNum === dayNum);
    return plan ? plan.words : [];
  }

  // 根据日期获取单词
  function getWordsByDate(dateStr) {
    const plan = allPlans.find(p => p.date === dateStr);
    return plan ? plan.words : [];
  }

  // 根据日期获取天数信息
  function getDayInfoByDate(dateStr) {
    const plan = allPlans.find(p => p.date === dateStr);
    return plan ? { dayNum: plan.dayNum, date: plan.date, wordCount: plan.wordCount } : null;
  }

  return { load, getTodayWords, getWordsByDay, getWordsByDate, getDayInfoByDate, formatDateShort, startDictationForDate, getEffectiveStatus, getAllPlans: () => allPlans, summarizeAllPlans: () => summarizePlans(allPlans) };
})();

function setMetricText(id, value) {
  const element = document.getElementById(id);
  if (!element) return;
  const next = String(value);
  if (element.textContent === next) return;
  element.textContent = next;
  element.classList.remove('metric-changed');
  void element.offsetWidth;
  element.classList.add('metric-changed');
  setTimeout(() => element.classList.remove('metric-changed'), 320);
}

function setProgressValue(id, value) {
  const element = document.getElementById(id);
  if (!element) return;
  const progress = Math.max(0, Math.min(100, Number(value) || 0));
  element.setAttribute('aria-valuenow', String(progress));
  const fill = element.querySelector('.progress-fill');
  if (!fill) return;
  if (fill.dataset.ready === 'true') {
    fill.style.width = progress + '%';
    return;
  }
  fill.style.transition = 'none';
  fill.style.width = progress + '%';
  fill.dataset.ready = 'true';
  requestAnimationFrame(() => requestAnimationFrame(() => {
    fill.style.transition = '';
  }));
}

function setDictationProgress(value) {
  const progress = Math.max(0, Math.min(100, Number(value) || 0));
  const bar = document.getElementById('dictationProgressBar');
  const fill = document.getElementById('dictationProgressFill');
  if (!bar || !fill) return;
  bar.setAttribute('aria-valuenow', String(progress));
  bar.setAttribute('aria-valuetext', `${Math.round(progress)}% 完成`);
  fill.style.width = `${progress}%`;
  bar.style.setProperty('--progress-value', `${progress}%`);
  bar.classList.toggle('is-zero', progress === 0);
  bar.classList.toggle('is-complete', progress === 100);
  const percent = `${Math.round(progress)}%`;
  const trailing = document.getElementById('progressPercentTrailing');
  if (trailing) trailing.textContent = percent;
}

function setOperationStatus(id, message, kind = 'info', progress = null) {
  const status = document.getElementById(id);
  if (!status) return;
  const clampedProgress = Math.max(0, Math.min(100, progress));
  const currentTrack = status.querySelector('.progress-track-operation');
  if (message && kind === 'loading' && Number.isFinite(progress) && status.dataset.state === 'loading' && currentTrack) {
    currentTrack.setAttribute('aria-label', message);
    currentTrack.setAttribute('aria-valuenow', String(clampedProgress));
    currentTrack.querySelector('.progress-fill').style.width = `${clampedProgress}%`;
    const label = status.querySelector('.operation-status-label');
    if (label) label.textContent = message;
    return;
  }
  status.replaceChildren();
  status.className = `${id === 'speechPlaybackStatus' ? 'speech-status ' : ''}operation-status${kind === 'loading' ? ' is-loading' : ''}${kind === 'error' ? ' is-error' : ''}${kind === 'success' ? ' is-success' : ''}`;
  status.dataset.state = kind;
  status.hidden = !message;
  if (!message) return;

  if (kind === 'loading') {
    if (Number.isFinite(progress)) {
      const track = document.createElement('div');
      track.className = 'progress-track progress-track-operation';
      track.setAttribute('role', 'progressbar');
      track.setAttribute('aria-label', message);
      track.setAttribute('aria-valuemin', '0');
      track.setAttribute('aria-valuemax', '100');
      track.setAttribute('aria-valuenow', String(clampedProgress));
      const fill = document.createElement('span');
      fill.className = 'progress-fill';
      fill.style.width = `${clampedProgress}%`;
      track.append(fill);
      status.append(track);
    } else {
      const spinner = document.createElement('span');
      spinner.className = 'm3-spinner';
      spinner.setAttribute('aria-hidden', 'true');
      status.append(spinner);
    }
  }
  const label = document.createElement('span');
  label.className = 'operation-status-label';
  label.textContent = message;
  status.append(label);
}

// ========== 听写模式配置 ==========
const MODE_CONFIG = {
  listen2cn: {
    name: '听中文写英文',
    playType: 'cn',        // 播放什么：en=英文, cn=中文, none=不播放
    answerType: 'en',      // 答案类型：en=英文, cn=中文
    showPrompt: false,     // 是否显示提示
    promptText: '听中文释义，写出英文单词',
    pickRandom: false      // 单词选取方式
  },
  listen2en: {
    name: '听英文写英文',
    playType: 'en',
    answerType: 'en',
    showPrompt: false,
    promptText: '听发音，写出英文单词',
    pickRandom: false
  },
  listen2cn_random: {
    name: '听中文写英文（随机）',
    playType: 'cn',
    answerType: 'en',
    showPrompt: false,
    promptText: '听中文释义，写出英文单词',
    pickRandom: true
  },
  listen2en_random: {
    name: '听英文写英文（随机）',
    playType: 'en',
    answerType: 'en',
    showPrompt: false,
    promptText: '听发音，写出英文单词',
    pickRandom: true
  }
};

// 工具函数：随机打乱数组
function shuffleArray(arr) {
  const result = [...arr];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

// ========== 全局状态 ==========
const state = {
  currentTab: 'home',
  dictation: {
    active: false,
    wordList: [],
    index: 0,
    mode: 'listen2en',
    playTimes: 2,
    total: 0,
    right: 0,
    wrong: 0,
    currentWord: null,
    submitted: false,
    answeredList: []
  }
};

let speechPlayToken = 0;

// ========== 工具函数 ==========

/**
 * 显示 Toast 提示
 */
function showToast(msg, duration = 2000) {
  const toast = document.getElementById('toast');
  toast.textContent = msg;
  toast.classList.remove('hidden');
  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => toast.classList.add('hidden'), duration);
}

/**
 * 切换标签页
 */
function switchTab(tabName) {
  if (tabName !== 'dictation') stopSpeechPlayback();
  state.currentTab = tabName;

  // 更新按钮状态
  document.querySelectorAll('.sidebar-item, .tab-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tab === tabName);
  });

  // 更新面板显示
  document.querySelectorAll('.tab-panel').forEach(panel => {
    panel.classList.toggle('active', panel.id === `tab-${tabName}`);
  });

  // 刷新对应页面的数据
  if (tabName === 'home') refreshHome();
  if (tabName === 'wrong') refreshWrongList();
  if (tabName === 'words') refreshWordList();
  if (tabName === 'stats') refreshStats();
}

// ========== 首页 / 统计刷新 ==========

async function refreshHome() {
  const queryId = (refreshHome.queryId || 0) + 1;
  refreshHome.queryId = queryId;
  setOperationStatus('homeQueryStatus', '正在查询学习数据', 'loading');
  try {
  const today = await Stats.getTodayRecord();
  const streak = await Stats.getStreak();
  const wrongList = Words.getWrong();
  const recent = await Stats.getRecentList(5);

  const plans = DailyPlan.getAllPlans();
  const todayDate = Stats.formatDate(new Date());
  const todayPlan = plans.find(plan => plan.date === todayDate);
  const records = await Stats.getAllRecords();
  if (queryId !== refreshHome.queryId) return;
  setMetricText('statTodayPlan', todayPlan?.wordCount || 0);
  setMetricText('statTodayDone', today.total || 0);
  setMetricText('statTodayAcc', today.total > 0 ? Math.round(today.right / today.total * 100) + '%' : '--');
  const learnedWordsTotal = calculatePlanWordsLearned(plans, records, plan => DailyPlan.getEffectiveStatus(plan));
  setMetricText('statTotalWords', learnedWordsTotal);
  setMetricText('statWrongCount', wrongList.length);
  setMetricText('statStreak', streak + ' 天');
  setMetricText('homeWrongCount', wrongList.length);

  const planSummary = DailyPlan.summarizeAllPlans();
  setMetricText('homePlanProgress', planSummary.progress + '%');
  setMetricText('homePlanDoneCount', planSummary.done);
  setMetricText('homePlanTotalCount', planSummary.total);
  setMetricText('homePlanRemaining', `${Math.max(0, planSummary.total - planSummary.done)} 项尚未完成`);
  setProgressValue('homePlanProgressBar', planSummary.progress);
  const ring = document.getElementById('homePlanProgressRing');
  if (ring) {
    ring.setAttribute('aria-valuenow', String(planSummary.progress));
    const ringFill = ring.querySelector('.progress-ring-fill');
    if (ringFill) {
      const offset = String(125.66 * (1 - planSummary.progress / 100));
      if (ringFill.dataset.ready === 'true') ringFill.style.strokeDashoffset = offset;
      else {
        ringFill.style.transition = 'none';
        ringFill.style.strokeDashoffset = offset;
        ringFill.dataset.ready = 'true';
        requestAnimationFrame(() => requestAnimationFrame(() => { ringFill.style.transition = ''; }));
      }
    }
  }

  const todayProgressText = todayPlan && todayPlan.wordCount > 0
    ? `${today.total || 0} 词 · 计划 ${todayPlan.wordCount} 词`
    : '暂无今日词数目标';
  const todayProgress = todayPlan && todayPlan.wordCount > 0
    ? Math.min(100, Math.round((today.total || 0) / todayPlan.wordCount * 100))
    : 0;
  setMetricText('homeTodayProgressText', todayProgressText);
  setProgressValue('homeTodayProgressBar', todayProgress);

  // 最近记录
  const recentList = document.getElementById('recentList');
  if (!recent.length) {
    recentList.innerHTML = '<li class="empty-tip">暂无记录，开始第一次听写吧</li>';
  } else {
    recentList.innerHTML = recent.map(r => {
      const acc = r.total > 0 ? Math.round(r.right / r.total * 100) + '%' : '--';
      return `<li class="recent-session-card"><span class="recent-session-date">${r.date}</span><span class="recent-session-result">完成 ${r.total} 词</span><span class="session-caption">正确率 ${acc}</span></li>`;
    }).join('');
  }
  if (queryId === refreshHome.queryId) {
    setOperationStatus('homeQueryStatus', '学习数据已更新', 'success');
    setTimeout(() => {
      if (queryId === refreshHome.queryId) setOperationStatus('homeQueryStatus', '', 'info');
    }, 1400);
  }
  } catch (error) {
    console.error('查询首页数据失败:', error);
    if (queryId === refreshHome.queryId) setOperationStatus('homeQueryStatus', '数据查询失败，请刷新后重试', 'error');
  }
}

async function refreshStats() {
  const queryId = (refreshStats.queryId || 0) + 1;
  refreshStats.queryId = queryId;
  setOperationStatus('statsQueryStatus', '正在查询统计数据', 'loading');
  try {
  const allStats = await Stats.getAllStats();
  const streak = await Stats.getStreak();
  const week = await Stats.getRecentDays(7);

  const plans = DailyPlan.getAllPlans();
  const records = await Stats.getAllRecords();
  if (queryId !== refreshStats.queryId) return;
  const learnedWordsTotal = calculatePlanWordsLearned(plans, records, plan => DailyPlan.getEffectiveStatus(plan));

  document.getElementById('statAllTotal').textContent = learnedWordsTotal;
  document.getElementById('statAllRight').textContent = allStats.right;
  document.getElementById('statAllWrong').textContent = allStats.wrong;
  document.getElementById('statAllAcc').textContent = allStats.accuracy + '%';
  document.getElementById('statAllStreak').textContent = streak + ' 天';

  const weekList = document.getElementById('weekList');
  weekList.innerHTML = week.map(r => {
    const acc = r.total > 0 ? Math.round(r.right / r.total * 100) + '%' : '--';
    return `<li>${r.date}：完成 ${r.total} 词，正确 ${r.right}，错误 ${r.wrong}，正确率 ${acc}</li>`;
  }).join('');
  if (queryId === refreshStats.queryId) {
    setOperationStatus('statsQueryStatus', '统计数据已更新', 'success');
    setTimeout(() => {
      if (queryId === refreshStats.queryId) setOperationStatus('statsQueryStatus', '', 'info');
    }, 1400);
  }
  } catch (error) {
    console.error('查询统计数据失败:', error);
    if (queryId === refreshStats.queryId) setOperationStatus('statsQueryStatus', '统计查询失败，请刷新后重试', 'error');
  }
}

// ========== 错题本 ==========

function escapeHTML(value) {
  return String(value ?? '').replace(/[&<>"']/g, char => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[char]);
}

const WORD_ACTION_ICONS = {
  play: '<polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.5 8.5a5 5 0 0 1 0 7"/>',
  edit: '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5Z"/>',
  delete: '<path d="M3 6h18M8 6V4h8v2m3 0-1 14H6L5 6m4 4v6m6-6v6"/>',
  check: '<path d="m5 12 4 4L19 6"/>'
};

function actionIcon(name) {
  return `<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${WORD_ACTION_ICONS[name]}</svg>`;
}

async function refreshWrongList() {
  const wrongList = Words.getWrong();
  const listEl = document.getElementById('wrongList');

  if (!wrongList.length) {
    listEl.innerHTML = '<li class="empty-tip">暂无错题</li>';
    return;
  }

  listEl.innerHTML = wrongList.map(w => `
    <li>
      <span class="word-en">${escapeHTML(w.en)}</span>
      <span class="word-cn">${escapeHTML(w.cn)} <small class="word-count-note">(错 ${Number(w.wrongCount) || 0} 次)</small></span>
      <div class="word-actions">
        <button type="button" class="btn btn-icon btn-secondary" data-action="play" data-en="${escapeHTML(w.en)}" aria-label="播放 ${escapeHTML(w.en)} 的发音" title="播放发音">${actionIcon('play')}</button>
        <button type="button" class="btn btn-sm btn-secondary" data-action="master" data-en="${escapeHTML(w.en)}" aria-label="将 ${escapeHTML(w.en)} 标记为已掌握">${actionIcon('check')} 已掌握</button>
      </div>
    </li>
  `).join('');
}

async function removeWrongItem(en) {
  await Words.removeWrong(en);
  showToast('已从错题本移除');
  refreshWrongList();
  refreshHome();
}

function speakWord(en) {
  SpeechUtil.speak(en);
}

// ========== 单词管理 ==========

async function refreshWordList() {
  const words = Words.getAll();
  const listEl = document.getElementById('wordList');
  const query = (document.getElementById('wordSearch')?.value || '').trim().toLocaleLowerCase();
  const filteredWords = query
    ? words.filter(word => [word.en, word.cn, word.phonetic, word.example]
      .some(value => String(value || '').toLocaleLowerCase().includes(query)))
    : words;
  document.getElementById('wordCount').textContent = words.length;
  const filterCount = document.getElementById('wordFilterCount');
  if (filterCount) filterCount.textContent = query ? `匹配 ${filteredWords.length} / ${words.length} 个` : `共 ${words.length} 个单词`;

  if (!words.length) {
    listEl.innerHTML = '<li class="empty-tip">暂无单词，请导入或添加</li>';
    return;
  }
  if (!filteredWords.length) {
    listEl.innerHTML = '<li class="empty-tip">没有找到匹配的单词</li>';
    return;
  }

  listEl.innerHTML = filteredWords.map(w => `
    <li>
      <span class="word-en">${escapeHTML(w.en)}</span>
      <span class="word-cn">${escapeHTML(w.cn)}${w.phonetic ? ` <small class="word-count-note">${escapeHTML(w.phonetic)}</small>` : ''}</span>
      <div class="word-actions">
        <button type="button" class="btn btn-icon btn-secondary" data-action="play" data-en="${escapeHTML(w.en)}" aria-label="播放 ${escapeHTML(w.en)} 的发音" title="播放发音">${actionIcon('play')}</button>
        <button type="button" class="btn btn-icon btn-secondary" data-action="edit" data-id="${Number(w.id)}" aria-label="编辑 ${escapeHTML(w.en)}" title="编辑单词">${actionIcon('edit')}</button>
        <button type="button" class="btn btn-icon btn-secondary" data-action="delete" data-id="${Number(w.id)}" aria-label="删除 ${escapeHTML(w.en)}" title="删除单词">${actionIcon('delete')}</button>
      </div>
    </li>
  `).join('');
}

let editingWordId = null;

function openWordEditor(id = null) {
  const dialog = document.getElementById('wordEditorDialog');
  const word = id === null ? null : Words.getAll().find(item => item.id === id);
  if (id !== null && !word) return;
  editingWordId = word?.id ?? null;
  document.getElementById('wordEditorTitle').textContent = word ? '编辑单词' : '添加单词';
  document.getElementById('wordEditorEn').value = word?.en || '';
  document.getElementById('wordEditorCn').value = word?.cn || '';
  document.getElementById('wordEditorPhonetic').value = word?.phonetic || '';
  document.getElementById('wordEditorExample').value = word?.example || '';
  dialog.showModal();
  document.getElementById('wordEditorEn').focus();
}

async function deleteWord(id) {
  if (!confirm('确定删除这个单词吗？')) return;
  await Words.removeWord(id);
  refreshWordList();
  showToast('已删除');
}

// ========== 听写流程 ==========

/**
 * 直接用指定单词列表开始听写（用于今日计划等场景）
 */
async function startDictationWithWords(wordList) {
  // 先切换到听写 tab
  switchTab('dictation');
  
  const accent = document.getElementById('selAccent').value;
  const playTimes = 2;

  SpeechUtil.setAccent(accent);
  state.dictation.mode = 'listen2en'; // 默认听英文写英文
  state.dictation.dayInfo = null;
  state.dictation.playTimes = playTimes;

  // 初始化状态
  state.dictation.active = true;
  state.dictation.wordList = wordList;
  state.dictation.index = 0;
  state.dictation.total = wordList.length;
  state.dictation.right = 0;
  state.dictation.wrong = 0;
  state.dictation.answeredList = [];

  // 切换 UI
  document.getElementById('dictSetup').classList.add('hidden');
  document.getElementById('dictDone').classList.add('hidden');
  document.getElementById('dictPlaying').classList.remove('hidden');
  document.getElementById('resultPanel').classList.add('hidden');

  // 面板可见后重新初始化画布
  setTimeout(() => {
    DrawCanvas.resizeCanvas();
    DrawCanvas.clear();
  }, 50);

  loadCurrentWord();
}

/**
 * 开始听写（从设置页进入）
 * 默认就是每日计划模式，从日期选择器取当天单词
 */
async function beginDictation() {
  const mode = document.getElementById('selMode').value;
  const accent = document.getElementById('selAccent').value;
  const playTimes = 2; // 默认播放2次

  SpeechUtil.setAccent(accent);
  state.dictation.playTimes = playTimes;

  // 从日期选择器获取选中的日期
  const dateStr = document.getElementById('selDailyDate').value;
  const dayWords = DailyPlan.getWordsByDate(dateStr);
  const dayInfo = DailyPlan.getDayInfoByDate(dateStr);

  if (!dayWords || !dayWords.length) {
    showToast('当天没有单词计划');
    return;
  }

  state.dictation.mode = mode;
  state.dictation.dayInfo = dayInfo;

  // 根据模式决定是否随机打乱顺序
  const modeConfig = MODE_CONFIG[mode];
  let queue = dayWords.map(w => ({ en: w.en, cn: w.cn }));
  
  if (modeConfig.pickRandom) {
    // 随机打乱当天单词顺序
    queue = shuffleArray(queue);
  }

  if (!queue.length) {
    showToast('没有可用的单词');
    return;
  }

  // 初始化状态
  state.dictation.active = true;
  state.dictation.wordList = queue;
  state.dictation.index = 0;
  state.dictation.total = queue.length;
  state.dictation.right = 0;
  state.dictation.wrong = 0;
  state.dictation.answeredList = [];

  // 切换 UI
  document.getElementById('dictSetup').classList.add('hidden');
  document.getElementById('dictDone').classList.add('hidden');
  document.getElementById('dictPlaying').classList.remove('hidden');
  document.getElementById('resultPanel').classList.add('hidden');

  // 关键：面板从隐藏变成可见后，canvas 才能拿到正确尺寸，需要重新初始化
  setTimeout(() => {
    DrawCanvas.resizeCanvas();
    DrawCanvas.clear();
  }, 50);

  loadCurrentWord();
}

/**
 * 加载当前单词
 */
function loadCurrentWord() {
  const d = state.dictation;
  speechPlayToken++;
  SpeechUtil.stop();
  const word = d.wordList[d.index];
  const modeConfig = MODE_CONFIG[d.mode] || MODE_CONFIG.listen2en;
  d.currentWord = word;
  d.submitted = false;

  // 重置提示显示和按钮
  document.getElementById('hintDisplay').classList.add('hidden');
  document.getElementById('btnHintCn').disabled = false;
  document.getElementById('btnHintLen').disabled = false;
  document.getElementById('btnHintFirst').disabled = false;

  // 更新进度
  let progressText = `第 ${d.index + 1} / ${d.total} 题`;
  if (d.dayInfo) {
    progressText = `第${d.dayInfo.dayNum}天 · ${DailyPlan.formatDateShort(d.dayInfo.date)} | 第 ${d.index + 1} / ${d.total} 题`;
  }
  document.getElementById('progressText').textContent = progressText;
  setDictationProgress(d.index / d.total * 100);

  // 重置 UI，根据模式显示不同提示
  let hintText = `第 ${d.index + 1} 题，${modeConfig.promptText}`;
  // 看英文写中文模式：直接显示英文单词
  if (modeConfig.showPrompt) {
    hintText = `第 ${d.index + 1} 题：${word.en} — 写出中文释义`;
  }
  document.getElementById('wordHint').textContent = hintText;

  // 看英文写中文模式：不需要播放按钮，禁用
  const playDisabled = modeConfig.playType === 'none';
  document.getElementById('txtAnswer').value = '';
  document.getElementById('resultPanel').classList.add('hidden');
  DrawCanvas.clear();

  // 启用/禁用播放按钮
  document.getElementById('btnPlay').disabled = playDisabled;
  document.getElementById('btnSlow').disabled = playDisabled;
  document.getElementById('btnReplay').disabled = playDisabled;
  document.getElementById('btnStopSpeech').disabled = playDisabled;
  setOperationStatus('speechPlaybackStatus', '', 'info');
  document.getElementById('btnSubmit').disabled = false;
  document.getElementById('btnSkip').disabled = false;

  if (playDisabled && !modeConfig.showPrompt) {
    document.getElementById('wordHint').textContent = `第 ${state.dictation.index + 1} 题，请根据单词提示作答`;
  } else if (!playDisabled) {
    // User gesture is required by browser autoplay policies.
    document.getElementById('wordHint').textContent = `第 ${state.dictation.index + 1} 题，请点击「播放」按钮听发音`;
    showToast('请点击「播放」按钮开始听发音');
  }
}

/**
 * 播放当前单词发音
 * @param {boolean} slow - 是否慢速
 */
async function playCurrentWord(slow = false) {
  const word = state.dictation.currentWord;
  if (!word) return;

  const modeConfig = MODE_CONFIG[state.dictation.mode] || MODE_CONFIG.listen2en;

  if (!SpeechUtil.isSupported() && typeof Audio === 'undefined') {
    setOperationStatus('speechPlaybackStatus', '此浏览器不支持语音播放', 'error');
    showToast('此浏览器无法使用系统语音或在线语音');
    return;
  }

  const playToken = ++speechPlayToken;

  const times = state.dictation.playTimes;
  const rate = slow ? 0.6 : 0.9;
  let hasError = false;

  // 根据模式决定播放内容
  let textToSpeak = '';
  let lang = 'en-US';

  if (modeConfig.playType === 'en') {
    textToSpeak = word.en;
    // 英文使用用户选择的英文口音
    lang = document.getElementById('selAccent').value || 'en-US';
  } else if (modeConfig.playType === 'cn') {
    textToSpeak = word.cn || '';
    // 中文使用用户选择的中文口音
    lang = document.getElementById('selChineseAccent').value || 'zh-CN';
  } else {
    return; // 不播放的模式
  }

  if (!textToSpeak) {
    setOperationStatus('speechPlaybackStatus', '当前没有可播放内容', 'error');
    showToast('没有可播放的内容');
    return;
  }

  setOperationStatus('speechPlaybackStatus', '正在加载语音并播放', 'loading');
  for (let i = 0; i < times; i++) {
    try {
      await SpeechUtil.speak(textToSpeak, { rate, accent: lang });
      if (playToken !== speechPlayToken) return;
      await new Promise(r => setTimeout(r, 400)); // 间隔
    } catch (e) {
      if (playToken !== speechPlayToken) return;
      console.warn('播放失败:', e);
      hasError = true;
      break;
    }
  }

  if (hasError) {
    setOperationStatus('speechPlaybackStatus', '播放失败，可重试或检查系统语音设置', 'error');
    showToast('播放失败，请检查语音包是否安装');
  } else if (playToken === speechPlayToken) {
    setOperationStatus('speechPlaybackStatus', '播放完成', 'success');
  }
}

function stopSpeechPlayback() {
  speechPlayToken++;
  SpeechUtil.stop();
  setOperationStatus('speechPlaybackStatus', '已停止播放', 'info');
}

/**
 * 语音诊断 - 排查为什么没声音
 */
async function testSpeech() {
  const box = document.getElementById('speechDiagnose');
  box.classList.remove('hidden');
  box.innerHTML = '<div class="operation-status is-loading"><span class="m3-spinner" aria-hidden="true"></span><span>正在诊断语音功能</span></div>';

  const results = [];

  const hasSystemSpeech = 'speechSynthesis' in window;
  if (hasSystemSpeech) {
    results.push('<div class="ok">✓ 浏览器支持系统语音</div>');
    try {
      await SpeechUtil.loadVoices();
    } catch (error) {
      results.push('<div class="err">系统语音列表暂不可用，将继续尝试播放测试音</div>');
    }
    const voices = SpeechUtil.getVoiceList();
    results.push(`<div>检测到 ${voices.length} 个系统语音</div>`);
    const enVoices = voices.filter(v => v.lang.startsWith('en'));
    if (!enVoices.length) {
      results.push('<div class="err">未找到英语系统语音，将尝试在线发音回退</div>');
    } else {
      results.push(`<div class="ok">找到 ${enVoices.length} 个英语语音</div>`);
      enVoices.slice(0, 5).forEach(v => {
        results.push(`<div class="diagnose-voice-item">- ${v.name} (${v.lang})</div>`);
      });
    }
  } else {
    results.push('<div>当前浏览器没有系统语音，将尝试在线发音回退（需要网络）</div>');
  }

  // 4. 尝试播放测试音
  results.push('<div>正在播放测试单词 "hello"...</div>');
  box.innerHTML = results.join('');

  try {
    await SpeechUtil.speak('hello', { rate: 0.9 });
    results.push('<div class="ok">✓ 播放完成。如果没有听到声音，请检查系统音量和浏览器标签页是否静音</div>');
  } catch (e) {
    results.push(`<div class="err">播放失败：${e.message || e.error || '未知错误'}</div>`);
  }

  box.innerHTML = results.join('');
}

// Tesseract worker 单例，避免重复初始化
let tesseractWorker = null;
let isRecognizing = false; // 防重复点击锁

/**
 * 获取或创建 Tesseract worker（单例模式）
 */
async function getTesseractWorker(onProgress) {
  if (tesseractWorker) return tesseractWorker;
  
  const worker = await Tesseract.createWorker('eng', 1, {
    logger: m => {
      if (onProgress) onProgress(m);
    }
  });
  
  try {
    await worker.setParameters({
      tessedit_char_whitelist: 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ',
      tessedit_pageseg_mode: '7',  // 单行文本模式，适合单词
    });
    tesseractWorker = worker;
  } catch (error) {
    try { await worker.terminate(); } catch (terminateError) {
      console.warn('停止初始化失败的 OCR worker 失败:', terminateError);
    }
    throw error;
  }
  
  return tesseractWorker;
}

/**
 * 识别手写板上的英文单词，结果自动填入输入框
 * 优化：单例 worker + 防重复点击 + 判题公平（不自动替换答案）
 */
async function recognizeHandwriting() {
  // 防重复点击
  if (isRecognizing) {
    showToast('正在识别中，请稍候...');
    return;
  }

  if (typeof Tesseract === 'undefined') {
    setOperationStatus('recognitionStatus', '识别组件未加载，请检查网络后刷新，或直接键盘输入', 'error');
    showToast('识别库加载失败，请检查网络后刷新页面');
    return;
  }

  if (DrawCanvas.isEmpty()) {
    showToast('请先在手写板上写单词');
    return;
  }

  const btn = document.getElementById('btnRecognize');
  const originalHTML = btn.innerHTML;
  btn.disabled = true;
  isRecognizing = true;
  let recognitionTimer;
  let recognitionExpired = false;

  try {
    btn.textContent = '正在准备…';
    setOperationStatus('recognitionStatus', '正在加载识别引擎', 'loading');
    const canvas = document.getElementById('drawCanvas');

    // 预处理图片：放大 + 二值化，提高识别率
    const processedCanvas = preprocessCanvas(canvas);

    // 为引擎/语言包加载及识别共用超时保护，避免加载状态永久停留。
    const timeoutPromise = new Promise((_, reject) => {
      recognitionTimer = setTimeout(() => {
        recognitionExpired = true;
        reject(new Error('识别超时'));
      }, 30000);
    });

    // 获取或创建 worker（首次会下载语言包）
    const workerPromise = getTesseractWorker((m) => {
      if (m.status === 'recognizing text') {
        const percent = Number.isFinite(m.progress) ? Math.round(m.progress * 100) : null;
        if (percent === null) setOperationStatus('recognitionStatus', '正在识别手写内容', 'loading');
        else setOperationStatus('recognitionStatus', `正在识别手写内容 ${percent}%`, 'loading', percent);
      } else if (m.status === 'loading language traineddata') {
        setOperationStatus('recognitionStatus', '正在加载英文识别语言包', 'loading');
      }
    });
    workerPromise.then(async (lateWorker) => {
      if (!recognitionExpired) return;
      if (tesseractWorker === lateWorker) tesseractWorker = null;
      try { await lateWorker.terminate(); } catch (terminateError) {
        console.warn('停止超时 OCR worker 失败:', terminateError);
      }
    }).catch(() => {});
    const worker = await Promise.race([workerPromise, timeoutPromise]);

    btn.textContent = '正在识别…';
    setOperationStatus('recognitionStatus', '正在识别手写内容', 'loading');

    // 执行识别；使用与引擎加载相同的超时期限。
    const result = await Promise.race([
      worker.recognize(processedCanvas),
      timeoutPromise
    ]);

    const text = (result.data.text || '').trim().toLowerCase().replace(/[^a-z]/g, '');
    console.log('识别结果:', text);

    if (text) {
      // OCR 只预填可编辑答案，仍需用户核对并提交。
      document.getElementById('txtAnswer').value = text;
      const expected = (state.dictation.currentWord?.en || '').toLowerCase();
      const confidence = Number.isFinite(result.data.confidence) ? Math.round(result.data.confidence) : null;
      const confidenceNote = confidence !== null && confidence < 50 ? `（置信度偏低：${confidence}%）` : (confidence !== null ? `（置信度 ${confidence}%）` : '');
      setOperationStatus('recognitionStatus', `识别完成${confidenceNote}：${text}，请核对或修改后再提交`, confidence !== null && confidence < 50 ? 'info' : 'success');
      showToast(text === expected
        ? `识别为“${text}”${confidenceNote}，请核对后提交`
        : `识别为“${text}”${confidenceNote}，与目标词可能不同，请核对或修改`);
    } else {
      setOperationStatus('recognitionStatus', '没有识别到文字，请重试或直接键盘输入', 'error');
      showToast('识别失败，请直接打字输入');
    }
  } catch (e) {
    console.error('识别出错:', e);
    if (e.message === '识别超时') {
      const worker = tesseractWorker;
      tesseractWorker = null;
      if (worker) {
        try { await worker.terminate(); } catch (terminateError) {
          console.warn('停止超时 OCR worker 失败:', terminateError);
        }
      }
      setOperationStatus('recognitionStatus', '识别超时，请重试或直接键盘输入', 'error');
      showToast('识别超时，请直接打字输入');
    } else {
      setOperationStatus('recognitionStatus', '识别失败，请重试或直接键盘输入', 'error');
      showToast('识别失败，请直接打字输入');
    }
  } finally {
    clearTimeout(recognitionTimer);
    btn.disabled = false;
    btn.innerHTML = originalHTML;
    isRecognizing = false;
  }
}

/**
 * 计算两个字符串的相似度（0~1），基于编辑距离
 */
function calculateSimilarity(s1, s2) {
  const longer = s1.length > s2.length ? s1 : s2;
  const shorter = s1.length > s2.length ? s2 : s1;
  
  if (longer.length === 0) return 1.0;
  
  const distances = [];
  for (let i = 0; i <= longer.length; i++) {
    distances[i] = [i];
  }
  for (let j = 0; j <= shorter.length; j++) {
    distances[0][j] = j;
  }
  
  for (let i = 1; i <= longer.length; i++) {
    for (let j = 1; j <= shorter.length; j++) {
      if (longer.charAt(i - 1) === shorter.charAt(j - 1)) {
        distances[i][j] = distances[i - 1][j - 1];
      } else {
        distances[i][j] = Math.min(
          distances[i - 1][j] + 1,
          distances[i][j - 1] + 1,
          distances[i - 1][j - 1] + 1
        );
      }
    }
  }
  
  const editDistance = distances[longer.length][shorter.length];
  return (longer.length - editDistance) / longer.length;
}

/**
 * 预处理手写板图片：自动裁剪 + 放大3倍 + 自适应二值化
 */
function preprocessCanvas(sourceCanvas) {
  const w = sourceCanvas.clientWidth;
  const h = sourceCanvas.clientHeight;
  if (w < 1 || h < 1) throw new Error('手写板尚未显示，请返回听写页面后重试');

  // 第一步：先做二值化，找出笔迹的边界框
  const tempCanvas = document.createElement('canvas');
  tempCanvas.width = w;
  tempCanvas.height = h;
  const tempCtx = tempCanvas.getContext('2d');
  // Canvas 清空后的空白像素是透明黑；先铺白底，否则边界检测会把整张画布都误判成笔迹。
  tempCtx.fillStyle = '#ffffff';
  tempCtx.fillRect(0, 0, w, h);
  tempCtx.drawImage(sourceCanvas, 0, 0, w, h);

  const imageData = tempCtx.getImageData(0, 0, w, h);
  const data = imageData.data;

  // 找笔迹的边界（最小的非白色区域）
  let minX = w, minY = h, maxX = 0, maxY = 0;
  let hasInk = false;
  const threshold = 200; // 灰度低于这个值算笔迹

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const idx = (y * w + x) * 4;
      const gray = (data[idx] + data[idx + 1] + data[idx + 2]) / 3;
      if (gray < threshold) {
        hasInk = true;
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }

  if (!hasInk) return tempCanvas;

  // 加一点边距
  const padding = 10;
  minX = Math.max(0, minX - padding);
  minY = Math.max(0, minY - padding);
  maxX = Math.min(w - 1, maxX + padding);
  maxY = Math.min(h - 1, maxY + padding);

  const cropW = maxX - minX + 1;
  const cropH = maxY - minY + 1;

  // 第二步：按最长边缩放到500px（OCR最优识别尺寸）
  const targetSize = 500;
  const longestSide = Math.max(cropW, cropH);
  const scale = Math.min(targetSize / longestSide, 5); // 最大放大5倍，最小1倍
  
  const newW = Math.round(cropW * scale);
  const newH = Math.round(cropH * scale);
  const newCanvas = document.createElement('canvas');
  newCanvas.width = newW;
  newCanvas.height = newH;
  const newCtx = newCanvas.getContext('2d');

  // 不透明白色背景
  newCtx.fillStyle = '#ffffff';
  newCtx.fillRect(0, 0, newW, newH);

  // 绘制裁剪后的内容（平滑缩放）
  newCtx.imageSmoothingEnabled = true;
  newCtx.imageSmoothingQuality = 'high';
  newCtx.drawImage(sourceCanvas, minX, minY, cropW, cropH, 0, 0, newW, newH);

  // 第三步：二值化，黑白分明
  const newImageData = newCtx.getImageData(0, 0, newCanvas.width, newCanvas.height);
  const newData = newImageData.data;
  const binaryThreshold = 160;

  for (let i = 0; i < newData.length; i += 4) {
    const gray = (newData[i] + newData[i + 1] + newData[i + 2]) / 3;
    if (gray < binaryThreshold) {
      newData[i] = 0; newData[i + 1] = 0; newData[i + 2] = 0;
    } else {
      newData[i] = 255; newData[i + 1] = 255; newData[i + 2] = 255;
    }
  }
  newCtx.putImageData(newImageData, 0, 0);

  return newCanvas;
}

/**
 * 提交答案并批改
 */
async function submitAnswer() {
  const d = state.dictation;
  if (!d.currentWord || d.submitted) return;

  const modeConfig = MODE_CONFIG[d.mode] || MODE_CONFIG.listen2en;
  const inputEl = document.getElementById('txtAnswer');
  const userAnswer = inputEl.value.trim();

  // 如果手写板有内容但没输入文字，提示用户
  if (!userAnswer && !DrawCanvas.isEmpty()) {
    showToast('手写板有内容，请点「识别填入」按钮，或在下方输入框打字');
    return;
  }

  if (!userAnswer) {
    showToast('请先输入答案');
    return;
  }

  d.submitted = true;

  // 根据模式批改
  let isRight = false;
  let correctAnswer = '';

  if (modeConfig.answerType === 'en') {
    // 英文答案：完全匹配（忽略大小写和首尾空格）
    const correctEn = d.currentWord.en.toLowerCase();
    correctAnswer = correctEn;
    isRight = userAnswer.toLowerCase() === correctEn;
  } else {
    // 中文答案：宽松匹配（包含关键字就算对）
    const correctCn = d.currentWord.cn || '';
    correctAnswer = correctCn;
    const userCn = userAnswer.trim();
    // 简单匹配：用户答案包含在正确答案里，或正确答案包含用户答案
    isRight = correctCn.includes(userCn) || userCn.includes(correctCn);
  }

  // 记录结果
  d.answeredList.push({
    en: d.currentWord.en,
    cn: d.currentWord.cn,
    userAnswer,
    isRight
  });

  if (isRight) {
    d.right++;
    // 如果之前在错题本，答对了就移除
    await Words.removeWrong(d.currentWord.en);
  } else {
    d.wrong++;
    // 加入错题本
    await Words.addWrong(d.currentWord);
  }

  // 显示结果面板
  showResult(isRight);

  // 更新进度条
  setDictationProgress((d.index + 1) / d.total * 100);

  // 禁用提交按钮
  document.getElementById('btnSubmit').disabled = true;
  document.getElementById('btnSkip').disabled = true;
}

/**
 * 显示结果面板
 */
function showResult(isRight) {
  const word = state.dictation.currentWord;
  const modeConfig = MODE_CONFIG[state.dictation.mode] || MODE_CONFIG.listen2en;
  const panel = document.getElementById('resultPanel');

  panel.classList.remove('hidden', 'wrong');
  if (!isRight) panel.classList.add('wrong');

  document.getElementById('resultTitle').innerHTML = isRight
    ? '<span class="result-title-content"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>回答正确</span>'
    : '<span class="result-title-content"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>回答错误</span>';
  document.getElementById('resultWord').textContent = word.en;
  document.getElementById('resultPhonetic').textContent = word.phonetic || '';

  // 根据模式显示不同的正确答案
  let cnText = word.cn || '';
  if (!isRight) {
    const userAns = document.getElementById('txtAnswer').value.trim();
    cnText += `\n（你的答案：${userAns}）`;
  }
  document.getElementById('resultCn').textContent = cnText;
}

/**
 * 下一题
 */
async function nextWord() {
  const d = state.dictation;
  d.index++;

  if (d.index >= d.total) {
    await finishDictation(true);
    return;
  }

  loadCurrentWord();
}

/**
 * 显示中文释义提示
 */
function showHintCn() {
  const word = state.dictation.currentWord;
  if (!word) return;
  const display = document.getElementById('hintDisplay');
  display.textContent = `中文释义：${word.cn}`;
  display.classList.remove('hidden');
}

/**
 * 显示单词长度提示
 */
function showHintLen() {
  const word = state.dictation.currentWord;
  if (!word) return;
  const display = document.getElementById('hintDisplay');
  const len = word.en.length;
  display.textContent = `单词长度提示：${'_'.repeat(len)}`;
  display.classList.remove('hidden');
}

/**
 * 显示首字母提示
 */
function showHintFirst() {
  const word = state.dictation.currentWord;
  if (!word) return;
  const display = document.getElementById('hintDisplay');
  const first = word.en[0];
  display.textContent = `首字母：${first}`;
  display.classList.remove('hidden');
}

/**
 * 跳过当前题
 */
function skipWord() {
  const d = state.dictation;
  if (!d.currentWord || d.submitted) return;
  d.submitted = true;
  d.wrong++;
  d.answeredList.push({
    en: d.currentWord.en,
    cn: d.currentWord.cn,
    userAnswer: '(跳过)',
    isRight: false,
    isSkipped: true
  });
  Words.addWrong(d.currentWord);

  showResult(false);
  document.getElementById('btnSubmit').disabled = true;
  document.getElementById('btnSkip').disabled = true;
  setDictationProgress((d.index + 1) / d.total * 100);
}

/**
 * 结束听写
 */
async function finishDictation(completed = false) {
  const d = state.dictation;
  const taskCompleted = completed || (d.total > 0 && d.answeredList.length >= d.total);
  speechPlayToken++;
  SpeechUtil.stop();
  d.active = false;

  // 仅记录实际提交或跳过的题目；播放、提示和 OCR 本身不计入学习。
  if (d.answeredList.length) await Stats.recordSession({
    taskDate: d.dayInfo?.date,
    total: d.answeredList.length,
    right: d.right,
    wrong: d.wrong,
    words: d.answeredList
  });

  // 仅完整完成队列时自动标记任务完成；中途退出保留原状态。
  if (taskCompleted && d.dayInfo && d.dayInfo.date) {
    saveUserStatus(d.dayInfo.date, 'done');
    // 重新渲染计划列表和首页统计
    renderPlanList();
    updateHomeDisplay();
  }
  refreshHome();

  // 显示结束面板
  document.getElementById('dictPlaying').classList.add('hidden');
  document.getElementById('dictSetup').classList.add('hidden');
  document.getElementById('dictDone').classList.remove('hidden');

  document.getElementById('sumTotal').textContent = d.answeredList.length;
  document.getElementById('sumRight').textContent = d.right;
  document.getElementById('sumWrong').textContent = d.wrong;
  document.getElementById('sumAcc').textContent =
    d.answeredList.length > 0 ? Math.round(d.right / d.answeredList.length * 100) + '%' : '--';
}

/**
 * 退出听写
 */
async function quitDictation() {
  if (!confirm('确定要结束本次听写吗？已完成的题目会记录。')) return;
  stopSpeechPlayback();
  await finishDictation(false);
}

// ========== 导入导出 ==========

async function importFile(file) {
  if (!file) return;
  setOperationStatus('importStatus', '正在读取词库文件', 'loading');
  try {
    const text = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(reader.error || new Error('无法读取文件'));
      reader.onabort = () => reject(new Error('文件读取已取消'));
      reader.readAsText(file, 'UTF-8');
    });
    setOperationStatus('importStatus', '正在导入单词', 'loading');
    const result = await Words.importFromText(text);
    setOperationStatus('importStatus', `导入完成：新增 ${result.added} 个，重复 ${result.dup} 个，跳过 ${result.skipped} 个`, 'success');
    showToast(`导入完成：新增 ${result.added} 个，重复 ${result.dup} 个，跳过 ${result.skipped} 个`);
    refreshWordList();
  } catch (error) {
    console.error('导入词库失败:', error);
    const wasCancelled = error.message === '文件读取已取消';
    setOperationStatus('importStatus', wasCancelled ? '文件读取已取消' : '导入失败，请检查文件后重试', wasCancelled ? 'info' : 'error');
    if (!wasCancelled) showToast('导入失败，请检查文件后重试');
  }
}

function downloadFile(filename, content, mime = 'text/plain') {
  const blob = new Blob([content], { type: mime + ';charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// ========== 事件绑定 ==========

function bindEvents() {
  // 标签切换
  document.querySelectorAll('.sidebar-item, .tab-btn').forEach(btn => {
    btn.addEventListener('click', () => switchTab(btn.dataset.tab));
  });

  document.getElementById('wordList').addEventListener('click', async (event) => {
    const button = event.target.closest('button[data-action]');
    if (!button) return;
    if (button.dataset.action === 'play') speakWord(button.dataset.en);
    if (button.dataset.action === 'edit') openWordEditor(Number(button.dataset.id));
    if (button.dataset.action === 'delete') await deleteWord(Number(button.dataset.id));
  });
  document.getElementById('wrongList').addEventListener('click', async (event) => {
    const button = event.target.closest('button[data-action]');
    if (!button) return;
    if (button.dataset.action === 'play') speakWord(button.dataset.en);
    if (button.dataset.action === 'master') await removeWrongItem(button.dataset.en);
  });
  document.getElementById('wordSearch').addEventListener('input', refreshWordList);

  // 首页按钮
  // 开始今日听写按钮
  document.getElementById('btnTodayDictation').addEventListener('click', () => {
    // 获取今天的日期
    const today = new Date();
    const y = today.getFullYear();
    const m = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    const todayStr = `${y}-${m}-${day}`;
    
    // 检查今天是否在计划内
    const dayInfo = DailyPlan.getDayInfoByDate(todayStr);
    if (!dayInfo) {
      showToast('今天不在学习计划周期内，请查看全部计划');
      return;
    }
    
    // 直接开始今天的听写
    DailyPlan.startDictationForDate(todayStr);
  });
  document.getElementById('btnReviewWrong').addEventListener('click', () => {
    switchTab('dictation');
    document.getElementById('selMode').value = 'wrong';
  });

  // 查看全部学习计划按钮
  const btnViewPlan = document.getElementById('btnViewPlan');
  if (btnViewPlan) {
    btnViewPlan.addEventListener('click', () => {
      document.querySelector('[data-tab="plan"]').click();
    });
  }

  // 听写控制
  document.getElementById('btnBegin').addEventListener('click', beginDictation);
  document.getElementById('btnTestSpeech').addEventListener('click', testSpeech);
  document.getElementById('btnPlay').addEventListener('click', () => playCurrentWord(false));
  document.getElementById('btnSlow').addEventListener('click', () => playCurrentWord(true));
  document.getElementById('btnReplay').addEventListener('click', () => playCurrentWord(false));
  document.getElementById('btnStopSpeech').addEventListener('click', stopSpeechPlayback);
  document.getElementById('btnSubmit').addEventListener('click', submitAnswer);
  document.getElementById('btnSkip').addEventListener('click', skipWord);
  document.getElementById('btnNext').addEventListener('click', nextWord);
  document.getElementById('btnQuit').addEventListener('click', quitDictation);
  document.getElementById('btnReDict').addEventListener('click', () => {
    document.getElementById('dictDone').classList.add('hidden');
    document.getElementById('dictSetup').classList.remove('hidden');
  });
  document.getElementById('btnBackHome').addEventListener('click', () => {
    switchTab('home');
    document.getElementById('dictDone').classList.add('hidden');
    document.getElementById('dictSetup').classList.remove('hidden');
  });
  document.getElementById('btnResultPlay').addEventListener('click', () => {
    const word = state.dictation.currentWord;
    if (word) SpeechUtil.speak(word.en);
  });
  document.getElementById('btnGiveUp').addEventListener('click', () => {
    if (state.dictation.submitted) return;
    skipWord();
  });

  // 渐进提示按钮
  document.getElementById('btnHintCn').addEventListener('click', showHintCn);
  document.getElementById('btnHintLen').addEventListener('click', showHintLen);
  document.getElementById('btnHintFirst').addEventListener('click', showHintFirst);

  // 手写板按钮
  document.getElementById('btnClear').addEventListener('click', () => DrawCanvas.clear());
  document.getElementById('btnUndo').addEventListener('click', () => DrawCanvas.undo());
  document.getElementById('btnRecognize').addEventListener('click', recognizeHandwriting);
  document.getElementById('inputPenSize').addEventListener('input', (e) => {
    DrawCanvas.setPenSize(parseInt(e.target.value));
  });

  // 错题本
  document.getElementById('btnPracticeWrong').addEventListener('click', () => {
    switchTab('dictation');
    document.getElementById('selMode').value = 'wrong';
  });
  document.getElementById('btnClearWrong').addEventListener('click', async () => {
    if (!confirm('确定清空所有错题吗？')) return;
    await Words.clearWrong();
    refreshWrongList();
    refreshHome();
    showToast('错题本已清空');
  });

  // 单词管理
  document.getElementById('btnImport').addEventListener('click', () => {
    document.getElementById('fileInput').click();
  });
  document.getElementById('fileInput').addEventListener('change', (e) => {
    const file = e.target.files[0];
    importFile(file);
    e.target.value = ''; // 重置以便重复选择同一文件
  });
  document.getElementById('btnExport').addEventListener('click', () => {
    const csv = Words.exportToCSV();
    downloadFile('单词表.csv', csv, 'text/csv');
  });
  document.getElementById('btnLoadSample').addEventListener('click', async () => {
    await Words.loadSample();
    refreshWordList();
    showToast('已加载示例单词');
  });
  document.getElementById('btnImportAllCET4').addEventListener('click', async () => {
    if (typeof ALL_CET4_WORDS === 'undefined') {
      showToast('CET4 单词数据未加载');
      return;
    }
    
    if (!confirm(`确定导入全部 ${ALL_CET4_WORDS.length} 个 CET4 单词吗？`)) return;
    
    const btn = document.getElementById('btnImportAllCET4');
    const importIcon = btn.querySelector('svg')?.outerHTML || '';
    btn.disabled = true;
    
    try {
      let imported = 0;
      const batchSize = 100; // 每批导入100个
      
      for (let i = 0; i < ALL_CET4_WORDS.length; i += batchSize) {
        const batch = ALL_CET4_WORDS.slice(i, i + batchSize);
        for (const w of batch) {
          if (await Words.addWord(w.en, w.cn) !== null) imported++;
        }
        const processed = Math.min(i + batch.length, ALL_CET4_WORDS.length);
        btn.innerHTML = `${importIcon}<span>正在导入... ${processed}/${ALL_CET4_WORDS.length}</span>`;
        const progress = Math.round(processed / ALL_CET4_WORDS.length * 100);
        setOperationStatus('importStatus', `正在导入 CET-4 单词 ${processed} / ${ALL_CET4_WORDS.length}`, 'loading', progress);
        await new Promise(r => setTimeout(r, 10)); // 每批之间延迟10ms，不卡页面
      }
      
      refreshWordList();
      setOperationStatus('importStatus', `导入完成：新增 ${imported} 个 CET-4 单词`, 'success');
      showToast(`已成功导入 ${imported} 个 CET4 单词`);
    } catch (e) {
      console.error('导入失败:', e);
      setOperationStatus('importStatus', 'CET-4 单词导入失败，请重试', 'error');
      showToast('导入失败，请重试');
    } finally {
      btn.disabled = false;
      btn.innerHTML = `${importIcon}<span>导入全部 CET4 单词 (${ALL_CET4_WORDS.length}个)</span>`;
    }
  });
  document.getElementById('btnAddWord').addEventListener('click', () => openWordEditor());
  document.getElementById('btnCancelWordEdit').addEventListener('click', () => {
    document.getElementById('wordEditorDialog').close();
  });
  document.getElementById('wordEditorForm').addEventListener('submit', async (event) => {
    event.preventDefault();
    const data = {
      en: document.getElementById('wordEditorEn').value.trim(),
      cn: document.getElementById('wordEditorCn').value.trim(),
      phonetic: document.getElementById('wordEditorPhonetic').value.trim(),
      example: document.getElementById('wordEditorExample').value.trim()
    };
    try {
      if (editingWordId !== null) {
        const updated = await Words.updateWord(editingWordId, data);
        if (!updated) {
          showToast('保存失败：单词已存在，或词条已被删除');
          return;
        }
        showToast('单词已更新');
      } else {
        const id = await Words.addWord(data.en, data.cn, data.phonetic, data.example);
        if (id === null) return;
        showToast('单词已添加');
      }
      document.getElementById('wordEditorDialog').close();
      editingWordId = null;
      refreshWordList();
    } catch (error) {
      console.error('保存单词失败:', error);
      showToast('保存失败，请重试');
    }
  });
  document.getElementById('btnExportAll').addEventListener('click', () => {
    const json = Words.exportAllJSON();
    downloadFile('学习数据备份.json', json, 'application/json');
  });

  // 回车键提交
  document.getElementById('txtAnswer').addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !state.dictation.submitted) {
      submitAnswer();
    } else if (e.key === 'Enter' && state.dictation.submitted) {
      nextWord();
    }
  });
}

// ========== 初始化 ==========

async function init() {
  console.log('初始化应用...');
  setOperationStatus('homeQueryStatus', '正在加载本地学习数据', 'loading');

  // 初始化听写用的手写板
  DrawCanvas.init(document.getElementById('drawCanvas'));

  // 加载单词数据
  await Words.loadAll();

  // 绑定事件
  bindEvents();

  // 临时注释每日计划，先确保基本功能正常
  // DailyPlan.load();

  // 加载每日计划
  DailyPlan.load();

  // 刷新首页数据
  refreshHome();

  console.log('初始化完成，共加载', Words.getAll().length, '个单词');

  // 如果没有单词，自动导入全部 CET4 单词
  if (!Words.getAll().length && typeof ALL_CET4_WORDS !== 'undefined') {
    showToast('正在导入 CET4 单词...');
    let imported = 0;
    for (const w of ALL_CET4_WORDS) {
      await Words.addWord(w.en, w.cn);
      imported++;
      if (imported % 25 === 0 || imported === ALL_CET4_WORDS.length) {
        setOperationStatus('importStatus', `正在导入 CET-4 单词 ${imported} / ${ALL_CET4_WORDS.length}`, 'loading', Math.round(imported / ALL_CET4_WORDS.length * 100));
        await new Promise(resolve => setTimeout(resolve, 0));
      }
    }
    setOperationStatus('importStatus', `导入完成：新增 ${imported} 个 CET-4 单词`, 'success');
    refreshWordList();
    showToast(`已导入 ${imported} 个 CET4 单词`);
  } else if (!Words.getAll().length) {
    await Words.loadSample();
    refreshWordList();
    showToast('已自动加载示例单词');
  }
}

// DOM 加载完成后启动
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
