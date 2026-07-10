import { ensureAuditSchema, getRequestContext, logAuditEvent } from "@/lib/audit";
import { getSql, hasDatabaseUrl } from "@/lib/db";

export type PolicyDocumentKey = "terms" | "privacy";

export type PolicyDocumentDefinition = {
  key: PolicyDocumentKey;
  label: string;
  title: string;
  route: string;
  storageKey: string;
  defaultMarkdown: string;
};

export type StoredPolicyDocument = {
  key: PolicyDocumentKey;
  label: string;
  title: string;
  route: string;
  storageKey: string;
  markdown: string;
  updatedAt: string | null;
  isDefault: boolean;
};

export const POLICY_DOCUMENTS: Record<PolicyDocumentKey, PolicyDocumentDefinition> = {
  terms: {
    key: "terms",
    label: "Terms of Service",
    title: "Terms of Service",
    route: "/terms-of-service",
    storageKey: "policy_terms_markdown",
    defaultMarkdown: `*Effective date: March 10, 2026*

These Terms of Service govern access to and use of CVSD Go, including the public link directory, short-link redirection, and staff administration tools operated by Cedar Valley School District ("District," "we," "our," "us"). By using CVSD Go, you agree to these terms.

## 1. Eligibility and Acceptable Use

CVSD Go is intended for students, families, staff, and community members seeking official district resources. You agree to use CVSD Go for lawful, educational, and administrative purposes only.

You must not use CVSD Go to:

- Publish malicious, fraudulent, deceptive, or unlawful destinations.
- Interfere with platform availability, security, or integrity.
- Attempt unauthorized access to staff-only tools or protected links.
- Use the service to distribute spam, malware, or harmful content.

## 2. Account and Access Controls

Some functions require authentication and role-based permissions. Staff users are responsible for safeguarding their credentials and for activities under their authenticated sessions.

The District may modify, suspend, or remove user access if misuse, policy violations, or security risks are detected.

## 3. Link Management and Content Responsibility

Authorized staff may create, edit, organize, schedule, lock, and remove short links. Staff users are responsible for verifying destination accuracy, appropriateness, and compliance with district policies.

The District may remove or disable any link, folder, or redirect that is outdated, unsafe, inaccurate, or inconsistent with educational mission or legal obligations.

## 4. Service Availability and Changes

CVSD Go is provided on an "as is" and "as available" basis. We may change features, URLs, folder structures, access rules, or integrations at any time to improve service quality, safety, or compliance.

We do not guarantee uninterrupted operation and may perform maintenance, updates, or emergency actions without prior notice.

## 5. Third-Party Destinations

CVSD Go may redirect to third-party websites and services. The District does not control third-party terms, privacy practices, accessibility, or content after redirection. Users should review destination policies before submitting personal information.

## 6. Security and Abuse Monitoring

To protect users and infrastructure, we may log technical events, monitor suspicious behavior, and audit administrative actions. Unauthorized testing, scraping, or attempts to bypass controls are prohibited.

## 7. Intellectual Property

District names, logos, branding, and original materials in CVSD Go are owned by Cedar Valley School District or licensed to it. No right is granted to reproduce or distribute branded assets except as allowed by law or written permission.

## 8. Disclaimer of Warranties and Limitation of Liability

To the maximum extent permitted by law, the District disclaims warranties of merchantability, fitness for a particular purpose, and non-infringement regarding CVSD Go and linked destinations.

The District is not liable for indirect, incidental, special, consequential, or exemplary damages arising from use of or inability to use CVSD Go, including losses associated with third-party sites.

## 9. Governing Rules and Policy Alignment

These terms operate alongside district board policy, student/employee handbooks, and applicable federal and state law. If there is a conflict, legal and district policy requirements control.

## 10. Contact

Questions about these terms or user rights may be sent to [office@cvsd.live](mailto:office@cvsd.live).

## 11. Updates to These Terms

We may revise these Terms of Service. Material changes will be posted on this page with an updated effective date.`,
  },
  privacy: {
    key: "privacy",
    label: "Privacy Policy",
    title: "Privacy Policy",
    route: "/privacy-policy",
    storageKey: "policy_privacy_markdown",
    defaultMarkdown: `*Effective date: March 10, 2026*

Cedar Valley School District ("District," "we," "our," "us") values privacy and security. This Privacy Policy explains how CVSD Go collects, uses, shares, stores, and protects information when users access the link directory, short-link redirection services, and authenticated staff features.

## 1. Information We Collect

Depending on your use of CVSD Go, we may collect:

- Account identifiers for authenticated staff users (for example, user ID, display name, email).
- Administrative metadata (role flags, moderation actions, timestamps).
- Link records and operational fields (slug, destination URL, descriptions, schedules, access status).
- Technical usage events such as click counts, request timing, and security-related logs.
- Support submissions and comments entered through district support workflows.

## 2. How We Use Information

We process information to:

- Provide directory search and secure redirection functionality.
- Administer links, folders, permissions, and support workflows.
- Detect misuse, protect users, and maintain system security.
- Investigate incidents and comply with legal or policy requirements.
- Improve service quality, reliability, and accessibility.

## 3. Legal Basis and Education Context

CVSD Go is operated in an educational and public-service context. Processing may be based on public interest, legitimate educational operations, legal obligations, or user consent where required.

## 4. Sharing and Disclosure

We do not sell personal information. We may share data with approved service providers (for example, hosting, authentication, and infrastructure providers) under contractual or legal safeguards.

We may also disclose information when required by law, court order, records request obligations, or to protect the rights, safety, and security of students, staff, and systems.

## 5. Data Retention

We retain information only as long as needed for operational, educational, legal, audit, and security purposes. Retention periods may vary by record type and applicable regulation.

## 6. Security Measures

We apply administrative, technical, and organizational safeguards appropriate to the risk profile, including access controls, role-based permissions, logging, and infrastructure security practices.

No internet service can be guaranteed fully secure, but we continuously review and improve controls.

## 7. Children and Student Data

CVSD Go may be used by students and families to access district resources. Student information is handled in line with district obligations and applicable student privacy laws.

## 8. Third-Party Links and Services

CVSD Go redirects users to internal and external destinations. Once redirected, privacy practices are governed by the destination site. Review third-party privacy notices before sharing personal data.

## 9. Your Rights and Requests

Depending on applicable law, users may request access, correction, deletion, or restriction related to personal information processed through CVSD Go. We may need to verify identity before processing requests.

## 10. Contact

Privacy questions, rights requests, and security concerns can be sent to [office@cvsd.live](mailto:office@cvsd.live).

## 11. Policy Updates

We may update this Privacy Policy to reflect legal, operational, or technical changes. Updates will be posted on this page with a revised effective date.`,
  },
};

export function isPolicyDocumentKey(value: string): value is PolicyDocumentKey {
  return value === "terms" || value === "privacy";
}

export function getPolicyDocumentDefinition(key: PolicyDocumentKey): PolicyDocumentDefinition {
  return POLICY_DOCUMENTS[key];
}

export function hasMeaningfulPolicyContent(markdown: string): boolean {
  const stripped = markdown.replace(/[\s#>*_\-`[\]{}()|!~]/g, "").trim();
  return stripped.length > 0;
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
