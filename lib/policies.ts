import { ensureAuditSchema, getRequestContext, logAuditEvent } from "@/lib/audit";
import { getSql, hasDatabaseUrl } from "@/lib/db";
import {
  hasMeaningfulPolicyContent,
  POLICY_DOCUMENTS,
  splitPolicyEffectiveDate,
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
  const fallback = splitPolicyEffectiveDate(definition.defaultMarkdown);

  if (!hasDatabaseUrl()) {
    return {
      key,
      label: definition.label,
      title: definition.title,
      route: definition.route,
      storageKey: definition.storageKey,
      ...fallback,
      updatedAt: null,
      isDefault: true,
    };
  }

  await ensureAuditSchema();
  const sql = getSql();
  const rows = (await sql`
    SELECT setting_key, setting_value, updated_at
    FROM site_settings
    WHERE setting_key IN (${definition.storageKey}, ${`${definition.storageKey}_effective_date`});
  `) as { setting_key: string; setting_value: string; updated_at: string }[];

  const contentRow = rows.find((row) => row.setting_key === definition.storageKey);
  const dateRow = rows.find((row) => row.setting_key === `${definition.storageKey}_effective_date`);
  const storedMarkdown = contentRow?.setting_value?.trim();
  const content = splitPolicyEffectiveDate(storedMarkdown || definition.defaultMarkdown);

  return {
    key,
    label: definition.label,
    title: definition.title,
    route: definition.route,
    storageKey: definition.storageKey,
    markdown: content.markdown,
    effectiveDate: dateRow?.setting_value?.trim() || content.effectiveDate,
    updatedAt: contentRow?.updated_at ?? null,
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
  effectiveDate: string;
  actorUserId: string;
  request?: Request | null;
}): Promise<StoredPolicyDocument> {
  if (!hasDatabaseUrl()) {
    throw new Error("Database not configured.");
  }

  if (!hasMeaningfulPolicyContent(input.markdown)) {
    throw new Error("Policy content cannot be empty.");
  }
  const effectiveDate = input.effectiveDate.trim();
  if (!effectiveDate || effectiveDate.length > 200) {
    throw new Error("Effective date must contain between 1 and 200 characters.");
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
    VALUES (${definition.storageKey}, ${input.markdown.trim()}, NOW()),
      (${`${definition.storageKey}_effective_date`}, ${effectiveDate}, NOW())
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
      effectiveDate,
    },
    severity: "info",
    category: "policies",
    source: "policy-editor",
    actorIpAddress: context.actorIpAddress,
    actorUserAgent: context.actorUserAgent,
  });

  return getPolicyDocument(input.key);
}
