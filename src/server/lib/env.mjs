import path from 'node:path';

export function loadEnv(env) {
  const rootDir = process.cwd();
  const nodeEnv = env.NODE_ENV ?? 'development';
  const port = Number(env.PORT ?? 5180);
  const dataDir = env.DATA_DIR ?? path.join(rootDir, 'data');
  const dbFile = env.DB_FILE ?? path.join(dataDir, 'careerverse.sqlite');

  return {
    ROOT_DIR: rootDir,
    NODE_ENV: nodeEnv,
    PORT: Number.isFinite(port) ? port : 5180,
    DATA_DIR: dataDir,
    DB_FILE: dbFile,
    BASE_URL: env.BASE_URL ?? `http://localhost:${port}`,
    JWT_SECRET: env.JWT_SECRET ?? 'dev-insecure-change-me',
    ADMIN_EMAIL: env.ADMIN_EMAIL ?? 'admin@local',
    ADMIN_PASSWORD: env.ADMIN_PASSWORD ?? 'admin123456',
    OLLAMA_BASE_URL: env.OLLAMA_BASE_URL ?? 'http://127.0.0.1:11434',
    OLLAMA_MODEL: env.OLLAMA_MODEL ?? 'qwen2.5:7b-instruct',
    LOG_PRETTY: env.LOG_PRETTY === '1'
  };
}
