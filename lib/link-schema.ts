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
    ALTER TABLE link_folders
    ADD COLUMN IF NOT EXISTS sort_order INTEGER NOT NULL DEFAULT 0;
  `;

  await sql`
    WITH ordered AS (
      SELECT id, ROW_NUMBER() OVER (ORDER BY created_at, id) - 1 AS rank
      FROM link_folders
    )
    UPDATE link_folders
    SET sort_order = ordered.rank
    FROM ordered
    WHERE link_folders.id = ordered.id
      AND link_folders.sort_order = 0
      AND NOT EXISTS (
        SELECT 1 FROM link_folders WHERE sort_order != 0
      );
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
    ensureLinkSchemaPromise = runEnsureLinkSchema().catch((error) => {
      ensureLinkSchemaPromise = null;
      throw error;
    });
  }

  await ensureLinkSchemaPromise;
}
