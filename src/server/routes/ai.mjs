import express from 'express';
import { attachAuth } from '../auth/middleware.mjs';
import { parseJson, z } from '../lib/zod.mjs';
import { aiReply } from '../ai/index.mjs';

export function aiRouter({ env, db }) {
  const r = express.Router();
  r.use(attachAuth({ env, db }));

  r.post('/chat', async (req, res, next) => {
    try {
      const parsed = parseJson(
        req,
        z.object({
          resultId: z.string().min(2).optional(),
          ageGroup: z.enum(['primary', 'middle', 'secondary', 'adult']).optional(),
          userText: z.string().min(1).max(2000),
          messages: z
            .array(z.object({ role: z.enum(['system', 'user', 'assistant']), content: z.string().max(4000) }))
            .optional()
        })
      );
      if (!parsed.ok) return res.status(400).json({ error: 'invalid_input', issues: parsed.issues });

      const reply = await aiReply({
        env,
        db,
        userText: parsed.data.userText,
        resultId: parsed.data.resultId,
        messages: parsed.data.messages,
        ageGroup: parsed.data.ageGroup
      });
      return res.json({ reply });
    } catch (err) {
      return next(err);
    }
  });

  return r;
}

