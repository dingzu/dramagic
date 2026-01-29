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
  // 轻量"迁移"：确保表存在
  const p = getDbPool();

  // 项目表
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

  // 视频生成任务表
  await p.query(`
    CREATE TABLE IF NOT EXISTS video_tasks (
      id BIGSERIAL PRIMARY KEY,
      user_id TEXT NOT NULL DEFAULT 'admin',
      project_id BIGINT REFERENCES projects(id) ON DELETE SET NULL,
      prompt TEXT NOT NULL,
      duration INTEGER NOT NULL DEFAULT 4,
      source TEXT NOT NULL,
      source_task_id TEXT,
      source_video_url TEXT,
      oss_url TEXT,
      oss_path TEXT,
      status TEXT NOT NULL DEFAULT 'pending',
      error TEXT,
      cost_usd NUMERIC(10, 4),
      cost_cny NUMERIC(10, 2),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      completed_at TIMESTAMPTZ
    );
  `);

  await p.query(`
    CREATE INDEX IF NOT EXISTS idx_video_tasks_user_id
    ON video_tasks (user_id);
  `);

  await p.query(`
    CREATE INDEX IF NOT EXISTS idx_video_tasks_created_at
    ON video_tasks (created_at DESC);
  `);

  await p.query(`
    CREATE INDEX IF NOT EXISTS idx_video_tasks_project_id
    ON video_tasks (project_id);
  `);
}
