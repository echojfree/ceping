import fs from 'node:fs/promises';

export async function ensureDataDir(dir) {
  await fs.mkdir(dir, { recursive: true });
}

