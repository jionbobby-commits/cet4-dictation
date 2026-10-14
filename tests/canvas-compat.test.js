const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');

const source = fs.readFileSync(path.join(__dirname, '..', 'js', 'canvas.js'), 'utf8');

function createCanvasHarness() {
  const listeners = new Map();
  const arcs = [];
  const lines = [];
  const transforms = [];
  const context2d = {
    setTransform: (...args) => transforms.push(args),
    beginPath() {}, arc: (...args) => arcs.push(args), fill() {},
    moveTo() {}, lineTo: (...args) => lines.push(args), stroke() {},
    drawImage() {}, clearRect() {}, getImageData: () => ({ data: new Uint8ClampedArray(4) })
  };
  const canvas = {
    width: 0, height: 0, clientWidth: 100, clientHeight: 60,
    clientLeft: 1, clientTop: 1, style: {},
    getContext: () => context2d,
    getBoundingClientRect: () => ({ left: 10, top: 20, width: 102, height: 62 }),
    addEventListener: (name, listener) => listeners.set(name, listener),
    setPointerCapture() {}, toDataURL: () => 'data:image/png;base64,test'
  };
  const window = { devicePixelRatio: 2, addEventListener() {} };
  const context = {
    window,
    document: { createElement: () => ({ width: 0, height: 0, getContext: () => ({ drawImage() {} }) }) },
    console: { warn() {} }, Image: class {}
  };
  vm.runInNewContext(`${source}\nglobalThis.DrawCanvas = DrawCanvas;`, context, { filename: 'canvas.js' });
  context.DrawCanvas.init(canvas);
  return { canvas, listeners, arcs, lines, transforms };
}

function pointerEvent(pointerId, clientX, clientY, extras = {}) {
  return { pointerId, clientX, clientY, pointerType: 'touch', isPrimary: true, preventDefault() {}, ...extras };
}

test('draw coordinates account for canvas borders and remain in CSS pixels at high DPR', () => {
  const harness = createCanvasHarness();
  harness.listeners.get('pointerdown')(pointerEvent(1, 31, 42));
  assert.deepEqual(harness.arcs[0], [20, 21, 3.5, 0, Math.PI * 2]);
  assert.deepEqual(harness.transforms[0], [2, 0, 0, 2, 0, 0]);
  harness.listeners.get('pointermove')(pointerEvent(1, 41, 52));
  assert.deepEqual(harness.lines[0], [30, 31]);
});

test('ignores secondary fingers and closes the stroke on touch cancellation', () => {
  const harness = createCanvasHarness();
  harness.listeners.get('pointerdown')(pointerEvent(1, 31, 42));
  harness.listeners.get('pointerdown')(pointerEvent(2, 51, 62, { isPrimary: false }));
  harness.listeners.get('pointermove')(pointerEvent(2, 61, 72, { isPrimary: false }));
  assert.equal(harness.arcs.length, 1);
  assert.equal(harness.lines.length, 0);
  harness.listeners.get('pointercancel')(pointerEvent(1, 31, 42));
  harness.listeners.get('pointermove')(pointerEvent(1, 41, 52));
  assert.equal(harness.lines.length, 0, 'cancelled touch should not continue drawing');
});
