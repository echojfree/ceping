import jwt from 'jsonwebtoken';

const COOKIE_NAME = 'cv_token';

export function getAuthCookieName() {
  return COOKIE_NAME;
}

export function signAuthToken(env, payload) {
  return jwt.sign(payload, env.JWT_SECRET, { expiresIn: '7d' });
}

export function verifyAuthToken(env, token) {
  return jwt.verify(token, env.JWT_SECRET);
}

