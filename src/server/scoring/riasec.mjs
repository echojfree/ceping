import { evaluateTaskLevel } from './task-levels.mjs';

const DIM_ORDER = ['R', 'I', 'A', 'S', 'E', 'C'];

export function emptyScores() {
  return { R: 0, I: 0, A: 0, S: 0, E: 0, C: 0 };
}

export function addScores(target, delta) {
  for (const dim of DIM_ORDER) {
    target[dim] += Number(delta?.[dim] ?? 0);
  }
}

export function normalizeScores(raw, maxByDim) {
  const pct = {};
  for (const dim of DIM_ORDER) {
    const max = Math.max(1, Number(maxByDim?.[dim] ?? 1));
    const value = Number(raw?.[dim] ?? 0);
    pct[dim] = Math.max(0, Math.min(100, Math.round((value / max) * 100)));
  }
  return pct;
}

export function topDims(raw, n = 3) {
  const entries = DIM_ORDER.map((dim) => [dim, Number(raw?.[dim] ?? 0)]);
  entries.sort((a, b) => {
    const diff = b[1] - a[1];
    if (diff !== 0) return diff;
    return DIM_ORDER.indexOf(a[0]) - DIM_ORDER.indexOf(b[0]);
  });
  return entries.slice(0, n).map(([dim]) => dim);
}

export function hollandCode(raw) {
  return topDims(raw, 3).join('');
}

export function computeMaxByDim(questions) {
  const max = emptyScores();
  for (const q of questions) {
    const scoring = safeJson(q.scoring_json);
    if (q.type === 'likert') {
      const dim = scoring?.dim;
      if (max[dim] !== undefined) max[dim] += 5;
      continue;
    }
    if (q.type === 'single') {
      const byOption = scoring?.scoringByOption ?? {};
      const best = emptyScores();
      for (const opt of Object.values(byOption)) {
        for (const dim of DIM_ORDER) {
          best[dim] = Math.max(best[dim], Number(opt?.[dim] ?? 0));
        }
      }
      addScores(max, best);
      continue;
    }

    if (q.type === 'drag' || q.type === 'fill' || q.type === 'cmd') {
      const byLevel = scoring?.scoringByLevel ?? {};
      const best = emptyScores();
      for (const opt of Object.values(byLevel)) {
        for (const dim of DIM_ORDER) best[dim] = Math.max(best[dim], Number(opt?.[dim] ?? 0));
      }
      addScores(max, best);
    }
  }
  return max;
}

export function scoreAnswers({ questions, answers }) {
  const raw = emptyScores();
  const questionById = new Map(questions.map((q) => [q.id, q]));

  for (const a of answers) {
    const q = questionById.get(a.questionId);
    if (!q) continue;
    const scoring = safeJson(q.scoring_json);

    if (q.type === 'likert') {
      const dim = scoring?.dim;
      const v = Number(a.value);
      if (raw[dim] !== undefined && Number.isFinite(v)) raw[dim] += clamp(v, 1, 5);
      continue;
    }

    if (q.type === 'single') {
      const optId = String(a.value);
      const delta = scoring?.scoringByOption?.[optId];
      addScores(raw, delta);
      continue;
    }

    if (q.type === 'drag') {
      const level = evaluateTaskLevel('drag', scoring, a.value);
      const delta = scoring?.scoringByLevel?.[level];
      addScores(raw, delta);
      continue;
    }

    if (q.type === 'fill') {
      const level = evaluateTaskLevel('fill', scoring, a.value);
      const delta = scoring?.scoringByLevel?.[level];
      addScores(raw, delta);
      continue;
    }

    if (q.type === 'cmd') {
      const level = evaluateTaskLevel('cmd', scoring, a.value);
      const delta = scoring?.scoringByLevel?.[level];
      addScores(raw, delta);
    }
  }

  return raw;
}

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

function safeJson(s) {
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
}
