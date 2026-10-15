const assert = require('node:assert/strict');
const test = require('node:test');
const PlanEngine = require('../js/plan_engine.js');

const makeWords = count => Array.from({ length: count }, (_, i) => ({ en: `word${i}`, cn: `词${i}` }));

test('fixed annual deadlines include cutoff dates and roll after September 10', () => {
  const cases = [
    ['2026-01-15', '2026-06-10'],
    ['2026-06-10', '2026-06-10'],
    ['2026-06-11', '2026-09-10'],
    ['2026-09-10', '2026-09-10'],
    ['2026-09-11', '2027-06-10'],
    ['2026-12-01', '2027-06-10']
  ];
  for (const [start, expected] of cases) assert.equal(PlanEngine.getPlanDeadline(start), expected);
});

test('six study days then one rest day repeats from a non-Monday start', () => {
  const days = PlanEngine.getStudyCalendar('2026-06-11', '2026-06-25');
  assert.deepEqual(days.map(day => day.isStudyDay), [true, true, true, true, true, true, false, true, true, true, true, true, true, false, true]);
  assert.equal(new Date(2026, 5, 11).getDay(), 4); // Thursday
  assert.equal(days[6].date, '2026-06-17');
  assert.equal(days[13].date, '2026-06-24');
});

test('start date equal to deadline is one study day; cutoff may be a rest day', () => {
  const sameDay = PlanEngine.generateLearningPlan({ startDate: '2026-06-10', words: makeWords(3) });
  assert.equal(sameDay.days.length, 1);
  assert.equal(sameDay.days[0].isStudyDay, true);
  assert.equal(sameDay.days[0].wordCount, 3);
  const restCutoff = PlanEngine.generateLearningPlan({ startDate: '2026-01-01', words: [] });
  assert.equal(restCutoff.days.at(-1).date, '2026-06-10');
  assert.equal(restCutoff.days.at(-1).isRestDay, true);
});

test('word allocation is exact and balanced for divisible, remainder, and fewer words than days', () => {
  const days = PlanEngine.getStudyCalendar('2026-06-11', '2026-06-25').filter(day => day.isStudyDay);
  for (const count of [13, 17, 3]) {
    const words = makeWords(count);
    const allocation = PlanEngine.distributeWords(words, days);
    const assigned = allocation.flatMap(day => day.words);
    assert.equal(assigned.length, count);
    assert.deepEqual(assigned.map(word => word.en), words.map(word => word.en));
    const counts = allocation.map(day => day.wordCount);
    assert.ok(Math.max(...counts) - Math.min(...counts) <= 1);
  }
  assert.deepEqual(PlanEngine.distributeWords(makeWords(17), days).map(day => day.wordCount), [2, 2, 2, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1]);
});

test('duplicate source entries are preserved rather than silently removed', () => {
  const words = [{ en: 'same', cn: '甲' }, { en: 'same', cn: '乙' }, { en: 'last', cn: '丙' }];
  const days = PlanEngine.getStudyCalendar('2026-06-10', '2026-06-10');
  const assigned = PlanEngine.distributeWords(words, days);
  assert.deepEqual(assigned[0].words, words);
});

test('changing the start date regenerates identical plan and dictation calendars and stable assignments', () => {
  const words = makeWords(2089);
  const first = PlanEngine.generateLearningPlan({ startDate: '2026-01-15', words });
  const changed = PlanEngine.generateLearningPlan({ startDate: '2026-06-11', words });
  const reloaded = PlanEngine.generateLearningPlan({ startDate: '2026-06-11', words });
  assert.notEqual(first.deadline, changed.deadline);
  assert.notEqual(first.days.length, changed.days.length);
  assert.deepEqual(PlanEngine.syncDictationDates(changed).map(day => day.date), changed.days.map(day => day.date));
  assert.equal(changed.planId, reloaded.planId);
  assert.deepEqual(changed.days.map(day => day.words.map(word => word.en)), reloaded.days.map(day => day.words.map(word => word.en)));
  const studyDays = changed.days.filter(day => day.isStudyDay);
  const assigned = studyDays.flatMap(day => day.words);
  assert.equal(assigned.length, words.length);
  assert.deepEqual(assigned.map(word => word.en), words.map(word => word.en));
  assert.ok(Math.max(...studyDays.map(day => day.wordCount)) - Math.min(...studyDays.map(day => day.wordCount)) <= 1);
  assert.ok(changed.days.filter(day => day.isRestDay).every(day => day.words.length === 0 && day.wordCount === 0));
});

test('local date parsing rejects invalid days and preserves local calendar dates', () => {
  assert.throws(() => PlanEngine.parseLocalDate('2026-02-30'), /Invalid date/);
  const days = PlanEngine.getStudyCalendar('2026-12-31', '2027-01-03');
  assert.deepEqual(days.map(day => day.date), ['2026-12-31', '2027-01-01', '2027-01-02', '2027-01-03']);
});

