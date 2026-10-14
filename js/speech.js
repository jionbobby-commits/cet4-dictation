/**
 * speech.js - Web Speech API 语音朗读封装
 * 负责：英语单词发音、美式/英式切换、慢速播放
 */
const SpeechUtil = (() => {
  let voices = [];
  let currentAccent = 'en-US'; // 默认美式
  let currentRequestId = 0; // 请求计数器，防止串音
  let lastError = null; // 最后一次错误信息

  /**
   * 语音诊断信息
   */
  function debugSpeech() {
    const ok = 'speechSynthesis' in window;
    const voices = ok ? window.speechSynthesis.getVoices() : [];
    const enVoices = voices.filter(v => v.lang.startsWith('en'));
    const zhVoices = voices.filter(v => v.lang.startsWith('zh'));
    
    const info = {
      supported: ok,
      totalVoices: voices.length,
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
      'zh-CN': ['zh-CN', 'zh_CN', 'zh-Hans-CN'],
      'zh-TW': ['zh-TW', 'zh_TW', 'zh-Hant-TW']
    };

    const codes = langMap[accentCode];
    if (!codes) {
      console.warn('未知口音代码:', accentCode);
      return null;
    }

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

    // 对应语言找不到时，不回退到其他语言，直接返回 null
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
    // 生成新的请求 ID，旧请求自动失效
    const requestId = ++currentRequestId;
    
    return new Promise((resolve, reject) => {
      // 优先用系统语音（国内手机更稳定，不依赖Google服务）
      if ('speechSynthesis' in window) {
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
            if (finished || requestId !== currentRequestId) return;
            finished = true;
            if (options.onend) options.onend();
            resolve();
          };

          utter.onerror = (e) => {
            if (finished || requestId !== currentRequestId) return;
            finished = true;
            lastError = `系统语音错误: ${e.error || e.message}`;
            console.warn('系统语音失败，尝试在线发音:', e);
            // 系统语音失败，再试在线发音
            speakOnline(text, options).then(() => {
              if (requestId !== currentRequestId) return;
              resolve();
            }).catch((err2) => {
              if (requestId !== currentRequestId) return;
              lastError += ` | 在线发音失败: ${err2.message}`;
              if (options.onerror) options.onerror(err2);
              reject(err2);
            });
          };

          // 直接同步调用，不能加 setTimeout，否则浏览器自动播放策略会拦截
          window.speechSynthesis.speak(utter);
          
          return;
        } catch (err) {
          console.warn('系统语音出错，尝试在线发音:', err);
        }
      }

      // 系统语音不可用，用在线发音
      speakOnline(text, options).then(() => {
        if (requestId !== currentRequestId) return;
        resolve();
      }).catch((err) => {
        if (requestId !== currentRequestId) return;
        if (options.onerror) options.onerror(err);
        reject(err);
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
    getVoiceList,
    debugSpeech
  };
})();
