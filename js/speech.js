/**
 * speech.js - Web Speech API 语音朗读封装
 * 负责：英语单词发音、美式/英式切换、慢速播放
 */
const SpeechUtil = (() => {
  let voices = [];
  let currentAccent = 'en-US'; // 默认美式
  let currentRequestId = 0; // 请求计数器，防止串音
  let lastError = null; // 最后一次错误信息
  let activePlaybackCancel = null;
  let pendingVoiceLoad = null;

  function refreshVoices() {
    try {
      if ('speechSynthesis' in window) voices = window.speechSynthesis.getVoices() || [];
    } catch (error) {
      console.warn('读取系统语音列表失败:', error);
    }
    return voices;
  }

  /**
   * 语音诊断信息
   */
  function debugSpeech() {
    const ok = 'speechSynthesis' in window;
    const availableVoices = ok ? refreshVoices() : [];
    const enVoices = availableVoices.filter(v => String(v.lang || '').toLowerCase().startsWith('en'));
    const zhVoices = availableVoices.filter(v => String(v.lang || '').toLowerCase().startsWith('zh'));
    
    const info = {
      supported: ok,
      totalVoices: availableVoices.length,
      enVoices: enVoices.length,
      zhVoices: zhVoices.length,
      lastError: lastError || '无错误记录',
      enVoiceList: enVoices.map(v => `${v.name} (${v.lang})`).slice(0, 5),
      zhVoiceList: zhVoices.map(v => `${v.name} (${v.lang})`).slice(0, 5)
    };
    
    console.log('语音诊断:', info);
    return info;
  }

  /**
   * 加载可用语音列表（等待语音列表就绪）
   */
  function loadVoices() {
    if (!('speechSynthesis' in window)) {
      console.warn('当前浏览器不支持 Web Speech API');
      return Promise.resolve([]);
    }

    refreshVoices();
    if (voices.length) return Promise.resolve(voices);
    if (pendingVoiceLoad) return pendingVoiceLoad;

    const synthesis = window.speechSynthesis;
    pendingVoiceLoad = new Promise((resolve) => {
      let settled = false;
      let pollTimer;
      let timeout;
      const finish = () => {
        if (settled) return;
        settled = true;
        clearInterval(pollTimer);
        clearTimeout(timeout);
        if (synthesis.removeEventListener) synthesis.removeEventListener('voiceschanged', check);
        else if (synthesis.onvoiceschanged === check) synthesis.onvoiceschanged = null;
        refreshVoices();
        pendingVoiceLoad = null;
        resolve(voices);
      };
      const check = () => {
        refreshVoices();
        if (voices.length) finish();
      };

      if (synthesis.addEventListener) synthesis.addEventListener('voiceschanged', check);
      else synthesis.onvoiceschanged = check;
      // Some mobile engines populate voices without reliably dispatching the event.
      pollTimer = setInterval(check, 250);
      timeout = setTimeout(finish, 2500);
      check();
    });
    return pendingVoiceLoad;
  }

  /**
   * 根据口音代码查找最合适的语音
   * @param {string} accentCode - 'en-US' / 'en-GB' / 'zh-CN'
   */
  function findVoice(accentCode) {
    if (!voices.length) voices = window.speechSynthesis.getVoices();

    console.log('可用语音数量:', voices.length, '查找口音:', accentCode);

    const desired = String(accentCode || '').toLowerCase().replace(/_/g, '-');
    const baseLanguage = desired.split('-')[0];
    if (!['en', 'zh'].includes(baseLanguage)) {
      console.warn('未知口音代码:', accentCode);
      return null;
    }

    const normalized = voice => String(voice.lang || '').toLowerCase().replace(/_/g, '-');
    const exact = voices.filter(voice => normalized(voice) === desired);
    const preferred = exact.find(voice => /google|natural|samantha/i.test(voice.name));
    const match = preferred || exact[0] || voices.find(voice => normalized(voice).split('-')[0] === baseLanguage);
    if (match) return match;

    console.warn('未找到对应语言的语音:', accentCode);
    return null;
  }

  // 在线 TTS 备用方案的 Audio 对象
  let onlineAudio = null;

  /**
   * 在线发音（备用方案，不需要系统语音包）
   */
  function speakOnline(text, options = {}) {
    return new Promise((resolve, reject) => {
      try {
        // 停止之前的播放
        if (onlineAudio) {
          onlineAudio.pause();
          onlineAudio.removeAttribute('src');
          onlineAudio.load();
          onlineAudio = null;
        }

        const accent = options.accent || currentAccent;
        let type;
        if (accent === 'en-GB') {
          type = 1; // 英式
        } else if (accent === 'zh-CN' || accent === 'zh-TW') {
          type = 2; // 中文
        } else {
          type = 2; // 默认美式
        }
        
        // 有道词典 TTS 接口（国内可访问，免费，无需API key）
        const url = `https://dict.youdao.com/dictvoice?audio=${encodeURIComponent(text)}&type=${type}`;
        
        console.log('使用有道TTS:', url);
        onlineAudio = new Audio(url);
        
        // 慢速播放
        if (options.rate && options.rate < 0.9) {
          onlineAudio.playbackRate = options.rate;
        }

        onlineAudio.onended = () => {
          console.log('在线发音结束:', text);
          if (options.onend) options.onend();
          resolve();
        };

        onlineAudio.onerror = (e) => {
          console.warn('在线发音失败:', e);
          if (options.onerror) options.onerror(e);
          reject(e);
        };

        const playResult = onlineAudio.play();
        if (playResult && typeof playResult.catch === 'function') {
          playResult.catch(e => {
            console.warn('在线发音播放失败:', e);
            if (options.onerror) options.onerror(e);
            reject(e);
          });
        }
      } catch (e) {
        reject(e);
      }
    });
  }

  /**
   * 朗读文本（优先系统语音，失败自动切换在线发音）
   * @param {string} text - 要朗读的英文文本
   * @param {object} options - { accent, rate, onend, onerror }
   */
  function speak(text, options = {}) {
    // 结束上一条语音并释放等待中的 Promise，避免连点后队列卡住。
    stop();
    const requestId = ++currentRequestId;

    return new Promise((resolve, reject) => {
      let settled = false;
      let fallbackStarted = false;
      let playbackTimeout;
      const finish = (error) => {
        if (settled) return;
        settled = true;
        clearTimeout(playbackTimeout);
        if (activePlaybackCancel === cancel) activePlaybackCancel = null;
        if (error) reject(error);
        else resolve();
      };
      const cancel = () => finish();
      activePlaybackCancel = cancel;

      const fallbackOnline = () => {
        if (fallbackStarted || settled) return;
        fallbackStarted = true;
        speakOnline(text, options).then(() => finish()).catch((err) => {
          if (requestId !== currentRequestId) return finish();
          lastError = [lastError, `在线发音失败: ${err.message || err.error || '未知错误'}`].filter(Boolean).join(' | ');
          if (options.onerror) options.onerror(err);
          finish(err);
        });
      };

      // 优先用系统语音（国内手机更稳定，不依赖Google服务）
      if ('speechSynthesis' in window) {
        try {
          const utter = new SpeechSynthesisUtterance(text);
          const accent = options.accent || currentAccent;
          const voice = findVoice(accent);

          if (voice) {
            utter.voice = voice;
            utter.lang = voice.lang;
          } else {
            utter.lang = accent;
          }

          utter.rate = options.rate || 0.9;
          utter.pitch = 1;
          utter.volume = 1;

          utter.onend = () => {
            if (requestId !== currentRequestId) return finish();
            try { if (options.onend) options.onend(); } catch (error) { console.error('语音结束回调失败:', error); }
            finish();
          };

          utter.onerror = (e) => {
            if (requestId !== currentRequestId) return finish();
            lastError = `系统语音错误: ${e.error || e.message}`;
            console.warn('系统语音失败，尝试在线发音:', e);
            fallbackOnline();
          };

          // 直接同步调用，不能加 setTimeout，否则浏览器自动播放策略会拦截
          window.speechSynthesis.speak(utter);
          // 移动端语音引擎偶尔会既不触发 onend 也不触发 onerror；超时后取消并走可见的回退流程。
          const timeoutMs = Math.max(12000, Math.min(30000, Math.ceil(String(text).length * 500 / Math.max(0.5, utter.rate))));
          playbackTimeout = setTimeout(() => {
            if (settled || requestId !== currentRequestId) return;
            lastError = '系统语音播放超时';
            try { window.speechSynthesis.cancel(); } catch (error) { console.warn('取消超时语音失败:', error); }
            fallbackOnline();
          }, timeoutMs);
          
          return;
        } catch (err) {
          console.warn('系统语音出错，尝试在线发音:', err);
        }
      }

      // 系统语音不可用，用在线发音
      fallbackOnline();
    });
  }

  /**
   * 停止朗读
   */
  function stop() {
    currentRequestId++;
    if ('speechSynthesis' in window) {
      try { window.speechSynthesis.cancel(); } catch (error) { console.warn('停止系统语音失败:', error); }
    }
    if (onlineAudio) {
      onlineAudio.pause();
      onlineAudio.removeAttribute('src');
      onlineAudio.load();
      onlineAudio = null;
    }
    const cancel = activePlaybackCancel;
    activePlaybackCancel = null;
    if (cancel) cancel();
  }

  /**
   * 设置当前口音
   */
  function setAccent(accentCode) {
    currentAccent = accentCode;
  }

  /**
   * 获取当前口音
   */
  function getAccent() {
    return currentAccent;
  }

  /**
   * 检查浏览器是否支持
   */
  function isSupported() {
    return 'speechSynthesis' in window;
  }

  /**
   * 获取当前可用语音列表（调试用）
   */
  function getVoiceList() {
    if (!voices.length) refreshVoices();
    return voices;
  }

  // 初始化时加载一次
  loadVoices().then(v => {
    console.log('语音列表加载完成，共', v.length, '个语音');
  });

  return {
    loadVoices,
    speak,
    stop,
    setAccent,
    getAccent,
    isSupported,
    getVoiceList,
    debugSpeech
  };
})();
