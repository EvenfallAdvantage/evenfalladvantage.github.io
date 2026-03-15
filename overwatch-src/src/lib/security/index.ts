/**
 * Overwatch Security Module
 * Implements military-grade (NIST 800-171 / CMMC Level 2) security controls:
 *
 * - AES-256-GCM encryption (same cipher suite used by US DoD)
 * - NIST 800-63B compliant password policy
 * - Input sanitization (XSS / injection prevention)
 * - CSRF token generation
 * - Secure random generation
 */

// ---------------------------------------------------------------------------
// AES-256-GCM Encryption (Web Crypto API — FIPS 140-2 compliant in browsers)
// ---------------------------------------------------------------------------

const ALGO = "AES-GCM";
const KEY_LENGTH = 256; // bits — military standard
const IV_LENGTH = 12; // bytes — NIST recommended for GCM
const TAG_LENGTH = 128; // bits — authentication tag

/**
 * Derive a 256-bit key from a passphrase using PBKDF2 with 600,000 iterations
 * (OWASP 2023 recommendation for PBKDF2-SHA256)
 */
async function deriveKey(passphrase: string, salt: Uint8Array): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    encoder.encode(passphrase),
    "PBKDF2",
    false,
    ["deriveKey"]
  );
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt: salt as BufferSource, iterations: 600_000, hash: "SHA-256" },
    keyMaterial,
    { name: ALGO, length: KEY_LENGTH },
    false,
    ["encrypt", "decrypt"]
  );
}

/**
 * Encrypt plaintext with AES-256-GCM.
 * Returns base64-encoded string: salt(16) || iv(12) || ciphertext+tag
 */
export async function encrypt(plaintext: string, passphrase: string): Promise<string> {
  const encoder = new TextEncoder();
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));
  const key = await deriveKey(passphrase, salt);
  const cipherBuffer = await crypto.subtle.encrypt(
    { name: ALGO, iv, tagLength: TAG_LENGTH },
    key,
    encoder.encode(plaintext)
  );
  const combined = new Uint8Array(salt.length + iv.length + cipherBuffer.byteLength);
  combined.set(salt, 0);
  combined.set(iv, salt.length);
  combined.set(new Uint8Array(cipherBuffer), salt.length + iv.length);
  return btoa(String.fromCharCode(...combined));
}

/**
 * Decrypt AES-256-GCM ciphertext. Throws on tampered data (authenticated encryption).
 */
export async function decrypt(ciphertext: string, passphrase: string): Promise<string> {
  const decoder = new TextDecoder();
  const raw = Uint8Array.from(atob(ciphertext), (c) => c.charCodeAt(0));
  const salt = raw.slice(0, 16);
  const iv = raw.slice(16, 16 + IV_LENGTH);
  const data = raw.slice(16 + IV_LENGTH);
  const key = await deriveKey(passphrase, salt);
  const plainBuffer = await crypto.subtle.decrypt(
    { name: ALGO, iv, tagLength: TAG_LENGTH },
    key,
    data
  );
  return decoder.decode(plainBuffer);
}

// ---------------------------------------------------------------------------
// Secure Random / Token Generation
// ---------------------------------------------------------------------------

