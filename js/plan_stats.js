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
      const taskKey = `${taskDate}:${word.taskPlanId || ''}`;
      if (!wordsByTask.has(taskKey)) wordsByTask.set(taskKey, new Set());
      wordsByTask.get(taskKey).add(word.en.trim().toLowerCase());
    });
  });

  return plans.reduce((total, plan) => {
    if (plan.isRestDay) return total;
    const status = getEffectiveStatus(plan);
    if (status === 'done' || status === '✓') return total + (plan.wordCount || 0);
    if (status === 'todo' || status === 'redo') {
      const taskKey = `${plan.date}:${plan.planId || ''}`;
      return total + (wordsByTask.get(taskKey)?.size || 0);
    }
    return total;
  }, 0);
}

/** Summarize plan task states without changing or persisting those states. */
function summarizePlanStatuses(plans, getEffectiveStatus) {
  const studyPlans = plans.filter(plan => !plan.isRestDay);
  const summary = { total: studyPlans.length, done: 0, todo: 0, redo: 0, unmarked: 0 };
  studyPlans.forEach(plan => {
    const status = getEffectiveStatus(plan);
    if (status === 'done' || status === '✓') summary.done++;
    else if (status === 'redo') summary.redo++;
    else if (status === 'unmarked') summary.unmarked++;
    else summary.todo++;
  });
  summary.progress = summary.total ? Math.round(summary.done / summary.total * 100) : 0;
  return summary;
}
