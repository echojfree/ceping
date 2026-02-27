import fs from 'node:fs/promises';
import path from 'node:path';

async function pathExists(p) {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

async function copyFileSafe(src, dest) {
  if (!(await pathExists(src))) {
    throw new Error(`Missing file: ${src}`);
  }
  await fs.mkdir(path.dirname(dest), { recursive: true });
  await fs.copyFile(src, dest);
}

async function copyDirIfExists(src, dest) {
  if (!(await pathExists(src))) return;
  await fs.mkdir(path.dirname(dest), { recursive: true });
  await fs.cp(src, dest, { recursive: true });
}

async function main() {
  const rootDir = process.cwd();
  const distDir = path.join(rootDir, 'dist');

  await fs.rm(distDir, { recursive: true, force: true });
  await fs.mkdir(distDir, { recursive: true });

  await copyFileSafe(path.join(rootDir, 'index.html'), path.join(distDir, 'index.html'));
  await copyDirIfExists(path.join(rootDir, 'public'), path.join(distDir, 'public'));
  await copyDirIfExists(path.join(rootDir, 'assets'), path.join(distDir, 'assets'));

  const routes = [
    { route: 'quiz', source: path.join(rootDir, 'public', 'quiz.html') },
    { route: 'admin', source: path.join(rootDir, 'public', 'admin.html') },
    { route: 'tasks', source: path.join(rootDir, 'public', 'tasks.html') }
  ];

  for (const r of routes) {
    await copyFileSafe(r.source, path.join(distDir, r.route, 'index.html'));
  }

  const buildInfo = {
    builtAt: new Date().toISOString(),
    node: process.version,
    note: 'Static export (Nginx-ready). APIs under /api still require a backend service.'
  };
  await fs.writeFile(path.join(distDir, '.buildinfo.json'), JSON.stringify(buildInfo, null, 2), 'utf8');

  // eslint-disable-next-line no-console
  console.log(`[build-static] Wrote ${distDir}`);
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('[build-static] Failed:', err);
  process.exitCode = 1;
});

