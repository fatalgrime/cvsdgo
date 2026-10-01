import { getSql, hasDatabaseUrl } from "@/lib/db";

// Keep this list to unambiguous whole words. The matcher deliberately does not
// use substring matching, which prevents words such as "shoe" from matching
// the blocked term "hoe".
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
  "hoe",
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

const SAFE_WHITELIST = new Set([
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
]);

let customBlockedTermsCache: string[] | null = null;
let lastCacheFetchTime = 0;
const CACHE_TTL_MS = 60_000;

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
        .map((term) => term.trim())
        .filter(Boolean);
      customBlockedTermsCache = parsed;
      lastCacheFetchTime = now;
      return parsed;
    }
  } catch {
  }

  customBlockedTermsCache = [];
  lastCacheFetchTime = now;
  return [];
}

export function invalidateAutoModCache(): void {
  customBlockedTermsCache = null;
}

function normalizeText(text: string): string {
  let normalized = text
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[\u200B-\u200D\u2060\uFEFF]/g, "")
    .toLowerCase();

  for (const [leet, real] of Object.entries(LEET_MAP)) {
    normalized = normalized.replaceAll(leet, real);
  }
  return normalized;
}

function tokenize(text: string): string[] {
  return text.match(/[a-z0-9]+/g) ?? [];
}

function collapseRepeatedCharacters(word: string): string {
  return word.replace(/([a-z0-9])\1+/g, "$1");
}

function addSingleCharacterRuns(words: string[], candidates: Set<string>): void {
  let run = "";
  for (const word of words) {
    if (word.length === 1) {
      run += word;
      continue;
    }
    if (run.length >= 2) candidates.add(run);
    run = "";
  }
  if (run.length >= 2) candidates.add(run);
}

function getCandidateWords(text: string): Set<string> {
  const normalized = normalizeText(text);
  const words = tokenize(normalized);

  const punctuationJoinedWords = tokenize(
    normalized.replace(/['’‘ʼ]/g, " ").replace(/[^a-z0-9\s]+/g, "")
  );
  const candidates = new Set([...words, ...punctuationJoinedWords]);

  for (const word of [...candidates]) {
    candidates.add(collapseRepeatedCharacters(word));
  }
  addSingleCharacterRuns(words, candidates);

  return candidates;
}

function containsTokenSequence(words: string[], sequence: string[]): boolean {
  if (sequence.length === 0 || sequence.length > words.length) return false;
  for (let start = 0; start <= words.length - sequence.length; start += 1) {
    if (sequence.every((word, offset) => words[start + offset] === word)) return true;
  }
  return false;
}

function findBlockedTerm(text: string, terms: string[]): string | undefined {
  const normalized = normalizeText(text);
  const words = tokenize(normalized);
  const candidates = getCandidateWords(text);

  for (const originalTerm of terms) {
    const normalizedTermWords = tokenize(normalizeText(originalTerm));
    if (normalizedTermWords.length === 0) continue;

    if (normalizedTermWords.length > 1) {
      if (containsTokenSequence(words, normalizedTermWords)) return originalTerm;
      continue;
    }

    const term = normalizedTermWords[0];
    if (SAFE_WHITELIST.has(term)) continue;
    if (candidates.has(term) || candidates.has(collapseRepeatedCharacters(term))) {
      return originalTerm;
    }
  }

  return undefined;
}

export type AutoModResult = {
  isClean: boolean;
  blockedTerm?: string;
  reason?: string;
};

function blockedResult(term: string): AutoModResult {
  return {
    isClean: false,
    blockedTerm: term,
    reason: "Inappropriate language was detected in this response.",
  };
}

export async function validateContentWithAutoMod(text: string): Promise<AutoModResult> {
  if (!text || typeof text !== "string") return { isClean: true };

  const customTerms = await getCustomBlockedTerms();
  const blockedTerm = findBlockedTerm(text, [...BASE_BLOCKED_TERMS, ...customTerms]);
  return blockedTerm ? blockedResult(blockedTerm) : { isClean: true };
}
export function validateContentWithAutoModSync(text: string): AutoModResult {
  if (!text || typeof text !== "string") return { isClean: true };

  const blockedTerm = findBlockedTerm(text, BASE_BLOCKED_TERMS);
  return blockedTerm ? blockedResult(blockedTerm) : { isClean: true };
}
