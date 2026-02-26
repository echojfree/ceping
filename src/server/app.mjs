import path from 'node:path';
import express from 'express';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import pino from 'pino-http';

import { authRouter } from './routes/auth.mjs';
import { assessmentsRouter } from './routes/assessments.mjs';
import { resultsRouter } from './routes/results.mjs';
import { aiRouter } from './routes/ai.mjs';
import { adminRouter } from './routes/admin.mjs';

export async function createApp({ env, db }) {
  const app = express();
  app.disable('x-powered-by');

  app.use(
    pino({
      logger: env.LOG_PRETTY
        ? undefined
        : undefined
    })
  );
  // Prototype pages rely on CDN scripts/styles (Tailwind/Chart.js/icons).
  // For a local-first offline kiosk, it's more important to "work out of the box"
  // than to ship a strict CSP by default.
  app.use(
    helmet({
      contentSecurityPolicy: false,
      crossOriginResourcePolicy: { policy: 'cross-origin' }
    })
  );
  app.use(express.json({ limit: '1mb' }));
  app.use(cookieParser());

  app.get('/api/health', (req, res) => {
    res.json({ ok: true, time: new Date().toISOString() });
  });

  app.use('/api/auth', authRouter({ env, db }));
  app.use('/api/assessments', assessmentsRouter({ env, db }));
  app.use('/api/results', resultsRouter({ env, db }));
  app.use('/api/ai', aiRouter({ env, db }));
  app.use('/api/admin', adminRouter({ env, db }));

  // Pages (explicit, avoid serving server source code)
  const rootDir = env.ROOT_DIR;
  const publicDir = path.join(rootDir, 'public');

  app.get('/', (req, res) => res.sendFile(path.join(rootDir, 'index.html')));
  app.get('/quiz', (req, res) => res.sendFile(path.join(publicDir, 'quiz.html')));
  app.get('/admin', (req, res) => res.sendFile(path.join(publicDir, 'admin.html')));
  app.get('/tasks', (req, res) => res.sendFile(path.join(publicDir, 'tasks.html')));

  app.use('/public', express.static(publicDir, { maxAge: env.NODE_ENV === 'production' ? '1h' : 0 }));

  // Legacy assets directory (if any)
  app.use('/assets', express.static(path.join(rootDir, 'assets'), { maxAge: '1h' }));

  app.use((req, res) => {
    res.status(404).json({ error: 'not_found' });
  });

  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => {
    req.log?.error({ err }, 'Unhandled error');
    res.status(500).json({ error: 'internal_error' });
  });

  return app;
}
