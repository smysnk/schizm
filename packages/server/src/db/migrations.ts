import { pool } from "./pool";

type Migration = {
  id: string;
  statements: string[];
};

const migrations: Migration[] = [
  {
    id: "20260312_000001_create_graph_tables",
    statements: [
      "CREATE EXTENSION IF NOT EXISTS pgcrypto",
      `
        CREATE TABLE IF NOT EXISTS app_migrations (
          id TEXT PRIMARY KEY,
          executed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `,
      `
        CREATE TABLE IF NOT EXISTS ideas (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          title TEXT NOT NULL,
          description TEXT NOT NULL DEFAULT '',
          cluster TEXT NOT NULL DEFAULT 'exploration',
          x DOUBLE PRECISION NOT NULL DEFAULT 0,
          y DOUBLE PRECISION NOT NULL DEFAULT 0,
          radius DOUBLE PRECISION NOT NULL DEFAULT 72,
          weight INTEGER NOT NULL DEFAULT 1,
          tags TEXT[] NOT NULL DEFAULT '{}',
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `,
      `
        CREATE TABLE IF NOT EXISTS connections (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          source_id UUID NOT NULL REFERENCES ideas(id) ON DELETE CASCADE,
          target_id UUID NOT NULL REFERENCES ideas(id) ON DELETE CASCADE,
          label TEXT NOT NULL DEFAULT '',
          strength DOUBLE PRECISION NOT NULL DEFAULT 0.5,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          CONSTRAINT connections_no_self_edge CHECK (source_id <> target_id)
        )
      `,
      "CREATE INDEX IF NOT EXISTS ideas_cluster_idx ON ideas (cluster)",
      "CREATE INDEX IF NOT EXISTS connections_source_idx ON connections (source_id)",
      "CREATE INDEX IF NOT EXISTS connections_target_idx ON connections (target_id)"
    ]
  },
  {
    id: "20260313_000001_create_prompts_table",
    statements: [
      `
        CREATE TABLE IF NOT EXISTS prompts (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          content TEXT NOT NULL,
          status TEXT NOT NULL DEFAULT 'queued',
          metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
          audit JSONB NOT NULL DEFAULT '{}'::jsonb,
          started_at TIMESTAMPTZ,
          finished_at TIMESTAMPTZ,
          error_message TEXT,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          CONSTRAINT prompts_status_not_blank CHECK (btrim(status) <> '')
        )
      `,
      "CREATE INDEX IF NOT EXISTS prompts_status_idx ON prompts (status)",
      "CREATE INDEX IF NOT EXISTS prompts_created_at_idx ON prompts (created_at DESC)"
    ]
  }
];

export const runMigrations = async () => {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS app_migrations (
      id TEXT PRIMARY KEY,
      executed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  for (const migration of migrations) {
    const existing = await pool.query<{ id: string }>(
      "SELECT id FROM app_migrations WHERE id = $1",
      [migration.id]
    );

    if (existing.rowCount) {
      continue;
    }

    const client = await pool.connect();

    try {
      await client.query("BEGIN");

      for (const statement of migration.statements) {
        await client.query(statement);
      }

      await client.query("INSERT INTO app_migrations (id) VALUES ($1)", [migration.id]);
      await client.query("COMMIT");
      console.log(`Applied migration ${migration.id}`);
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }
};
