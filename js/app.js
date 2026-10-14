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

  function load() {
    try {
      if (typeof DAILY_PLAN_DATA === 'undefined') {
        document.getElementById('todayPlanInfo').textContent = '每日计划数据未加载';
        return;
      }
      
      allPlans = DAILY_PLAN_DATA;
      const today = getTodayStr();
      const todayPlan = allPlans.find(d => d.date === today);
      const infoEl = document.getElementById('todayPlanInfo');
      const btnEl = document.getElementById('todayPlanBtn');
      const dayPicker = document.getElementById('selDayPicker');

      // 初始化天数选择器（按顺序排列：第1天、第2天...）
      if (dayPicker) {
        // 清空选项
        dayPicker.innerHTML = '';
        
        // 所有天数选项（正序）
        let selectedValue = '1';
        for (let i = 0; i < allPlans.length; i++) {
          const plan = allPlans[i];
          const opt = document.createElement('option');
          opt.value = plan.dayNum;
          opt.textContent = `第${plan.dayNum}天 · ${plan.date}（${plan.wordCount}词）`;
          
          // 如果是今天，默认选中
          if (todayPlan && plan.dayNum === todayPlan.dayNum) {
            opt.selected = true;
            selectedValue = plan.dayNum;
          }
          
          dayPicker.appendChild(opt);
        }
      }

      if (!todayPlan) {
        infoEl.innerHTML = `今天没有安排学习计划<br><small style="color:#9ca3af">计划共 ${allPlans.length} 天</small>`;
        btnEl.style.display = 'none';
        return;
      }

      todayWords = todayPlan.words;
      infoEl.innerHTML = `第 <b>${todayPlan.dayNum}</b> 天 · 共 <b>${todayPlan.wordCount}</b> 个单词`;
      btnEl.style.display = 'block';
    } catch (e) {
      console.warn('每日计划加载失败:', e);
      document.getElementById('todayPlanInfo').textContent = '每日计划加载失败';
    }
  }

  function getTodayWords() {
    return todayWords;
  }

  function getWordsByDay(dayNum) {
    if (dayNum === -1) return todayWords;
    const plan = allPlans.find(p => p.dayNum === dayNum);
    return plan ? plan.words : [];
  }

  return { load, getTodayWords, getWordsByDay };
})();

// ========== 听写模式配置 ==========
const MODE_CONFIG = {
  listen2en: {
    name: '听英文→写英文',
    playType: 'en',        // 播放什么：en=英文, cn=中文, none=不播放
    answerType: 'en',      // 答案类型：en=英文, cn=中文
    showPrompt: false,     // 是否显示提示（比如看英文写中文模式要显示英文）
    promptText: '听发音，写出英文单词',
    pickRandom: false      // 单词选取方式
  },
  listen2en_random: {
    name: '听英文→写英文（随机）',
    playType: 'en',
    answerType: 'en',
    showPrompt: false,
    promptText: '听发音，写出英文单词',
    pickRandom: true
  },
  listen2cn: {
    name: '听中文→写英文',
    playType: 'cn',
    answerType: 'en',
    showPrompt: false,
    promptText: '听中文释义，写出英文单词',
    pickRandom: true
  },
  see2cn: {
    name: '看英文→写中文',
    playType: 'none',      // 不播放，直接看
    answerType: 'cn',      // 写中文释义
    showPrompt: true,      // 显示英文单词
    promptText: '看英文，写出中文释义',
    pickRandom: true
  },
  wrong: {
    name: '错词重练',
    playType: 'en',
    answerType: 'en',
    showPrompt: false,
    promptText: '复习错词，写出英文单词',
    pickRandom: true
  }
};

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
  const today = await Stats.getTodayRecord();
  const allStats = await Stats.getAllStats();
  const streak = await Stats.getStreak();
  const wrongList = Words.getWrong();
  const recent = await Stats.getRecentList(5);

  document.getElementById('statTodayPlan').textContent = today.total || 0;
  document.getElementById('statTodayDone').textContent = today.total || 0;
  document.getElementById('statTodayAcc').textContent =
    today.total > 0 ? Math.round(today.right / today.total * 100) + '%' : '--';
  document.getElementById('statTotalWords').textContent = allStats.total;
  document.getElementById('statWrongCount').textContent = wrongList.length;
  document.getElementById('statStreak').textContent = streak + ' 天';
  document.getElementById('homeWrongCount').textContent = wrongList.length;

  // 最近记录
  const recentList = document.getElementById('recentList');
  if (!recent.length) {
    recentList.innerHTML = '<li class="empty-tip">暂无记录，开始第一次听写吧</li>';
  } else {
    recentList.innerHTML = recent.map(r => {
      const acc = r.total > 0 ? Math.round(r.right / r.total * 100) + '%' : '--';
      return `<li>${r.date}：完成 ${r.total} 词，正确率 ${acc}</li>`;
    }).join('');
  }
}

