/**
 * Plan-based lifetime word total.
 * A completed plan contributes its full planned size. Todo and redo plans
 * contribute distinct submitted words linked to that task date. Unmarked
 * plans contribute zero. Skips are attempts, not completed words.
 */
function calculatePlanWordsLearned(plans, records, getEffectiveStatus) {
  const wordsByTask = new Map();
  records.forEach(record => {
    (record.words || []).forEach(word => {
      if (!word.en || word.isSkipped || word.userAnswer === '(跳过)') return;
      const taskDate = word.taskDate || record.taskDate || record.date;
      if (!taskDate) return;
      if (!wordsByTask.has(taskDate)) wordsByTask.set(taskDate, new Set());
      wordsByTask.get(taskDate).add(word.en.trim().toLowerCase());
    });
  });

  return plans.reduce((total, plan) => {
    const status = getEffectiveStatus(plan);
    if (status === 'done' || status === '✓') return total + (plan.wordCount || 0);
    if (status === 'todo' || status === 'redo') {
      return total + (wordsByTask.get(plan.date)?.size || 0);
    }
    return total;
  }, 0);
}

/** Summarize plan task states without changing or persisting those states. */
function summarizePlanStatuses(plans, getEffectiveStatus) {
  const summary = { total: plans.length, done: 0, todo: 0, redo: 0, unmarked: 0 };
  plans.forEach(plan => {
    const status = getEffectiveStatus(plan);
    if (status === 'done' || status === '✓') summary.done++;
    else if (status === 'redo') summary.redo++;
    else if (status === 'unmarked') summary.unmarked++;
    else summary.todo++;
  });
  summary.progress = summary.total ? Math.round(summary.done / summary.total * 100) : 0;
  return summary;
}
