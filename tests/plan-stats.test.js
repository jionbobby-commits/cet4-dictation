const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');

const source = fs.readFileSync(path.join(__dirname, '..', 'js', 'plan_stats.js'), 'utf8');
const context = {};
vm.runInNewContext(source, context, { filename: 'plan_stats.js' });
const calculate = context.calculatePlanWordsLearned;
const summarize = context.summarizePlanStatuses;
const statusOf = plan => plan.status;

test('completed tasks use planned size; todo and redo count distinct submitted words; unmarked counts zero', () => {
  const plans = [
    { date: '2026-10-12', status: 'done', wordCount: 12 },
    { date: '2026-10-13', status: 'todo', wordCount: 10 },
    { date: '2026-10-14', status: 'redo', wordCount: 10 },
    { date: '2026-10-15', status: 'unmarked', wordCount: 10 }
  ];
  const records = [{ date: '2026-10-20', words: [
    { en: 'Apple', taskDate: '2026-10-13' },
    { en: 'apple', taskDate: '2026-10-13' },
    { en: 'pear', taskDate: '2026-10-13' },
    { en: 'pear', taskDate: '2026-10-14' },
    { en: 'plum', taskDate: '2026-10-14', isSkipped: true },
    { en: 'lime', taskDate: '2026-10-15' }
  ] }];

  assert.equal(calculate(plans, records, statusOf), 15);
});

test('the same word is counted once per task, not once globally', () => {
  const plans = [
    { date: '2026-10-12', status: 'todo', wordCount: 3 },
    { date: '2026-10-13', status: 'redo', wordCount: 3 }
  ];
  const records = [{ date: '2026-10-14', words: [
    { en: 'focus', taskDate: '2026-10-12' },
    { en: 'focus', taskDate: '2026-10-13' }
  ] }];

  assert.equal(calculate(plans, records, statusOf), 2);
});

test('legacy records fall back to their recorded date and skipped legacy answers do not count', () => {
  const plans = [{ date: '2026-10-12', status: 'todo', wordCount: 5 }];
  const records = [{ date: '2026-10-12', words: [
    { en: 'listen' },
    { en: 'skip', userAnswer: '(跳过)' }
  ] }];

  assert.equal(calculate(plans, records, statusOf), 1);
});

test('plan summary counts all four states and computes completion from completed days only', () => {
  const plans = [
    { status: 'done' }, { status: '✓' },
    { status: 'todo' }, { status: 'redo' }, { status: 'unmarked' }
  ];
  assert.deepEqual(JSON.parse(JSON.stringify(summarize(plans, statusOf))), {
    total: 5, done: 2, todo: 1, redo: 1, unmarked: 1, progress: 40
  });
});

test('empty plan summary reports zero progress', () => {
  assert.deepEqual(JSON.parse(JSON.stringify(summarize([], statusOf))), {
    total: 0, done: 0, todo: 0, redo: 0, unmarked: 0, progress: 0
  });
});


test('rest days do not affect plan progress and records from a different plan are not applied', () => {
  const plans = [
    { date: '2026-10-12', planId: 'new', status: 'todo', wordCount: 5 },
    { date: '2026-10-13', planId: 'new', isRestDay: true, status: 'unmarked', wordCount: 0 }
  ];
  const records = [{ date: '2026-10-12', words: [
    { en: 'old-word', taskDate: '2026-10-12', taskPlanId: 'old' },
    { en: 'new-word', taskDate: '2026-10-12', taskPlanId: 'new' }
  ] }];
  assert.equal(calculate(plans, records, statusOf), 1);
  assert.deepEqual(JSON.parse(JSON.stringify(summarize(plans, statusOf))), {
    total: 1, done: 0, todo: 1, redo: 0, unmarked: 0, progress: 0
  });
});
