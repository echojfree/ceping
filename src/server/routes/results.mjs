import express from 'express';
import { attachAuth, requireAdmin } from '../auth/middleware.mjs';
import QRCode from 'qrcode';

function safeJson(s) {
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
}

export function resultsRouter({ env, db }) {
  const r = express.Router();
  r.use(attachAuth({ env, db }));

  r.get('/:id', (req, res) => {
    const row = db.get('select * from results where id = ?', [req.params.id]);
    if (!row) return res.status(404).json({ error: 'not_found' });

    // Local-first kiosk system: allow reading anonymous results; restrict personal ones.
    if (row.user_id && row.user_id !== req.user?.id && req.user?.role !== 'admin') {
      return res.status(403).json({ error: 'forbidden' });
    }

    return res.json({
      result: {
        id: row.id,
        assessmentId: row.assessment_id,
        ageGroup: row.age_group,
        code: row.code,
        createdAt: row.created_at,
        raw: safeJson(row.raw_json),
        riasec: safeJson(row.riasec_json),
        skills: safeJson(row.skills_json),
        recommendations: safeJson(row.recommendations_json)
      }
    });
  });

  r.get('/:id/qr', async (req, res, next) => {
    try {
      const row = db.get('select * from results where id = ?', [req.params.id]);
      if (!row) return res.status(404).json({ error: 'not_found' });
      if (row.user_id && row.user_id !== req.user?.id && req.user?.role !== 'admin') {
        return res.status(403).json({ error: 'forbidden' });
      }

      const url = `${env.BASE_URL.replace(/\/$/, '')}/tasks?resultId=${encodeURIComponent(row.id)}`;
      const svg = await QRCode.toString(url, { type: 'svg', margin: 1, width: 256 });
      res.setHeader('content-type', 'image/svg+xml; charset=utf-8');
      return res.send(svg);
    } catch (err) {
      return next(err);
    }
  });

  // Admin: list recent results
  r.get('/', requireAdmin(), (req, res) => {
    const limit = Math.max(1, Math.min(200, Number(req.query.limit ?? 50)));
    const rows = db.exec(
      `select r.id, r.created_at, r.code, r.age_group, a.slug as assessment_slug, a.title as assessment_title,
              u.email as user_email
       from results r
       join assessments a on a.id = r.assessment_id
       left join users u on u.id = r.user_id
       order by r.created_at desc
       limit ?`,
      [limit]
    );
    res.json({ results: rows });
  });

  return r;
}
