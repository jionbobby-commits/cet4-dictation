const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');

const appSource = fs.readFileSync(path.join(__dirname, '..', 'js', 'app.js'), 'utf8').replace(/\r\n/g, '\n');
const start = appSource.indexOf('function preprocessCanvas(sourceCanvas) {');
const end = appSource.indexOf('\n}\n\n/**\n * 提交答案并批改', start) + 2;
assert.ok(start >= 0 && end > start, 'preprocessCanvas function should be present');

class MockCanvas {
  constructor() {
    this.width = 0;
    this.height = 0;
    this.style = {};
    this.pixels = new Uint8ClampedArray();
  }
  set width(value) {
    this._width = value;
    if (this._height) this.pixels = new Uint8ClampedArray(this._width * this._height * 4);
  }
  get width() { return this._width; }
  set height(value) {
    this._height = value;
    if (this._width) this.pixels = new Uint8ClampedArray(this._width * this._height * 4);
  }
  get height() { return this._height; }
  getContext() {
    const canvas = this;
    return {
      fillStyle: '#000000',
      imageSmoothingEnabled: false,
      imageSmoothingQuality: 'low',
      fillRect(x, y, width, height) {
        for (let py = Math.max(0, y); py < Math.min(canvas.height, y + height); py++) {
          for (let px = Math.max(0, x); px < Math.min(canvas.width, x + width); px++) {
            const offset = (py * canvas.width + px) * 4;
            const value = this.fillStyle === '#ffffff' ? 255 : 0;
            canvas.pixels.set([value, value, value, 255], offset);
          }
        }
      },
      drawImage(source, ...args) {
        let sx = 0, sy = 0, sw = source.width, sh = source.height;
        let dx = 0, dy = 0, dw = canvas.width, dh = canvas.height;
        if (args.length === 8) [sx, sy, sw, sh, dx, dy, dw, dh] = args;
        else if (args.length === 4) [dx, dy, dw, dh] = args;
        for (let py = Math.max(0, Math.floor(dy)); py < Math.min(canvas.height, Math.ceil(dy + dh)); py++) {
          for (let px = Math.max(0, Math.floor(dx)); px < Math.min(canvas.width, Math.ceil(dx + dw)); px++) {
            const srcX = Math.min(source.width - 1, Math.max(0, Math.floor(sx + (px - dx) * sw / dw)));
            const srcY = Math.min(source.height - 1, Math.max(0, Math.floor(sy + (py - dy) * sh / dh)));
            const sourceOffset = (srcY * source.width + srcX) * 4;
            const destOffset = (py * canvas.width + px) * 4;
            const alpha = source.pixels[sourceOffset + 3];
            if (!alpha) continue;
            canvas.pixels.set(source.pixels.subarray(sourceOffset, sourceOffset + 4), destOffset);
          }
        }
      },
      getImageData(x, y, width, height) {
        return { data: canvas.pixels.slice(0, width * height * 4), width, height };
      },
      putImageData(imageData) { canvas.pixels.set(imageData.data); }
    };
  }
}

function makePreprocess() {
  const context = { document: { createElement: () => new MockCanvas() } };
  vm.runInNewContext(`${appSource.slice(start, end)}\nglobalThis.preprocessCanvas = preprocessCanvas;`, context, { filename: 'app-preprocess.js' });
  return context.preprocessCanvas;
}

test('preprocessing ignores transparent blank canvas and crops around real ink', () => {
  const source = new MockCanvas();
  source.width = 200;
  source.height = 80;
  source.clientWidth = 200;
  source.clientHeight = 80;
  // The browser canvas starts transparent; simulate a dark handwritten word.
  for (let y = 30; y <= 45; y++) {
    for (let x = 60; x <= 120; x++) {
      const offset = (y * source.width + x) * 4;
      source.pixels.set([31, 41, 55, 255], offset);
    }
  }

  const result = makePreprocess()(source);
  assert.ok(result.width < 500, `expected cropped output under 500px, got ${result.width}px`);
  assert.ok(result.height < 200, `expected cropped output under 200px, got ${result.height}px`);
  assert.ok(result.pixels.some((channel, index) => index % 4 === 3 && channel === 255), 'processed image should have an opaque background');
});
