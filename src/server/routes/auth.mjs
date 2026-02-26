import express from 'express';
import bcrypt from 'bcryptjs';
import { nanoid } from 'nanoid';
import { parseJson, z } from '../lib/zod.mjs';
import { attachAuth } from '../auth/middleware.mjs';
import { getAuthCookieName, signAuthToken } from '../auth/jwt.mjs';

function now() {
  return new Date().toISOString();
}

export function authRouter({ env, db }) {
  const r = express.Router();
  r.use(attachAuth({ env, db }));

  r.get('/me', (req, res) => {
    if (!req.user) return res.json({ user: null, profile: null });
    const profile = db.get('select * from profiles where user_id = ?', [req.user.id]);
    return res.json({ user: req.user, profile });
  });

  r.post('/register', (req, res) => {
    const parsed = parseJson(
      req,
      z.object({
        email: z.string().email(),
        password: z.string().min(6).max(72),
        displayName: z.string().min(1).max(30).optional(),
        ageGroup: z.enum(['primary', 'middle', 'secondary', 'adult']).optional()
      })
    );
    if (!parsed.ok) return res.status(400).json({ error: 'invalid_input', issues: parsed.issues });

    const { email, password, displayName, ageGroup } = parsed.data;
    const existing = db.get('select id from users where email = ?', [email.toLowerCase()]);
    if (existing) return res.status(409).json({ error: 'email_taken' });

    const userId = `u_${nanoid(10)}`;
    const hash = bcrypt.hashSync(password, 10);
    db.run(
      `insert into users(id, email, password_hash, role, display_name, created_at)
       values(?, ?, ?, ?, ?, ?)`,
      [userId, email.toLowerCase(), hash, 'user', displayName ?? null, now()]
    );
    db.run(
      `insert into profiles(user_id, age_group, updated_at)
       values(?, ?, ?)`,
      [userId, ageGroup ?? null, now()]
    );

    const token = signAuthToken(env, { sub: userId, role: 'user' });
    res.cookie(getAuthCookieName(), token, {
      httpOnly: true,
      sameSite: 'strict',
      secure: false,
      maxAge: 7 * 24 * 60 * 60 * 1000
    });
    return res.json({ ok: true });
  });

  r.post('/login', (req, res) => {
    const parsed = parseJson(
      req,
      z.object({
        email: z.string().min(3).max(200),
        password: z.string().min(1).max(72)
      })
    );
    if (!parsed.ok) return res.status(400).json({ error: 'invalid_input', issues: parsed.issues });

    const { email, password } = parsed.data;
    const user = db.get('select * from users where email = ?', [email.toLowerCase()]);
    if (!user) return res.status(401).json({ error: 'invalid_credentials' });
    const ok = bcrypt.compareSync(password, user.password_hash);
    if (!ok) return res.status(401).json({ error: 'invalid_credentials' });

    const token = signAuthToken(env, { sub: user.id, role: user.role });
    res.cookie(getAuthCookieName(), token, {
      httpOnly: true,
      sameSite: 'strict',
      secure: false,
      maxAge: 7 * 24 * 60 * 60 * 1000
    });
    return res.json({ ok: true });
  });

  r.post('/logout', (_req, res) => {
    res.clearCookie(getAuthCookieName());
    res.json({ ok: true });
  });

  return r;
}

