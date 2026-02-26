import express from 'express';
import { nanoid } from 'nanoid';
import { attachAuth } from '../auth/middleware.mjs';
import { jsonSizeWithin, parseJson, z } from '../lib/zod.mjs';
import { computeMaxByDim, hollandCode, normalizeScores, scoreAnswers, topDims } from '../scoring/riasec.mjs';
import { buildRecommendations, buildSkillNotes } from '../scoring/recommendations.mjs';
import { computeSkillMax, normalizeSkillScores, scoreSkills, topSkills } from '../scoring/skills.mjs';
import { evaluateQuestionAnswer } from '../scoring/evaluate.mjs';

function now() {
  return new Date().toISOString();
}

function safeJson(s) {
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
}

export function assessmentsRouter({ env, db }) {
  const r = express.Router();
  r.use(attachAuth({ env, db }));

  r.get('/', (_req, res) => {
    const rows = db.exec(
      `select id, slug, title, description, kind, config_json
       from assessments
       where is_active = 1
       order by created_at asc`
    );
    res.json({
      assessments: rows.map((a) => ({ ...a, config: safeJson(a.config_json) }))
    });
  });

  r.get('/:slug', (req, res) => {
    const assessment = db.get('select * from assessments where slug = ? and is_active = 1', [req.params.slug]);
    if (!assessment) return res.status(404).json({ error: 'not_found' });
    const questions = db.exec(
      `select id, prompt, type, options_json, order_index
       from questions
       where assessment_id = ? and is_active = 1
       order by order_index asc`,
      [assessment.id]
    );
    res.json({
      assessment: {
        id: assessment.id,
        slug: assessment.slug,
        title: assessment.title,
        description: assessment.description,
        kind: assessment.kind,
        config: safeJson(assessment.config_json)
      },
      questions: questions.map((q) => ({
        id: q.id,
        prompt: q.prompt,
        type: q.type,
        order: q.order_index,
        options: q.options_json ? safeJson(q.options_json) : null
      }))
    });
  });

  // Per-scene evaluation (no persistence): returns immediate feedback + deltas for skill/riasec scoreboard
  r.post('/:slug/evaluate', (req, res) => {
    const parsed = parseJson(
      req,
      z.object({
        questionId: z.string().min(2),
        value: z.any()
      })
    );
    if (!parsed.ok) return res.status(400).json({ error: 'invalid_input', issues: parsed.issues });
    if (!jsonSizeWithin(parsed.data.value, 10_000)) return res.status(413).json({ error: 'payload_too_large' });

    const assessment = db.get('select * from assessments where slug = ? and is_active = 1', [req.params.slug]);
    if (!assessment) return res.status(404).json({ error: 'not_found' });

    const q = db.get(
      `select id, prompt, type, options_json, scoring_json
       from questions
       where assessment_id = ? and id = ? and is_active = 1`,
      [assessment.id, parsed.data.questionId]
    );
    if (!q) return res.status(404).json({ error: 'question_not_found' });

    const ev = evaluateQuestionAnswer({ question: q, answerValue: parsed.data.value });
    if (!ev.ok) return res.status(400).json({ error: ev.error });

    return res.json({
      evaluation: {
        level: ev.level,
        feedback: ev.feedback,
        riasecDelta: ev.riasecDelta,
        skillsDelta: ev.skillsDelta
      }
    });
  });

  r.post('/:slug/submit', (req, res) => {
    const parsed = parseJson(
      req,
      z.object({
        ageGroup: z.enum(['primary', 'middle', 'secondary', 'adult']).optional(),
        answers: z
          .array(
            z.object({
              questionId: z.string().min(2),
              value: z.any()
            })
          )
          .min(1)
      })
    );
    if (!parsed.ok) return res.status(400).json({ error: 'invalid_input', issues: parsed.issues });
    if (!jsonSizeWithin(parsed.data.answers, 20_000)) return res.status(413).json({ error: 'payload_too_large' });

    const assessment = db.get('select * from assessments where slug = ? and is_active = 1', [req.params.slug]);
    if (!assessment) return res.status(404).json({ error: 'not_found' });

    const questions = db.exec(
      `select id, prompt, type, options_json, scoring_json, order_index
       from questions
       where assessment_id = ? and is_active = 1
       order by order_index asc`,
      [assessment.id]
    );
    if (!questions.length) return res.status(400).json({ error: 'assessment_empty' });

    const raw = scoreAnswers({ questions, answers: parsed.data.answers });
    const maxByDim = computeMaxByDim(questions);
    const pct = normalizeScores(raw, maxByDim);
    const code = hollandCode(raw);
    const top = topDims(raw, 3);

    const skillsRaw = scoreSkills({ questions, answers: parsed.data.answers });
    const maxBySkill = computeSkillMax(questions);
    const skillsPct = normalizeSkillScores(skillsRaw, maxBySkill);
    const skillsTop = topSkills(skillsRaw, 5);

    const ageGroup =
      parsed.data.ageGroup ??
      db.get('select age_group from profiles where user_id = ?', [req.user?.id])?.age_group ??
      'secondary';

    const recommendations = buildRecommendations({
      code,
      top,
      ageGroup,
      assessmentSlug: assessment.slug
    });
    const skillNotes = buildSkillNotes(skillsTop);
    const mergedRecommendations = {
      ...recommendations,
      skillNotes: skillNotes ? `你的技能倾向（从你的选择推断）：\n${skillNotes}` : ''
    };

    const resultId = `r_${nanoid(12)}`;
    db.run(
      `insert into results(id, user_id, assessment_id, age_group, raw_json, riasec_json, skills_json, code, recommendations_json, created_at)
       values(?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        resultId,
        req.user?.id ?? null,
        assessment.id,
        ageGroup,
        JSON.stringify({ answers: parsed.data.answers }),
        JSON.stringify({ raw, maxByDim, pct, top }),
        JSON.stringify({ raw: skillsRaw, maxBySkill, pct: skillsPct, top: skillsTop }),
        code,
        JSON.stringify(mergedRecommendations),
        now()
      ]
    );

    res.json({
      result: {
        id: resultId,
        assessmentSlug: assessment.slug,
        code,
        top,
        raw,
        pct,
        skills: { raw: skillsRaw, pct: skillsPct, top: skillsTop },
        recommendations: mergedRecommendations
      }
    });
  });

  return r;
}
