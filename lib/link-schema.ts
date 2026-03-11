import { getSql, hasDatabaseUrl } from "@/lib/db";

let ensureLinkSchemaPromise: Promise<void> | null = null;

async function runEnsureLinkSchema(): Promise<void> {
  if (!hasDatabaseUrl()) return;

  const sql = getSql();

  await sql`
    CREATE TABLE IF NOT EXISTS link_folders (
      id BIGSERIAL PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      is_public BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `;

  await sql`
    ALTER TABLE redirects
    ADD COLUMN IF NOT EXISTS folder_id BIGINT REFERENCES link_folders(id) ON DELETE SET NULL;
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS redirects_folder_id_idx ON redirects(folder_id);
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS link_folders_is_public_idx ON link_folders(is_public);
  `;
}

export async function ensureLinkSchema(): Promise<void> {
  if (!ensureLinkSchemaPromise) {
    ensureLinkSchemaPromise = runEnsureLinkSchema();
  }

  await ensureLinkSchemaPromise;
}
