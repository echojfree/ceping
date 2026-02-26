import { getAuthCookieName, verifyAuthToken } from './jwt.mjs';

export function attachAuth({ env, db }) {
  return (req, _res, next) => {
    try {
      const token = req.cookies?.[getAuthCookieName()];
      if (!token) return next();
      const payload = verifyAuthToken(env, token);
      if (!payload?.sub) return next();
      const user = db.get(
        'select id, email, role, display_name, created_at from users where id = ?',
        [payload.sub]
      );
      if (!user) return next();
      req.user = user;
      return next();
    } catch {
      return next();
    }
  };
}

export function requireAuth() {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'unauthorized' });
    return next();
  };
}

export function requireAdmin() {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'unauthorized' });
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'forbidden' });
    return next();
  };
}

