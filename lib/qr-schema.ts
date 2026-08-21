import { getSql, hasDatabaseUrl } from "@/lib/db";

let ensureQrSchemaPromise: Promise<void> | null = null;

async function runEnsureQrSchema(): Promise<void> {
  if (!hasDatabaseUrl()) return;

  const sql = getSql();

  try {
    const check = (await sql`
      SELECT 1 FROM information_schema.tables WHERE table_name = 'qr_code_requests' LIMIT 1;
    `) as unknown[];

    if (check.length > 0) {
      return;
    }
  } catch {
  }

  await sql`
    CREATE TABLE IF NOT EXISTS qr_code_requests (
      id BIGSERIAL PRIMARY KEY,
      link_slug TEXT NOT NULL,
      user_id TEXT NOT NULL,
      user_email TEXT,
      user_name TEXT,
      status TEXT NOT NULL DEFAULT 'pending',
      admin_reason TEXT,
      can_appeal BOOLEAN NOT NULL DEFAULT TRUE,
      reviewed_by_user_id TEXT,
      reviewed_by_name TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS qr_code_requests_slug_user_idx ON qr_code_requests(link_slug, user_id);
  `;
}

export async function ensureQrSchema(): Promise<void> {
  if (!ensureQrSchemaPromise) {
    ensureQrSchemaPromise = runEnsureQrSchema().catch((error) => {
      ensureQrSchemaPromise = null;
      throw error;
    });
  }
  await ensureQrSchemaPromise;
}
