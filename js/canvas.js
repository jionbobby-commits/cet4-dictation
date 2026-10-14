/**
 * canvas.js - HTML Canvas 手写板
 * 支持：鼠标 + 触屏书写、撤销、清空、笔粗调节
 * 注意：本模块只负责手写轨迹绘制，不做文字识别
 */
const DrawCanvas = (() => {
  let canvas = null;
  let ctx = null;
  let isDrawing = false;
  let lastX = 0;
  let lastY = 0;
  let penSize = 7; // 默认笔粗调大一点，方便识别
  let history = []; // 保存历史快照用于撤销
  let maxHistory = 20;

  /**
   * 初始化手写板
   * @param {HTMLCanvasElement} canvasEl
   */
  function init(canvasEl) {
    canvas = canvasEl;
    ctx = canvas.getContext('2d');

    resizeCanvas();
    bindEvents();

    // 保存初始空白状态到历史
    saveHistory();
  }

  /**
   * 调整画布尺寸（适配屏幕宽度变化）
   * 重要：调整前先保存内容，调整后恢复，避免丢失笔迹
   */
  function resizeCanvas() {
    if (!canvas) return;

    // 获取 CSS 尺寸
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;

    // 如果容器是隐藏的（宽高为0），跳过本次 resize，等显示后再调
    if (rect.width < 10 || rect.height < 10) {
      return;
    }

    // 保存当前画布内容
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = canvas.width;
    tempCanvas.height = canvas.height;
    if (canvas.width > 0 && canvas.height > 0) {
      tempCanvas.getContext('2d').drawImage(canvas, 0, 0);
    }

    // 设置实际像素尺寸（考虑高清屏）
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;

    // 设置绘制坐标缩放
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); // 用 setTransform 而不是 scale，避免多次 scale 累加
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#1f2937';
    ctx.lineWidth = penSize;

    // 恢复之前的内容
    if (tempCanvas.width > 0) {
      ctx.drawImage(tempCanvas, 0, 0, rect.width, rect.height);
    }
  }

  /**
   * 绑定鼠标和触摸事件
   */
  function bindEvents() {
    // 鼠标事件
    canvas.addEventListener('mousedown', onStart);
    canvas.addEventListener('mousemove', onMove);
    canvas.addEventListener('mouseup', onEnd);
    canvas.addEventListener('mouseleave', onEnd);

    // 触摸事件 - 使用 passive: false 以便 preventDefault
    canvas.addEventListener('touchstart', onTouchStart, { passive: false });
    canvas.addEventListener('touchmove', onTouchMove, { passive: false });
    canvas.addEventListener('touchend', onEnd, { passive: false });

    // 窗口大小变化时重设画布
    let resizeTimer;
    window.addEventListener('resize', () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        resizeCanvas();
      }, 200);
    });
  }

  /**
   * 触摸事件处理 - 转换为坐标后复用鼠标逻辑
   */
  function onTouchStart(e) {
    e.preventDefault(); // 阻止页面滚动
    const touch = e.touches[0];
    const mouseEvent = new MouseEvent('mousedown', {
      clientX: touch.clientX,
      clientY: touch.clientY
    });
    canvas.dispatchEvent(mouseEvent);
  }

  function onTouchMove(e) {
    e.preventDefault();
    const touch = e.touches[0];
    const mouseEvent = new MouseEvent('mousemove', {
      clientX: touch.clientX,
      clientY: touch.clientY
    });
    canvas.dispatchEvent(mouseEvent);
  }

  /**
   * 获取鼠标/触摸在画布中的相对坐标
   */
  function getPos(e) {
    const rect = canvas.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    };
  }

  /**
   * 开始绘制
   */
  function onStart(e) {
    isDrawing = true;
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
   * 绘制中
   */
  function onMove(e) {
    if (!isDrawing) return;
    const pos = getPos(e);

    ctx.beginPath();
    ctx.moveTo(lastX, lastY);
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();

    lastX = pos.x;
    lastY = pos.y;
  }

  /**
   * 结束绘制
   */
  function onEnd() {
    if (isDrawing) {
      isDrawing = false;
      saveHistory();
    }
  }

  /**
   * 保存当前画布快照到历史栈（用于撤销）
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
    history.pop(); // 移除当前状态
    const prev = history[history.length - 1];

    const img = new Image();
    img.onload = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    };
    img.src = prev;
  }

  /**
   * 清空画布
   */
  function clear() {
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    ctx.clearRect(0, 0, rect.width * dpr, rect.height * dpr);
    saveHistory();
  }

  /**
   * 设置笔的粗细
   */
  function setPenSize(size) {
    penSize = size;
    if (ctx) {
      ctx.lineWidth = size;
    }
  }

  /**
   * 获取笔的粗细
   */
  function getPenSize() {
    return penSize;
  }

  /**
   * 检查画布是否为空（用于判断用户是否写了内容）
   */
  function isEmpty() {
    if (!canvas) return true;
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    const data = ctx.getImageData(0, 0, rect.width * dpr, rect.height * dpr).data;
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
