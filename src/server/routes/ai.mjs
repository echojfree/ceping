import express from 'express';
import { attachAuth } from '../auth/middleware.mjs';
import { jsonSizeWithin, parseJson, z } from '../lib/zod.mjs';
import { aiReply, aiSceneCoach, aiSceneCoachStream } from '../ai/index.mjs';

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

  r.post('/coach', async (req, res, next) => {
    try {
      const parsed = parseJson(
        req,
        z.object({
          moduleSlug: z.string().min(2).max(64),
          scenePrompt: z.string().min(1).max(800),
          sceneIndex: z.number().int().min(0).max(99),
          sceneTotal: z.number().int().min(1).max(99),
          answerSummary: z.string().max(800).optional(),
          evaluation: z
            .object({
              level: z.string().max(40).optional(),
              feedback: z.string().max(800).optional(),
              skillsDelta: z.record(z.number()).optional(),
              riasecDelta: z.record(z.number()).optional()
            })
            .optional()
        })
      );
      if (!parsed.ok) return res.status(400).json({ error: 'invalid_input', issues: parsed.issues });
      if (!jsonSizeWithin(parsed.data, 6000)) return res.status(413).json({ error: 'payload_too_large' });

      const reply = await aiSceneCoach({ env, context: parsed.data });
      return res.json({ reply });
    } catch (err) {
      return next(err);
    }
  });

  r.post('/coach/stream', async (req, res, next) => {
    try {
      const parsed = parseJson(
        req,
        z.object({
          moduleSlug: z.string().min(2).max(64),
          scenePrompt: z.string().min(1).max(800),
          sceneIndex: z.number().int().min(0).max(99),
          sceneTotal: z.number().int().min(1).max(99),
          answerSummary: z.string().max(800).optional(),
          evaluation: z
            .object({
              level: z.string().max(40).optional(),
              feedback: z.string().max(800).optional(),
              skillsDelta: z.record(z.number()).optional(),
              riasecDelta: z.record(z.number()).optional()
            })
            .optional()
        })
      );
      if (!parsed.ok) return res.status(400).json({ error: 'invalid_input', issues: parsed.issues });
      if (!jsonSizeWithin(parsed.data, 6000)) return res.status(413).json({ error: 'payload_too_large' });

      const controller = new AbortController();
      req.on('close', () => controller.abort());

      const { provider, stream } = await aiSceneCoachStream({ env, context: parsed.data, signal: controller.signal });
      res.status(200);
      res.setHeader('content-type', 'text/plain; charset=utf-8');
      res.setHeader('cache-control', 'no-cache, no-transform');
      res.setHeader('x-ai-provider', provider);
      res.flushHeaders?.();

      try {
        for await (const chunk of stream) {
          res.write(String(chunk));
        }
        res.end();
      } catch (err) {
        // If client disconnects mid-stream, avoid bubbling to the JSON error handler.
        if (controller.signal.aborted) return res.end();
        throw err;
      }
    } catch (err) {
      return next(err);
    }
  });

  return r;
}