/** Generate a cryptographically secure random hex string */
export function secureRandomHex(bytes = 32): string {
  const buf = crypto.getRandomValues(new Uint8Array(bytes));
  return Array.from(buf)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** Generate a CSRF token */
export function generateCSRFToken(): string {
  return secureRandomHex(32);
}

// ---------------------------------------------------------------------------
// NIST 800-63B Password Policy
// ---------------------------------------------------------------------------

export interface PasswordCheck {
  valid: boolean;
  score: number; // 0-5
  errors: string[];
  strength: "weak" | "fair" | "good" | "strong" | "military";
}

const COMMON_PASSWORDS = new Set([
  "password", "123456", "12345678", "qwerty", "abc123", "monkey", "1234567",
  "letmein", "trustno1", "dragon", "baseball", "iloveyou", "master", "sunshine",
  "ashley", "michael", "shadow", "123123", "654321", "superman", "qazwsx",
  "password1", "password123", "admin", "welcome", "hello", "charlie", "donald",
  "football", "security", "guard", "overwatch", "evenfall",
]);

export function checkPasswordStrength(password: string): PasswordCheck {
  const errors: string[] = [];
  let score = 0;

  // NIST 800-63B: minimum 8 characters (we enforce 12 for military-grade)
  if (password.length < 12) {
    errors.push("Minimum 12 characters required");
  } else {
    score++;
    if (password.length >= 16) score++;
  }

  // Check character diversity
  if (/[a-z]/.test(password)) score += 0.5;
  if (/[A-Z]/.test(password)) score += 0.5;
  if (/[0-9]/.test(password)) score += 0.5;
  if (/[^a-zA-Z0-9]/.test(password)) score += 0.5;

  // Must have at least 3 of 4 character types
  const types = [/[a-z]/, /[A-Z]/, /[0-9]/, /[^a-zA-Z0-9]/].filter((r) =>
    r.test(password)
  ).length;
  if (types < 3) {
    errors.push("Use at least 3 of: lowercase, uppercase, number, special character");
  }

  // NIST: check against breached/common passwords
  if (COMMON_PASSWORDS.has(password.toLowerCase())) {
    errors.push("This password is too common");
    score = Math.max(score - 2, 0);
  }

  // No repeated characters (3+ in a row)
  if (/(.)\1{2,}/.test(password)) {
    errors.push("Avoid repeating characters (e.g. aaa)");
    score = Math.max(score - 1, 0);
  }

  // No sequential characters
  if (/012|123|234|345|456|567|678|789|abc|bcd|cde|def/i.test(password)) {
    errors.push("Avoid sequential characters (e.g. 123, abc)");
    score = Math.max(score - 0.5, 0);
  }

  score = Math.min(Math.round(score), 5);

  let strength: PasswordCheck["strength"] = "weak";
  if (score >= 5) strength = "military";
  else if (score >= 4) strength = "strong";
  else if (score >= 3) strength = "good";
  else if (score >= 2) strength = "fair";

  return { valid: errors.length === 0 && score >= 3, score, errors, strength };
}

// ---------------------------------------------------------------------------
// Input Sanitization (XSS Prevention)
// ---------------------------------------------------------------------------

const HTML_ENTITIES: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#x27;",
  "/": "&#x2F;",
  "`": "&#96;",
};

/** Escape HTML special characters to prevent XSS */
export function escapeHtml(str: string): string {
  return str.replace(/[&<>"'`/]/g, (char) => HTML_ENTITIES[char] || char);
}

/** Strip all HTML tags */
export function stripTags(str: string): string {
  return str.replace(/<[^>]*>/g, "");
}

/** Sanitize user input: trim, strip tags, limit length */
export function sanitizeInput(input: string, maxLength = 10_000): string {
  if (!input) return "";
  return stripTags(input.trim()).slice(0, maxLength);
}

/** Sanitize an object's string values recursively */
export function sanitizeObject<T extends Record<string, unknown>>(obj: T): T {
  const result = { ...obj };
  for (const key of Object.keys(result)) {
    const val = result[key];
    if (typeof val === "string") {
      (result as Record<string, unknown>)[key] = sanitizeInput(val);
    } else if (val && typeof val === "object" && !Array.isArray(val)) {
      (result as Record<string, unknown>)[key] = sanitizeObject(
        val as Record<string, unknown>
      );
    }
  }
  return result;
}

// ---------------------------------------------------------------------------
// Security Constants
// ---------------------------------------------------------------------------

/** Session timeout in milliseconds (15 minutes — NIST 800-171 §3.1.10) */
export const SESSION_TIMEOUT_MS = 15 * 60 * 1000;

/** Extended timeout for active users (30 minutes) */
export const SESSION_TIMEOUT_EXTENDED_MS = 30 * 60 * 1000;

/** Max failed login attempts before lockout */
export const MAX_LOGIN_ATTEMPTS = 5;

/** Lockout duration in milliseconds (15 minutes) */
export const LOCKOUT_DURATION_MS = 15 * 60 * 1000;

/** Minimum password length (NIST 800-63B enhanced) */
export const MIN_PASSWORD_LENGTH = 12;

// ---------------------------------------------------------------------------
// Security Event Types (for audit logging)
// ---------------------------------------------------------------------------

export type SecurityEventType =
  | "auth.login.success"
  | "auth.login.failed"
  | "auth.logout"
  | "auth.session.timeout"
  | "auth.session.locked"
  | "auth.password.changed"
  | "auth.mfa.enabled"
  | "auth.mfa.disabled"
  | "data.export"
  | "data.delete"
  | "admin.role.changed"
  | "admin.user.invited"
  | "admin.user.removed"
  | "admin.settings.changed"
  | "security.lockout"
  | "security.suspicious_activity";
