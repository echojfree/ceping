import { z } from 'zod';

export function parseJson(req, schema) {
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message }));
    return { ok: false, issues };
  }
  return { ok: true, data: parsed.data };
}

export function jsonSizeWithin(value, maxChars) {
  try {
    const s = JSON.stringify(value);
    return s.length <= maxChars;
  } catch {
    return false;
  }
}

export { z };
