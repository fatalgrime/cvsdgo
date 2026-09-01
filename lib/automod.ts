import { getSql, hasDatabaseUrl } from "@/lib/db";

// Common profanity words/patterns to filter - blocked words we're generated
const BASE_BLOCKED_TERMS = [
  "fuck",
  "shit",
  "bitch",
  "cunt",
  "asshole",
  "bastard",
  "dick",
  "pussy",
  "cock",
  "whore",
  "slut",
  "nigger",
  "nigga",
  "faggot",
  "retard",
  "motherfucker",
  "bullshit",
  "damn",
  "crap",
];

// Leetspeak replacements mapping
const LEET_MAP: Record<string, string> = {
  "@": "a",
  "4": "a",
  "8": "b",
  "3": "e",
  "1": "i",
  "!": "i",
  "0": "o",
  "$": "s",
  "5": "s",
  "7": "t",
  "+": "t",
};

// Words that contain profane substrings but are completely legitimate (e.g. Scunthorpe problem)
const SAFE_WHITELIST = [
  "class",
  "classes",
  "classify",
  "classification",
  "pass",
  "passenger",
  "password",
  "compass",
  "asset",
  "assets",
  "assessment",
  "assess",
  "associate",
  "association",
  "glass",
  "grass",
  "mass",
  "enroll",
  "calendar",
  "scunthorpe",
  "document",
  "documentation",
  "analytic",
  "analytics",
  "analysis",
];

let customBlockedTermsCache: string[] | null = null;
let lastCacheFetchTime = 0;
const CACHE_TTL_MS = 60_000; // 1 minute cache

async function getCustomBlockedTerms(): Promise<string[]> {
  if (!hasDatabaseUrl()) return [];
  const now = Date.now();
  if (customBlockedTermsCache && now - lastCacheFetchTime < CACHE_TTL_MS) {
    return customBlockedTermsCache;
  }

  try {
    const sql = getSql();
    const rows = (await sql`
      SELECT setting_value FROM site_settings WHERE setting_key = 'automod_blocked_terms' LIMIT 1;
    `) as Array<{ setting_value: string }>;

    if (rows[0]?.setting_value) {
      const parsed = rows[0].setting_value
        .split(",")
        .map((t) => t.trim().toLowerCase())
        .filter(Boolean);
      customBlockedTermsCache = parsed;
      lastCacheFetchTime = now;
      return parsed;
    }
  } catch {
    // fallback gracefully if table/setting doesn't exist yet
  }

  customBlockedTermsCache = [];
  lastCacheFetchTime = now;
  return [];
}

export function invalidateAutoModCache(): void {
  customBlockedTermsCache = null;
}

/**
 * Normalizes string by substituting leetspeak characters and stripping punctuation.
 */
function normalizeText(text: string): string {
  let normalized = text.toLowerCase();
  for (const [leet, real] of Object.entries(LEET_MAP)) {
    normalized = normalized.replaceAll(leet, real);
  }
  return normalized;
}

export type AutoModResult = {
  isClean: boolean;
  blockedTerm?: string;
  reason?: string;
};

/**
 * Validates text against the AutoMod system.
 * Returns isClean: true if acceptable, or isClean: false with reason if blocked.
 */
export async function validateContentWithAutoMod(text: string): Promise<AutoModResult> {
  if (!text || typeof text !== "string") {
    return { isClean: true };
  }

  const rawLower = text.toLowerCase();
  const normalized = normalizeText(text);

  // Fetch custom blocked terms if configured in site_settings
  const customTerms = await getCustomBlockedTerms();
  const allBlockedTerms = Array.from(new Set([...BASE_BLOCKED_TERMS, ...customTerms]));

  // Tokenize words to check whole words and whitelisted terms
  const words = normalized.split(/[^a-z0-9]+/i).filter(Boolean);
  const rawWords = rawLower.split(/[^a-z0-9]+/i).filter(Boolean);

  for (const word of words) {
    // Skip if word is in whitelist
    if (SAFE_WHITELIST.includes(word)) {
      continue;
    }

    for (const term of allBlockedTerms) {
      // Direct exact match on word
      if (word === term) {
        return {
          isClean: false,
          blockedTerm: term,
          reason: `Content contains inappropriate or profane language blocked by AutoMod ("${term}").`,
        };
      }

      // Check for hidden profanity in compound words if length >= 4 and not whitelisted
      if (term.length >= 4 && word.includes(term)) {
        const isWhitelisted = SAFE_WHITELIST.some((safe) => safe.includes(word) || word.includes(safe));
        if (!isWhitelisted) {
          return {
            isClean: false,
            blockedTerm: term,
            reason: `Content contains inappropriate or profane language blocked by AutoMod ("${term}").`,
          };
        }
      }
    }
  }

  // Also check raw words in case leetspeak normalization caused false positives
  for (const word of rawWords) {
    if (SAFE_WHITELIST.includes(word)) {
      continue;
    }
    for (const term of customTerms) {
      if (word === term) {
        return {
          isClean: false,
          blockedTerm: term,
          reason: `Content contains inappropriate or profane language blocked by AutoMod ("${term}").`,
        };
      }
    }
  }

  return { isClean: true };
}

/**
 * Synchronous client-side check for quick UI feedback
 */
export function validateContentWithAutoModSync(text: string): AutoModResult {
  if (!text || typeof text !== "string") {
    return { isClean: true };
  }

  const normalized = normalizeText(text);
  const words = normalized.split(/[^a-z0-9]+/i).filter(Boolean);

  for (const word of words) {
    if (SAFE_WHITELIST.includes(word)) {
      continue;
    }

    for (const term of BASE_BLOCKED_TERMS) {
      if (word === term) {
        return {
          isClean: false,
          blockedTerm: term,
          reason: `Content contains inappropriate or profane language blocked by AutoMod ("${term}").`,
        };
      }

      if (term.length >= 4 && word.includes(term)) {
        const isWhitelisted = SAFE_WHITELIST.some((safe) => safe.includes(word) || word.includes(safe));
        if (!isWhitelisted) {
          return {
            isClean: false,
            blockedTerm: term,
            reason: `Content contains inappropriate or profane language blocked by AutoMod ("${term}").`,
          };
        }
      }
    }
  }

  return { isClean: true };
}
