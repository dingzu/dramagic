import pg from 'pg';

const { Pool } = pg;

let pool;

export function getDbPool() {
  if (!pool) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error('DATABASE_URL 未配置');
    }

    pool = new Pool({
      connectionString,
      // Railway Postgres 默认强制 TLS；本地一般不需要
      ssl: process.env.PGSSLMODE === 'disable' ? false : { rejectUnauthorized: false }
    });
  }
  return pool;
}

export async function initDb() {
  // 轻量“迁移”：确保表存在
  const p = getDbPool();

  await p.query(`
    CREATE TABLE IF NOT EXISTS projects (
      id BIGSERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      canvas_state JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await p.query(`
    CREATE INDEX IF NOT EXISTS idx_projects_updated_at
    ON projects (updated_at DESC);
  `);
}

