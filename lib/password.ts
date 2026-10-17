import { pbkdf2, randomBytes, timingSafeEqual } from "crypto";

import { promisify } from "util";

const deriveKey = promisify(pbkdf2);
const ITERATIONS = 310000;
const KEYLEN = 32;
const DIGEST = "sha256";

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString("hex");
  const hash = (await deriveKey(password, salt, ITERATIONS, KEYLEN, DIGEST)).toString("hex");
  return `pbkdf2$${ITERATIONS}$${salt}$${hash}`;
}

export async function verifyPassword(password: string, stored: string | null): Promise<boolean> {
  if (!stored) return false;
  const [algo, iterStr, salt, hash] = stored.split("$");
  if (algo !== "pbkdf2" || !iterStr || !salt || !hash) return false;
  const iterations = Number(iterStr);
  if (!Number.isInteger(iterations) || iterations <= 0 || iterations > ITERATIONS) return false;
  const derived = (await deriveKey(password, salt, iterations, KEYLEN, DIGEST)).toString("hex");
  const a = Buffer.from(derived, "hex");
  const b = Buffer.from(hash, "hex");
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
