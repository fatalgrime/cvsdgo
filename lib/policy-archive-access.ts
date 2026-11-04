// November 9, 2026 at midnight in America/Denver (MST).
export const POLICY_ARCHIVE_CLOSES_AT = "2026-11-09T00:00:00-07:00";
export const POLICY_ARCHIVE_CLOSES_AT_MS = Date.parse(POLICY_ARCHIVE_CLOSES_AT);
export function isPolicyArchivePublic(now: number = Date.now()): boolean {
  return now < POLICY_ARCHIVE_CLOSES_AT_MS;
}
