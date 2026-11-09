export const AUDIT_REDACTED = "[REDACTED]";

// These identify records/settings; they are not credential values themselves.
const descriptors = new Set(["settingkey", "storagekey", "policykey", "documentkey", "fieldkey"]);
function normalizedKey(key: string): string { return key.toLowerCase().replace(/[^a-z0-9]/g, ""); }
export function isSensitiveAuditKey(key: string): boolean {
  const name = normalizedKey(key);
  if (descriptors.has(name)) return false;
  return /password|passwd|passphrase|secret|token|credential|authorization|cookie|connectionstring|databaseurl|databaseuri|webhookurl|sessionid|sessionkey|dsn/.test(name)
    || /keys?$/.test(name) || /apikey|privatekey|publickey|accesskey|signingkey|encryptionkey/.test(name)
    || ["pwd", "auth", "session", "webhook", "connectionuri"].includes(name);
}
export function auditSecretValues(values: Record<string, unknown>): string[] {
  return Object.entries(values).filter(([key, value]) => isSensitiveAuditKey(key) && typeof value === "string" && value.length > 0).map(([, value]) => value as string);
}

export function redactAuditData<T>(value: T, knownSecrets: readonly string[] = []): T {
  const secrets = [...new Set(knownSecrets.filter(Boolean))].sort((a, b) => b.length - a.length);
  const seen = new WeakSet<object>();
  function redactText(text: string, depth: number, decode = true): string {
    if (text.length > 100_000 || depth > 20) return AUDIT_REDACTED;
    if (secrets.includes(text)) return AUDIT_REDACTED;
    let safe = text;
    for (const secret of secrets) if (secret.length >= 8) safe = safe.split(secret).join(AUDIT_REDACTED);
    safe = safe.replace(/-----BEGIN (?:[A-Z]+ )*PRIVATE KEY-----[\s\S]*?(?:-----END (?:[A-Z]+ )*PRIVATE KEY-----|$)/g, AUDIT_REDACTED);
    safe = safe.replace(/\b(?:https?|postgres(?:ql)?|mysql|mongodb(?:\+srv)?|rediss?|amqps?):\/\/[^\s<>"']+/gi, raw => {
      try {
        const url = new URL(raw);
        if (!["http:", "https:"].includes(url.protocol) || url.username || url.password || /(?:\/webhooks\/|hooks\.slack\.com\/services\/)/i.test(raw)) return AUDIT_REDACTED;
        if ([...url.searchParams.keys()].some(isSensitiveAuditKey)) return AUDIT_REDACTED;
        const fragment = new URLSearchParams(url.hash.slice(1));
        if ([...fragment.keys()].some(isSensitiveAuditKey)) return AUDIT_REDACTED;
      } catch { return AUDIT_REDACTED; }
      return raw;
    });
    safe = safe.replace(/\b(?:Bearer|Basic)\s+[a-z0-9._~+\/-]+=*/gi, AUDIT_REDACTED);
    safe = safe.replace(/\b(?:sk-(?:proj-|svcacct-)?[a-z0-9_-]{16,}|[sp]k_(?:live|test)_[a-z0-9_-]{8,}|(?:AKIA|ASIA)[A-Z0-9]{16}|AIza[a-z0-9_-]{30,}|gh[pousr]_[a-z0-9]{20,}|github_pat_[a-z0-9_]{20,}|xox[baprs]-[a-z0-9-]{10,}|eyJ[a-z0-9_-]{8,}\.[a-z0-9_-]{8,}\.[a-z0-9_-]{8,})\b/gi, AUDIT_REDACTED);
    // Handle credentials embedded in prose, headers, or serialized key/value text.
    safe = safe.replace(/((?:["']?(?:[\w.-]{0,64}(?:password|passwd|passphrase|secret|token|credential|authorization|api[_-]?key|private[_-]?key|access[_-]?key|client[_-]?secret|database[_-]?url|connection[_-]?string|webhook[_-]?url)[\w.-]{0,64}|key|pwd|auth|cookie)["']?)\s*(?:[:=]|\bis\b)\s*)(?:"[^"\r\n]*"|'[^'\r\n]*'|[^\r\n,;&}]+)/gi, (_match, prefix: string) => prefix + AUDIT_REDACTED);
    // Catch opaque credentials without a recognizable vendor prefix.
    safe = safe.replace(/\b[a-z0-9_+\/-]{40,}={0,2}/gi, token => /[a-z]/i.test(token) && /[0-9]/.test(token) ? AUDIT_REDACTED : token);
    if (decode && /%[a-f0-9]{2}/i.test(safe)) {
      try {
        let decoded = safe;
        for (let i = 0; i < 2; i++) {
          try { decoded = decodeURIComponent(decoded); } catch { break; }
        }
        if (redactText(decoded, depth + 1, false) !== decoded) return AUDIT_REDACTED;
      } catch { /* Keep malformed encodings subject to the other checks. */ }
    }
    return safe;
  }
  function visit(item: unknown, depth: number): unknown {
    if (depth > 20) return AUDIT_REDACTED;
    if (typeof item === "string") {
      // JSON strings can contain further nested secret fields.
      if (/^\s*[\[{]/.test(item)) {
        try {
          const parsed = JSON.parse(item);
          if (parsed && typeof parsed === "object") return JSON.stringify(visit(parsed, depth + 1));
        } catch { /* Not JSON; redact as text. */ }
      }
      return redactText(item, depth);
    }
    if (!item || typeof item !== "object") return item;
    if (item instanceof Date) return Number.isFinite(item.getTime()) ? item.toISOString() : null;
    if (seen.has(item)) return AUDIT_REDACTED;
    seen.add(item);
    let result: unknown;
    if (Array.isArray(item)) {
      result = item.length === 2 && typeof item[0] === "string" && isSensitiveAuditKey(item[0])
        ? [redactText(item[0], depth + 1), AUDIT_REDACTED]
        : item.map(entry => visit(entry, depth + 1));
    }
    else {
      const entries = Object.entries(item);
      const sensitiveSetting = entries.some(([key, entry]) => (descriptors.has(normalizedKey(key)) || ["name", "key", "field"].includes(normalizedKey(key))) && typeof entry === "string" && isSensitiveAuditKey(entry));
      const safeContextFields = new Set(["valuechanged", "reverted", "previouslength", "newlength"]);
      result = Object.fromEntries(entries.map(([key, entry]) => {
        const name = normalizedKey(key);
        const hide = isSensitiveAuditKey(key) || (sensitiveSetting && !descriptors.has(name) && !["name", "field"].includes(name) && !safeContextFields.has(name));
        return [redactText(key, depth + 1), hide ? AUDIT_REDACTED : visit(entry, depth + 1)];
      }));
    }
    seen.delete(item);
    return result;
  }
  return visit(value, 0) as T;
}
