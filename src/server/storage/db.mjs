import fs from 'node:fs';
import path from 'node:path';
import initSqlJs from 'sql.js';
import { applySchema } from './schema.mjs';
import { seedDefaults } from './seed.mjs';
import { applyMigrations } from './migrations.mjs';

export async function openDb({ filePath }) {
  const wasmDir = path.dirname(new URL(import.meta.url).pathname);
  const SQL = await initSqlJs({
    locateFile: (file) => {
      // sql.js distributes wasm in node_modules/sql.js/dist/
      // locate relative to project root for reliability.
      return path.join(process.cwd(), 'node_modules', 'sql.js', 'dist', file);
    }
  });

  const existing = fs.existsSync(filePath) ? fs.readFileSync(filePath) : null;
  const db = existing ? new SQL.Database(existing) : new SQL.Database();

  const wrapped = {
    filePath,
    SQL,
    db,
    persist() {
      const data = db.export();
      fs.mkdirSync(path.dirname(filePath), { recursive: true });
      fs.writeFileSync(filePath, Buffer.from(data));
    },
    exec(sql, params = []) {
      const stmt = db.prepare(sql);
      stmt.bind(params);
      const rows = [];
      while (stmt.step()) rows.push(stmt.getAsObject());
      stmt.free();
      return rows;
    },
    run(sql, params = []) {
      const stmt = db.prepare(sql);
      stmt.run(params);
      stmt.free();
      wrapped.persist();
    },
    get(sql, params = []) {
      const rows = wrapped.exec(sql, params);
      return rows[0] ?? null;
    }
  };

  applySchema(wrapped);
  wrapped.persist();
  return wrapped;
}

export async function seedIfNeeded(db, env) {
  const meta = db.get('select value from meta where key = ?', ['seed_version']);
  if (!meta?.value) {
    seedDefaults(db, env);
    db.run('insert into meta(key, value) values(?, ?)', ['seed_version', '5']);
    return;
  }

  await applyMigrations(db, { fromSeedVersion: Number(meta.value) || 1 });
}
