import { ensureAuditSchema, getRequestContext, logAuditEvent } from "@/lib/audit";
import { getSql, hasDatabaseUrl } from "@/lib/db";
import {
  hasMeaningfulPolicyContent,
  isPolicyDocumentKey,
  POLICY_DOCUMENTS,
  type PolicyDocumentKey,
  type PolicyDocumentDefinition,
  type StoredPolicyDocument,
} from "@/lib/policy-definitions";

export type { PolicyDocumentKey, PolicyDocumentDefinition, StoredPolicyDocument } from "@/lib/policy-definitions";
export { POLICY_DOCUMENTS, isPolicyDocumentKey, hasMeaningfulPolicyContent } from "@/lib/policy-definitions";

export function getPolicyDocumentDefinition(key: PolicyDocumentKey): PolicyDocumentDefinition {
  return POLICY_DOCUMENTS[key];
}

export async function getPolicyDocument(key: PolicyDocumentKey): Promise<StoredPolicyDocument> {
  const definition = POLICY_DOCUMENTS[key];

  if (!hasDatabaseUrl()) {
    return {
      key,
      label: definition.label,
      title: definition.title,
      route: definition.route,
      storageKey: definition.storageKey,
      markdown: definition.defaultMarkdown,
      updatedAt: null,
      isDefault: true,
    };
  }

  await ensureAuditSchema();
  const sql = getSql();
  const rows = (await sql`
    SELECT setting_value, updated_at
    FROM site_settings
    WHERE setting_key = ${definition.storageKey}
    LIMIT 1;
  `) as { setting_value: string; updated_at: string }[];

  const storedMarkdown = rows[0]?.setting_value?.trim();

  return {
    key,
    label: definition.label,
    title: definition.title,
    route: definition.route,
    storageKey: definition.storageKey,
    markdown: storedMarkdown && storedMarkdown.length > 0 ? storedMarkdown : definition.defaultMarkdown,
    updatedAt: rows[0]?.updated_at ?? null,
    isDefault: !storedMarkdown || storedMarkdown.length === 0,
  };
}

export async function getAllPolicyDocuments(): Promise<Record<PolicyDocumentKey, StoredPolicyDocument>> {
  const entries = await Promise.all(
    (Object.keys(POLICY_DOCUMENTS) as PolicyDocumentKey[]).map(async (key) => [key, await getPolicyDocument(key)] as const)
  );

  return Object.fromEntries(entries) as Record<PolicyDocumentKey, StoredPolicyDocument>;
}

export async function savePolicyDocument(input: {
  key: PolicyDocumentKey;
  markdown: string;
  actorUserId: string;
  request?: Request | null;
}): Promise<StoredPolicyDocument> {
  if (!hasDatabaseUrl()) {
    throw new Error("Database not configured.");
  }

  if (!hasMeaningfulPolicyContent(input.markdown)) {
    throw new Error("Policy content cannot be empty.");
  }

  const definition = POLICY_DOCUMENTS[input.key];
  await ensureAuditSchema();
  const sql = getSql();
  const current = (await sql`
    SELECT setting_value
    FROM site_settings
    WHERE setting_key = ${definition.storageKey}
    LIMIT 1;
  `) as { setting_value: string }[];
  const previousValue = current[0]?.setting_value ?? null;

  await sql`
    INSERT INTO site_settings (setting_key, setting_value, updated_at)
    VALUES (${definition.storageKey}, ${input.markdown.trim()}, NOW())
    ON CONFLICT (setting_key) DO UPDATE SET
      setting_value = EXCLUDED.setting_value,
      updated_at = NOW();
  `;

  const context = getRequestContext(input.request);
  await logAuditEvent({
    action: "Policy updated",
    details: `${definition.label} updated`,
    actorUserId: input.actorUserId,
    metadata: {
      policyKey: input.key,
      storageKey: definition.storageKey,
      previousLength: previousValue?.length ?? 0,
      newLength: input.markdown.trim().length,
    },
    severity: "info",
    category: "policies",
    source: "policy-editor",
    actorIpAddress: context.actorIpAddress,
    actorUserAgent: context.actorUserAgent,
  });

  return getPolicyDocument(input.key);
}
