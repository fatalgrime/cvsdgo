import { getSql, hasDatabaseUrl } from "@/lib/db";

let ensureReportSchemaPromise: Promise<void> | null = null;

async function runEnsureReportSchema(): Promise<void> {
  if (!hasDatabaseUrl()) return;

  const sql = getSql();

  await sql`
    CREATE TABLE IF NOT EXISTS reporting_profiles (
      user_id TEXT PRIMARY KEY,
      report_ban_type TEXT NOT NULL DEFAULT 'none',
      banned_until TIMESTAMPTZ,
      limit_hourly INTEGER NOT NULL DEFAULT 0,
      limit_daily INTEGER NOT NULL DEFAULT 0,
      strikes INTEGER NOT NULL DEFAULT 0,
      last_strike_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `;

  await sql`
    ALTER TABLE IF EXISTS reports
    ADD COLUMN IF NOT EXISTS handled_by_user_id TEXT;
  `;

  await sql`
    ALTER TABLE IF EXISTS reports
    ADD COLUMN IF NOT EXISTS handled_by_name TEXT;
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS report_strikes (
      id BIGSERIAL PRIMARY KEY,
      user_id TEXT NOT NULL,
      report_id BIGINT REFERENCES reports(id) ON DELETE SET NULL,
      reason TEXT,
      strike_type TEXT NOT NULL,
      points INTEGER NOT NULL DEFAULT 1,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS reporting_profiles_user_id_idx ON reporting_profiles(user_id);
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS report_strikes_user_id_idx ON report_strikes(user_id);
  `;
}

export async function ensureReportSchema(): Promise<void> {
  if (!ensureReportSchemaPromise) {
    ensureReportSchemaPromise = runEnsureReportSchema().catch((error) => {
      ensureReportSchemaPromise = null;
      throw error;
    });
  }

  await ensureReportSchemaPromise;
}
