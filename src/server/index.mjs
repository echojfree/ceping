import { createServer } from 'node:http';
import { createApp } from './app.mjs';
import { loadEnv } from './lib/env.mjs';
import { ensureDataDir } from './lib/fs.mjs';
import { openDb, seedIfNeeded } from './storage/db.mjs';

const env = loadEnv(process.env);
await ensureDataDir(env.DATA_DIR);

const db = await openDb({ filePath: env.DB_FILE });
await seedIfNeeded(db, env);

const app = await createApp({ env, db });
const server = createServer(app);

server.listen(env.PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`[CareerVerse] http://localhost:${env.PORT}  (admin: /admin)`);
});

