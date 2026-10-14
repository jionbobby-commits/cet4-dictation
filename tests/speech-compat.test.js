const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');

const source = fs.readFileSync(path.join(__dirname, '..', 'js', 'speech.js'), 'utf8');

function createSpeechHarness({ initialVoices = [], speakBehavior } = {}) {
  let voices = initialVoices;
  const listeners = new Map();
  class Utterance {
    constructor(text) { this.text = text; }
  }
  const synthesis = {
    onvoiceschanged: null,
    getVoices: () => voices,
    addEventListener: (name, listener) => listeners.set(name, listener),
    removeEventListener: (name, listener) => {
      if (listeners.get(name) === listener) listeners.delete(name);
    },
    speak: utterance => speakBehavior?.(utterance),
    cancel() {}
  };
  const context = {
    window: { speechSynthesis: synthesis },
    SpeechSynthesisUtterance: Utterance,
    console: { log() {}, warn() {}, error() {} },
    setTimeout,
    clearTimeout,
    setInterval,
    clearInterval
  };
  vm.runInNewContext(`${source}\nglobalThis.SpeechUtil = SpeechUtil;`, context, { filename: 'speech.js' });
  return {
    util: context.SpeechUtil,
    setVoices(value) { voices = value; },
    fireVoicesChanged() { listeners.get('voiceschanged')?.(); },
    synthesis
  };
}

test('waits for late mobile voice lists and resolves the voiceschanged event', async () => {
  const harness = createSpeechHarness();
  const pending = harness.util.loadVoices();
  const voices = [{ name: 'Android English', lang: 'en_GB' }];
  harness.setVoices(voices);
  harness.fireVoicesChanged();
  assert.equal((await pending).length, 1);
  assert.equal(harness.util.getVoiceList()[0].lang, 'en_GB');
});

test('uses a same-language voice when the requested regional accent is missing', async () => {
  let spoken;
  const harness = createSpeechHarness({
    initialVoices: [{ name: 'Android English', lang: 'en-GB' }],
    speakBehavior: utterance => {
      spoken = utterance;
      queueMicrotask(() => utterance.onend());
    }
  });
  await harness.util.speak('hello', { accent: 'en-US' });
  assert.equal(spoken.voice.lang, 'en-GB');
});

test('stop settles an active speech promise instead of leaving playback pending', async () => {
  const harness = createSpeechHarness({ initialVoices: [{ name: 'English', lang: 'en-US' }] });
  const playback = harness.util.speak('hello');
  harness.util.stop();
  await assert.doesNotReject(playback);
});

test('resolves gracefully when the browser has no speech synthesis API', async () => {
  const context = {
    window: {}, console: { log() {}, warn() {}, error() {} },
    setTimeout, clearTimeout, setInterval, clearInterval
  };
  vm.runInNewContext(`${source}\nglobalThis.SpeechUtil = SpeechUtil;`, context, { filename: 'speech.js' });
  assert.equal((await context.SpeechUtil.loadVoices()).length, 0);
  assert.equal(context.SpeechUtil.isSupported(), false);
});