async function refreshStats() {
  const allStats = await Stats.getAllStats();
  const streak = await Stats.getStreak();
  const week = await Stats.getRecentDays(7);

  document.getElementById('statAllTotal').textContent = allStats.total;
  document.getElementById('statAllRight').textContent = allStats.right;
  document.getElementById('statAllWrong').textContent = allStats.wrong;
  document.getElementById('statAllAcc').textContent = allStats.accuracy + '%';
  document.getElementById('statAllStreak').textContent = streak + ' 天';

  const weekList = document.getElementById('weekList');
  weekList.innerHTML = week.map(r => {
    const acc = r.total > 0 ? Math.round(r.right / r.total * 100) + '%' : '--';
    return `<li>${r.date}：完成 ${r.total} 词，正确 ${r.right}，错误 ${r.wrong}，正确率 ${acc}</li>`;
  }).join('');
}

// ========== 错题本 ==========

async function refreshWrongList() {
  const wrongList = Words.getWrong();
  const listEl = document.getElementById('wrongList');

  if (!wrongList.length) {
    listEl.innerHTML = '<li class="empty-tip">暂无错题</li>';
    return;
  }

  listEl.innerHTML = wrongList.map(w => `
    <li>
      <span class="word-en">${w.en}</span>
      <span class="word-cn">${w.cn} <small style="color:#9ca3af">(错 ${w.wrongCount} 次)</small></span>
      <div class="word-actions">
        <button class="btn btn-sm btn-secondary" onclick="speakWord('${w.en}')">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
            <path d="M15.54 8.46a5 5 0 0 1 0 7.07"/>
          </svg>
        </button>
        <button class="btn btn-sm btn-secondary" onclick="removeWrongItem('${w.en}')">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="20 6 9 17 4 12"/>
          </svg>
          已掌握
        </button>
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
  document.getElementById('wordCount').textContent = words.length;

  if (!words.length) {
    listEl.innerHTML = '<li class="empty-tip">暂无单词，请导入或添加</li>';
    return;
  }

  listEl.innerHTML = words.map(w => `
    <li>
      <span class="word-en">${w.en}</span>
      <span class="word-cn">${w.cn}</span>
      <div class="word-actions">
        <button class="btn btn-sm btn-secondary" onclick="speakWord('${w.en}')">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
            <path d="M15.54 8.46a5 5 0 0 1 0 7.07"/>
          </svg>
        </button>
        <button class="btn btn-sm btn-secondary" onclick="deleteWord(${w.id})">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="3 6 5 6 21 6"/>
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
          </svg>
        </button>
      </div>
    </li>
  `).join('');
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
  const playTimes = parseInt(document.getElementById('inputPlayTimes').value) || 2;

  SpeechUtil.setAccent(accent);
  state.dictation.mode = 'listen2en'; // 默认听英文写英文
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
 */
async function beginDictation() {
  const mode = document.getElementById('selMode').value;
  const accent = document.getElementById('selAccent').value;
  const playTimes = parseInt(document.getElementById('inputPlayTimes').value) || 2;
  const wordCount = parseInt(document.getElementById('inputWordCount').value) || 10;

  const modeConfig = MODE_CONFIG[mode] || MODE_CONFIG.listen2en;

  SpeechUtil.setAccent(accent);
  state.dictation.mode = mode;
  state.dictation.playTimes = playTimes;

  // 获取单词队列
  let pool = [];
  if (mode === 'wrong') {
    pool = Words.getWrong();
    if (!pool.length) {
      showToast('错题本是空的，无法错词重练');
      return;
    }
  } else {
    pool = Words.getAll();
    if (!pool.length) {
      showToast('单词表是空的，请先添加或导入单词');
      switchTab('words');
      return;
    }
  }

  // 选取单词
  let queue;
  if (modeConfig.pickRandom) {
    queue = Words.pickRandom(pool, wordCount);
  } else {
    queue = Words.pickOrder(pool, wordCount);
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
  const word = d.wordList[d.index];
  const modeConfig = MODE_CONFIG[d.mode] || MODE_CONFIG.listen2en;
  d.currentWord = word;
  d.submitted = false;

  // 更新进度
  document.getElementById('progressText').textContent = `第 ${d.index + 1} / ${d.total} 题`;
  const progress = d.index / d.total;
  const progressX = progress * 1000;
  document.getElementById('progressClipRect').setAttribute('width', progressX);
  document.getElementById('progressTrackLine').setAttribute('x1', progressX);
  document.getElementById('progressDivider').setAttribute('x1', progressX);
  document.getElementById('progressDivider').setAttribute('x2', progressX);
  document.getElementById('progressDivider').setAttribute('opacity', progress > 0 && progress < 1 ? '1' : '0');

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
  document.getElementById('btnReplay').disabled = false;
  document.getElementById('btnSubmit').disabled = false;
  document.getElementById('btnSkip').disabled = false;

  // 不自动播放（避免被浏览器自动播放策略拦截）
  // 提示用户手动点播放按钮
  document.getElementById('wordHint').textContent = `第 ${state.dictation.index + 1} 题，请点击「播放」按钮听发音`;
  showToast('请点击「播放」按钮开始听发音');
}

/**
 * 播放当前单词发音
 * @param {boolean} slow - 是否慢速
 */
async function playCurrentWord(slow = false) {
  const word = state.dictation.currentWord;
  if (!word) return;

  const modeConfig = MODE_CONFIG[state.dictation.mode] || MODE_CONFIG.listen2en;

  if (!SpeechUtil.isSupported()) {
    showToast('当前浏览器不支持语音朗读，请用 Chrome/Edge');
    return;
  }

  const times = state.dictation.playTimes;
  const rate = slow ? 0.6 : 0.9;
  let hasError = false;

  // 根据模式决定播放内容
  let textToSpeak = '';
  let lang = 'en-US';

  if (modeConfig.playType === 'en') {
    textToSpeak = word.en;
    lang = 'en-US';
  } else if (modeConfig.playType === 'cn') {
    textToSpeak = word.cn || '';
    lang = 'zh-CN';
  } else {
    return; // 不播放的模式
  }

  if (!textToSpeak) {
    showToast('没有可播放的内容');
    return;
  }

  for (let i = 0; i < times; i++) {
    try {
      await SpeechUtil.speak(textToSpeak, { rate, accent: lang });
      await new Promise(r => setTimeout(r, 400)); // 间隔
    } catch (e) {
      console.warn('播放失败:', e);
      hasError = true;
      break;
    }
  }

  if (hasError) {
    showToast('播放失败，请检查语音包是否安装');
  }
}

/**
 * 语音诊断 - 排查为什么没声音
 */
async function testSpeech() {
  const box = document.getElementById('speechDiagnose');
  box.classList.remove('hidden');
  box.innerHTML = '<div>正在诊断语音功能...</div>';

  const results = [];

  // 1. 检查浏览器是否支持
  if (!('speechSynthesis' in window)) {
    results.push('<div class="err">❌ 浏览器不支持 Web Speech API，请用 Chrome 或 Edge</div>');
    box.innerHTML = results.join('');
    return;
  }
  results.push('<div class="ok">✅ 浏览器支持 Web Speech API</div>');

  // 2. 等待语音列表加载
  await SpeechUtil.loadVoices();
  const voices = SpeechUtil.getVoiceList();
  results.push(`<div>📋 共检测到 ${voices.length} 个语音</div>`);

  // 3. 检查有没有英语语音
  const enVoices = voices.filter(v => v.lang.startsWith('en'));
  if (enVoices.length === 0) {
    results.push('<div class="err">❌ 系统里没有找到英语语音，请在系统设置里添加英语语音包</div>');
    results.push('<div style="font-size:12px;color:#9ca3af;margin-top:4px;">Windows: 设置 → 时间和语言 → 语音 → 添加语音，选英语(美国)</div>');
  } else {
    results.push(`<div class="ok">✅ 找到 ${enVoices.length} 个英语语音：</div>`);
    enVoices.slice(0, 5).forEach(v => {
      results.push(`<div style="padding-left:12px;font-size:12px;">- ${v.name} (${v.lang})</div>`);
    });
  }

  // 4. 尝试播放测试音
  results.push('<div>🔊 正在播放测试单词 "hello"...</div>');
  box.innerHTML = results.join('');

  try {
    await SpeechUtil.speak('hello', { rate: 0.9 });
    results.push('<div class="ok">✅ 播放完成！如果你没听到声音，请检查系统音量和浏览器标签页是否静音</div>');
  } catch (e) {
    results.push(`<div class="err">❌ 播放失败: ${e.message || e.error || '未知错误'}</div>`);
  }

  box.innerHTML = results.join('');
}

/**
 * 识别手写板上的英文单词，结果自动填入输入框
 * 优化：图片预处理 + 参数调优
 */
async function recognizeHandwriting() {
  if (typeof Tesseract === 'undefined') {
    showToast('识别库加载失败，请检查网络后刷新页面');
    return;
  }

  if (DrawCanvas.isEmpty()) {
    showToast('请先在手写板上写单词');
    return;
  }

  const btn = document.getElementById('btnRecognize');
  const originalText = btn.textContent;
  btn.disabled = true;

  try {
    btn.innerHTML = '<span class="m3-dots"><span></span><span></span><span></span></span> 识别中...';
    const canvas = document.getElementById('drawCanvas');

    // 预处理图片：放大 + 二值化，提高识别率
    const processedCanvas = preprocessCanvas(canvas);

    btn.innerHTML = '<span class="m3-dots"><span></span><span></span><span></span></span> 识别中...';

    // 调用 Tesseract，优化参数
    const result = await Tesseract.recognize(
      processedCanvas,
      'eng',
      {
        logger: m => {
          if (m.status === 'recognizing text') {
            btn.innerHTML = `<span class="m3-dots"><span></span><span></span><span></span></span> ${Math.round(m.progress * 100)}%`;
          } else if (m.status === 'loading language traineddata') {
            btn.innerHTML = '<span class="m3-dots"><span></span><span></span><span></span></span> 下载语言包...';
          }
        },
        // 只识别英文字母，提高准确率
        tessedit_char_whitelist: 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ',
        tessedit_pageseg_mode: '7',  // 单行文本模式，更适合单词
      }
    );

    const text = (result.data.text || '').trim().toLowerCase().replace(/[^a-z]/g, '');
    console.log('原始识别结果:', text);

    // 智能匹配修正（保守策略，只在高度相似时才修正，避免改错）
    const currentWord = state.dictation.currentWord;
    let finalText = text;
    
    if (currentWord && text) {
      const target = currentWord.en.toLowerCase();
      const similarity = calculateSimilarity(text, target);
      console.log(`与目标单词 "${target}" 的相似度: ${Math.round(similarity * 100)}%`);
      
      let shouldAutoCorrect = false;
      
      // 策略1：编辑距离相似度 ≥ 65%（比较严格，避免改错）
      if (similarity >= 0.65) shouldAutoCorrect = true;
      
      // 策略2：识别结果和目标单词前2个字母相同，且长度差≤2
      if (text.length >= 2 && target.length >= 2 && 
          text.substring(0, 2) === target.substring(0, 2) &&
          Math.abs(text.length - target.length) <= 2) {
        shouldAutoCorrect = true;
      }
      
      // 策略3：识别结果和目标单词后2个字母相同，且长度差≤2
      if (text.length >= 2 && target.length >= 2 && 
          text.substring(text.length - 2) === target.substring(target.length - 2) &&
          Math.abs(text.length - target.length) <= 2) {
        shouldAutoCorrect = true;
      }
      
      if (shouldAutoCorrect) {
        finalText = target;
        showToast(`识别结果：${text} → 已修正为：${target}`);
      } else {
        showToast(`识别结果：${text}，请核对后提交`);
      }
    } else if (text) {
      showToast(`识别结果：${text}，请核对后提交`);
    }

    if (finalText) {
      document.getElementById('txtAnswer').value = finalText;
    } else {
      showToast('识别失败，请直接打字输入');
    }
  } catch (e) {
    console.error('识别出错:', e);
    showToast('识别失败，请直接打字输入');
  } finally {
    btn.disabled = false;
    btn.textContent = originalText;
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
  const rect = sourceCanvas.getBoundingClientRect();
  const w = rect.width;
  const h = rect.height;

  // 第一步：先做二值化，找出笔迹的边界框
  const tempCanvas = document.createElement('canvas');
  tempCanvas.width = w;
  tempCanvas.height = h;
  const tempCtx = tempCanvas.getContext('2d');
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
  maxX = Math.min(w, maxX + padding);
  maxY = Math.min(h, maxY + padding);

  const cropW = maxX - minX;
  const cropH = maxY - minY;

  // 第二步：裁剪并放大4倍（最优比例，太大太小都不好）
  const scale = 4;
  const newCanvas = document.createElement('canvas');
  newCanvas.width = cropW * scale;
  newCanvas.height = cropH * scale;
  const newCtx = newCanvas.getContext('2d');

  // 白色背景
  newCtx.fillStyle = '#ffffff';
  newCtx.fillRect(0, 0, newCanvas.width, newCanvas.height);

  // 绘制裁剪后的内容（放大）
  newCtx.drawImage(sourceCanvas, minX, minY, cropW, cropH, 0, 0, newCanvas.width, newCanvas.height);

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
  const progress = (d.index + 1) / d.total;
  const progressX = progress * 1000;
  document.getElementById('progressClipRect').setAttribute('width', progressX);
  document.getElementById('progressTrackLine').setAttribute('x1', progressX);
  document.getElementById('progressDivider').setAttribute('x1', progressX);
  document.getElementById('progressDivider').setAttribute('x2', progressX);
  document.getElementById('progressDivider').setAttribute('opacity', progress > 0 && progress < 1 ? '1' : '0');

  // 禁用提交按钮
  document.getElementById('btnSubmit').disabled = true;
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
    ? '<span style="display:inline-flex;align-items:center;gap:8px;"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>回答正确</span>'
    : '<span style="display:inline-flex;align-items:center;gap:8px;"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>回答错误</span>';
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
    await finishDictation();
    return;
  }

  loadCurrentWord();
}

/**
 * 跳过当前题
 */
function skipWord() {
  const d = state.dictation;
  d.wrong++;
  d.answeredList.push({
    en: d.currentWord.en,
    cn: d.currentWord.cn,
    userAnswer: '(跳过)',
    isRight: false
  });
  Words.addWrong(d.currentWord);

  showResult(false);
  document.getElementById('btnSubmit').disabled = true;
  document.getElementById('progressClipRect').setAttribute('width', ((d.index + 1) / d.total * 1200));
}

/**
 * 结束听写
 */
async function finishDictation() {
  const d = state.dictation;
  d.active = false;

  // 记录到学习统计
  await Stats.recordSession({
    total: d.total,
    right: d.right,
    wrong: d.wrong
  });

  // 显示结束面板
  document.getElementById('dictPlaying').classList.add('hidden');
  document.getElementById('dictSetup').classList.add('hidden');
  document.getElementById('dictDone').classList.remove('hidden');

  document.getElementById('sumTotal').textContent = d.total;
  document.getElementById('sumRight').textContent = d.right;
  document.getElementById('sumWrong').textContent = d.wrong;
  document.getElementById('sumAcc').textContent =
    d.total > 0 ? Math.round(d.right / d.total * 100) + '%' : '--';
}

/**
 * 退出听写
 */
async function quitDictation() {
  if (!confirm('确定要结束本次听写吗？已完成的题目会记录。')) return;
  await finishDictation();
}

// ========== 导入导出 ==========

async function importFile(file) {
  if (!file) return;

  const reader = new FileReader();
  reader.onload = async (e) => {
    const text = e.target.result;
    const result = await Words.importFromText(text);
    showToast(`导入完成：新增 ${result.added} 个，重复 ${result.dup} 个，跳过 ${result.skipped} 个`);
    refreshWordList();
  };
  reader.readAsText(file, 'UTF-8');
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

  // 首页按钮
  document.getElementById('btnTodayDictation').addEventListener('click', () => {
    const dayPicker = document.getElementById('selDayPicker');
    const dayNum = parseInt(dayPicker.value);
    const words = DailyPlan.getWordsByDay(dayNum);
    
    if (!words.length) {
      showToast('该天数没有计划单词');
      return;
    }
    startDictationWithWords(words);
  });
  document.getElementById('btnReviewWrong').addEventListener('click', () => {
    switchTab('dictation');
    document.getElementById('selMode').value = 'wrong';
  });

  // 听写控制
  document.getElementById('btnBegin').addEventListener('click', beginDictation);
  document.getElementById('btnTestSpeech').addEventListener('click', testSpeech);
  document.getElementById('btnPlay').addEventListener('click', () => playCurrentWord(false));
  document.getElementById('btnSlow').addEventListener('click', () => playCurrentWord(true));
  document.getElementById('btnReplay').addEventListener('click', () => playCurrentWord(false));
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
    btn.disabled = true;
    
    try {
      let imported = 0;
      const batchSize = 100; // 每批导入100个
      
      for (let i = 0; i < ALL_CET4_WORDS.length; i += batchSize) {
        const batch = ALL_CET4_WORDS.slice(i, i + batchSize);
        for (const w of batch) {
          await Words.addWord(w.en, w.cn);
          imported++;
        }
        btn.textContent = `📚 导入中... ${imported}/${ALL_CET4_WORDS.length}`;
        await new Promise(r => setTimeout(r, 10)); // 每批之间延迟10ms，不卡页面
      }
      
      refreshWordList();
      showToast(`已成功导入 ${imported} 个 CET4 单词`);
    } catch (e) {
      console.error('导入失败:', e);
      showToast('导入失败，请重试');
    } finally {
      btn.disabled = false;
      btn.textContent = '📚 导入全部 CET4 单词 (1910个)';
    }
  });
  document.getElementById('btnAddWord').addEventListener('click', async () => {
    const en = prompt('请输入英文单词：');
    if (!en) return;
    const cn = prompt('请输入中文释义：');
    if (!cn) return;
    await Words.addWord(en, cn);
    refreshWordList();
    showToast('已添加');
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
    }
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
