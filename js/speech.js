/**
 * speech.js - Web Speech API 语音朗读封装
 * 负责：英语单词发音、美式/英式切换、慢速播放
 */
const SpeechUtil = (() => {
  let voices = [];
  let currentAccent = 'en-US'; // 默认美式

  /**
   * 加载可用语音列表（等待语音列表就绪）
   */
  function loadVoices() {
    return new Promise((resolve) => {
      if (!('speechSynthesis' in window)) {
        console.warn('当前浏览器不支持 Web Speech API');
        resolve([]);
        return;
      }

      // 先尝试获取一次
      voices = window.speechSynthesis.getVoices();

      // 如果已经有语音了，直接返回
      if (voices.length > 0) {
        resolve(voices);
        return;
      }

      // 否则等待 onvoiceschanged 事件
      window.speechSynthesis.onvoiceschanged = () => {
        voices = window.speechSynthesis.getVoices();
        resolve(voices);
      };

      // 5 秒后强制 resolve，避免一直卡着
      setTimeout(() => {
        if (voices.length === 0) {
          voices = window.speechSynthesis.getVoices();
          resolve(voices);
        }
      }, 5000);
    });
  }

  /**
   * 根据口音代码查找最合适的语音
   * @param {string} accentCode - 'en-US' / 'en-GB' / 'zh-CN'
   */
  function findVoice(accentCode) {
    if (!voices.length) voices = window.speechSynthesis.getVoices();

    console.log('可用语音数量:', voices.length, '查找口音:', accentCode);

    const langMap = {
      'en-US': ['en-US', 'en_US'],
      'en-GB': ['en-GB', 'en_GB'],
      'zh-CN': ['zh-CN', 'zh_CN', 'zh-Hans-CN']
    };

    const codes = langMap[accentCode] || langMap['en-US'];

    // 优先匹配 Google 语音（通常最自然）
    for (const code of codes) {
      const v = voices.find(v =>
        v.lang === code &&
        (v.name.includes('Google') || v.name.includes('Natural') || v.name.includes('Samantha'))
      );
      if (v) {
        console.log('找到语音(优选):', v.name, v.lang);
        return v;
      }
    }

    // 其次精确匹配语言代码
    for (const code of codes) {
      const v = voices.find(v => v.lang === code);
      if (v) {
        console.log('找到语音:', v.name, v.lang);
        return v;
      }
    }

    // 再次模糊匹配 en 开头
    const fallback = voices.find(v => v.lang.startsWith('en'));
    if (fallback) {
      console.log('使用兜底语音:', fallback.name, fallback.lang);
      return fallback;
    }

    console.warn('未找到任何英语语音');
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
          onlineAudio = null;
        }

        const accent = options.accent || currentAccent;
        const lang = accent === 'en-GB' ? 'en-GB' : 'en';
        
        // Google Translate TTS 接口
        const url = `https://translate.google.com/translate_tts?ie=UTF-8&q=${encodeURIComponent(text)}&tl=${lang}&client=tw-ob`;
        
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

        onlineAudio.play().catch(e => {
          console.warn('在线发音播放失败:', e);
          if (options.onerror) options.onerror(e);
          reject(e);
        });
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
    return new Promise((resolve, reject) => {
      // 先尝试用在线发音（更稳定，不依赖系统语音包）
      speakOnline(text, options).then(resolve).catch((err) => {
        console.warn('在线发音失败，尝试系统语音:', err);
        
        // 在线发音失败，再试系统语音
        if (!('speechSynthesis' in window)) {
          reject(new Error('语音朗读不可用'));
          return;
        }

        try {
          window.speechSynthesis.cancel();

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

          let finished = false;

          utter.onend = () => {
            if (finished) return;
            finished = true;
            if (options.onend) options.onend();
            resolve();
          };

          utter.onerror = (e) => {
            if (finished) return;
            finished = true;
            if (options.onerror) options.onerror(e);
            reject(e);
          };

          setTimeout(() => {
            window.speechSynthesis.speak(utter);
          }, 150);
        } catch (err) {
          reject(err);
        }
      });
    });
  }

  /**
   * 停止朗读
   */
  function stop() {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
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
    if (!voices.length) voices = window.speechSynthesis.getVoices();
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
    getVoiceList
  };
})();
