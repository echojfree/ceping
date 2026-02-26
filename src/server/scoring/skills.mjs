import { evaluateTaskLevel } from './task-levels.mjs';

export const SKILL_KEYS = [
  'data_literacy',
  'analysis',
  'experiment',
  'design_literacy',
  'copywriting',
  'communication',
  'empathy',
  'process',
  'risk_control',
  'planning',
  'execution',
  'store_ops',
  'leadership'
];

const SKILL_CN = {
  data_literacy: '数据素养',
  analysis: '分析推理',
  experiment: '实验与验证',
  design_literacy: '视觉与信息表达',
  copywriting: '文案表达',
  communication: '沟通协作',
  empathy: '共情服务',
  process: '流程与规范',
  risk_control: '风险与合规',
  planning: '目标与规划',
  execution: '现场执行',
  store_ops: '门店运营',
  leadership: '推动与带队'
};

export function emptySkillScores() {
  const out = {};
  for (const k of SKILL_KEYS) out[k] = 0;
  return out;
}

export function scoreSkills({ questions, answers }) {
  const raw = emptySkillScores();
  const qMap = new Map(questions.map((q) => [q.id, q]));

  for (const a of answers) {
    const q = qMap.get(a.questionId);
    if (!q) continue;
    const scoring = safeJson(q.scoring_json);
    if (q.type === 'single') {
      const optId = String(a.value);
      const delta = scoring?.skillsByOption?.[optId];
      if (!delta) continue;
      for (const k of SKILL_KEYS) raw[k] += Number(delta?.[k] ?? 0);
      continue;
    }

    if (q.type === 'drag' || q.type === 'fill' || q.type === 'cmd') {
      const level = evaluateTaskLevel(q.type, scoring, a.value);
      const delta = scoring?.skillsByLevel?.[level];
      if (!delta) continue;
      for (const k of SKILL_KEYS) raw[k] += Number(delta?.[k] ?? 0);
    }
  }

  return raw;
}

export function computeSkillMax(questions) {
  const max = emptySkillScores();
  for (const q of questions) {
    const scoring = safeJson(q.scoring_json);
    if (q.type === 'single') {
      const byOption = scoring?.skillsByOption ?? {};
      const best = emptySkillScores();
      for (const opt of Object.values(byOption)) {
        for (const k of SKILL_KEYS) best[k] = Math.max(best[k], Number(opt?.[k] ?? 0));
      }
      for (const k of SKILL_KEYS) max[k] += best[k];
      continue;
    }

    if (q.type === 'drag' || q.type === 'fill' || q.type === 'cmd') {
      const byLevel = scoring?.skillsByLevel ?? {};
      const best = emptySkillScores();
      for (const opt of Object.values(byLevel)) {
        for (const k of SKILL_KEYS) best[k] = Math.max(best[k], Number(opt?.[k] ?? 0));
      }
      for (const k of SKILL_KEYS) max[k] += best[k];
    }
  }
  return max;
}

export function normalizeSkillScores(raw, maxBySkill) {
  const pct = {};
  for (const k of SKILL_KEYS) {
    const max = Math.max(1, Number(maxBySkill?.[k] ?? 1));
    const v = Number(raw?.[k] ?? 0);
    pct[k] = Math.max(0, Math.min(100, Math.round((v / max) * 100)));
  }
  return pct;
}

export function topSkills(raw, n = 5) {
  const entries = SKILL_KEYS.map((k) => [k, Number(raw?.[k] ?? 0)]);
  entries.sort((a, b) => b[1] - a[1]);
  return entries.slice(0, n).map(([k]) => k);
}

export function skillLabel(key) {
  return SKILL_CN[key] ?? key;
}

function safeJson(s) {
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
}
