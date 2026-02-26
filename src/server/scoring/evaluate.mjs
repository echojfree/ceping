import { emptyScores } from './riasec.mjs';
import { emptySkillScores } from './skills.mjs';
import { evaluateTaskLevel } from './task-levels.mjs';

export function evaluateQuestionAnswer({ question, answerValue }) {
  const scoring = safeJson(question.scoring_json) ?? {};
  const riasecDelta = emptyScores();
  const skillsDelta = emptySkillScores();

  if (question.type === 'likert') {
    // Likert is used in RIASEC quick quiz, we don't do per-scene feedback here.
    return { ok: true, level: 'n/a', riasecDelta, skillsDelta, feedback: '' };
  }

  if (question.type === 'single') {
    const optId = String(answerValue);
    addDelta(riasecDelta, scoring?.scoringByOption?.[optId]);
    addDelta(skillsDelta, scoring?.skillsByOption?.[optId]);
    const feedback = scoring?.feedbackByOption?.[optId] ?? '';
    return { ok: true, level: 'chosen', riasecDelta, skillsDelta, feedback };
  }

  if (question.type === 'drag' || question.type === 'fill' || question.type === 'cmd') {
    const level = evaluateTaskLevel(question.type, scoring, answerValue);
    addDelta(riasecDelta, scoring?.scoringByLevel?.[level]);
    addDelta(skillsDelta, scoring?.skillsByLevel?.[level]);
    const feedback = scoring?.feedbackByLevel?.[level] ?? '';
    return { ok: true, level, riasecDelta, skillsDelta, feedback };
  }

  return { ok: false, error: 'unsupported_question_type' };
}

function addDelta(target, delta) {
  if (!delta) return;
  for (const [k, v] of Object.entries(delta)) {
    if (target[k] === undefined) continue;
    target[k] += Number(v ?? 0);
  }
}

function safeJson(s) {
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
}

