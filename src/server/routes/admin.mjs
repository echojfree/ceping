import express from 'express';
import { attachAuth, requireAdmin } from '../auth/middleware.mjs';

export function adminRouter({ env, db }) {
  const r = express.Router();
  r.use(attachAuth({ env, db }));
  r.use(requireAdmin());

  r.get('/overview', (_req, res) => {
    const userCount = db.get('select count(*) as c from users')?.c ?? 0;
    const resultCount = db.get('select count(*) as c from results')?.c ?? 0;
    const assessmentCount = db.get('select count(*) as c from assessments')?.c ?? 0;
    res.json({ userCount, resultCount, assessmentCount });
  });

  r.get('/assessments', (_req, res) => {
    const rows = db.exec(
      `select id, slug, title, description, kind, is_active, created_at
       from assessments
       order by created_at asc`
    );
    res.json({ assessments: rows });
  });

  r.get('/assessments/:id/questions', (req, res) => {
    const rows = db.exec(
      `select id, order_index, prompt, type, options_json, scoring_json, is_active, created_at
       from questions
       where assessment_id = ?
       order by order_index asc`,
      [req.params.id]
    );
    res.json({ questions: rows });
  });

  return r;
}

