/**
 * canvas.js - HTML Canvas 手写板
 * 使用 Pointer Events 统一处理鼠标、触摸、触控笔输入
 * 修复：坐标偏移、重复绘制、指针捕获问题
 */
const DrawCanvas = (() => {
  let canvas = null;
  let ctx = null;
  let isDrawing = false;
  let lastX = 0;
  let lastY = 0;
  let activePointerId = null;
  let resizeObserver = null;
  let penSize = 7;
  let history = [];
  let maxHistory = 20;

  /**
   * 初始化手写板
   */
  function init(canvasEl) {
    canvas = canvasEl;
    ctx = canvas.getContext('2d');

    resizeCanvas();
    bindEvents();

    saveHistory();
  }

  /**
   * 调整画布尺寸（适配 DPR 和屏幕变化）
   */
  function resizeCanvas() {
    if (!canvas) return;

    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    const dpr = window.devicePixelRatio || 1;

    if (width < 10 || height < 10) return;

    // 保存当前内容
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = canvas.width;
    tempCanvas.height = canvas.height;
    if (canvas.width > 0 && canvas.height > 0) {
      tempCanvas.getContext('2d').drawImage(canvas, 0, 0);
    }

    // 设置实际像素尺寸
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);

    // 绘图坐标使用 CSS 像素，画布 backing store 使用设备像素。
    ctx.setTransform(canvas.width / width, 0, 0, canvas.height / height, 0, 0);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#1f2937';
    ctx.lineWidth = penSize;

    // 恢复内容
    if (tempCanvas.width > 0) {
      ctx.drawImage(tempCanvas, 0, 0, width, height);
    }
  }

  /**
   * 绑定 Pointer Events 事件
   */
  function bindEvents() {
    // 用 Pointer Events 统一处理鼠标、触摸、触控笔
    canvas.addEventListener('pointerdown', onPointerDown);
    canvas.addEventListener('pointermove', onPointerMove);
    canvas.addEventListener('pointerup', onPointerUp);
    canvas.addEventListener('pointerleave', onPointerUp);
    canvas.addEventListener('pointercancel', onPointerUp);

    // 阻止浏览器默认触摸行为（滚动、缩放）
    canvas.style.touchAction = 'none';

    // 容器尺寸变化、窗口缩放及屏幕旋转时保持画布尺寸与笔迹比例。
    let resizeTimer;
    const scheduleResize = () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        resizeCanvas();
      }, 200);
    };
    window.addEventListener('resize', scheduleResize);
    if (window.ResizeObserver) {
      resizeObserver = new window.ResizeObserver(scheduleResize);
      resizeObserver.observe(canvas);
    }

    // 屏幕方向变化时重设画布
    window.addEventListener('orientationchange', () => {
      setTimeout(() => {
        resizeCanvas();
      }, 300);
    });
  }

  /**
   * 获取指针在画布中的相对坐标（CSS 像素）
   */
  function getPos(e) {
    const rect = canvas.getBoundingClientRect();
    return {
      x: e.clientX - rect.left - canvas.clientLeft,
      y: e.clientY - rect.top - canvas.clientTop
    };
  }

  /**
   * 指针按下 - 开始绘制
   */
  function onPointerDown(e) {
    if (isDrawing || e.isPrimary === false || (e.pointerType === 'mouse' && e.button !== 0)) return;
    e.preventDefault();
    isDrawing = true;
    activePointerId = e.pointerId;

    // 捕获指针，即使离开画布也能继续绘制
    try {
      canvas.setPointerCapture(e.pointerId);
    } catch (error) {
      // Some embedded browsers reject capture; drawing still works while the
      // pointer remains over the canvas.
      console.warn('无法捕获画布指针:', error);
    }

    const pos = getPos(e);
    lastX = pos.x;
    lastY = pos.y;

    // 画一个点（单独点击也有笔迹）
    ctx.beginPath();
    ctx.arc(lastX, lastY, penSize / 2, 0, Math.PI * 2);
    ctx.fillStyle = '#1f2937';
    ctx.fill();
  }

  /**
   * 指针移动 - 绘制线条
   */
  function onPointerMove(e) {
    if (!isDrawing || e.pointerId !== activePointerId) return;
    e.preventDefault();

    const pos = getPos(e);

    ctx.beginPath();
    ctx.moveTo(lastX, lastY);
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();

    lastX = pos.x;
    lastY = pos.y;
  }

  /**
   * 指针抬起 - 结束绘制
   */
  function onPointerUp(e) {
    if (!isDrawing || e.pointerId !== activePointerId) return;
    isDrawing = false;
    activePointerId = null;
    saveHistory();
  }

  /**
   * 保存快照（用于撤销）
   */
  function saveHistory() {
    if (!canvas) return;
    try {
      const data = canvas.toDataURL();
      history.push(data);
      if (history.length > maxHistory) {
        history.shift();
      }
    } catch (e) {
      console.warn('保存历史失败:', e);
    }
  }

  /**
   * 撤销上一步
   */
  function undo() {
    if (history.length <= 1) {
      clear();
      return;
    }
    history.pop();
    const prev = history[history.length - 1];

    const img = new Image();
    img.onload = () => {
      ctx.clearRect(0, 0, canvas.clientWidth, canvas.clientHeight);
      ctx.drawImage(img, 0, 0, canvas.clientWidth, canvas.clientHeight);
    };
    img.src = prev;
  }

  /**
   * 清空画布
   */
  function clear() {
    if (!canvas) return;
    ctx.clearRect(0, 0, canvas.clientWidth, canvas.clientHeight);
    saveHistory();
  }

  function setPenSize(size) {
    // 限制最大笔粗12px，太粗字母会连在一起影响识别
    penSize = Math.max(2, Math.min(Number(size) || 7, 12));
    if (ctx) {
      ctx.lineWidth = penSize;
    }
  }

  function getPenSize() {
    return penSize;
  }

  /**
   * 检查画布是否为空
   */
  function isEmpty() {
    if (!canvas) return true;
    const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
    for (let i = 3; i < data.length; i += 4) {
      if (data[i] > 0) return false;
    }
    return true;
  }

  return {
    init,
    clear,
    undo,
    setPenSize,
    getPenSize,
    isEmpty,
    resizeCanvas
  };
})();
