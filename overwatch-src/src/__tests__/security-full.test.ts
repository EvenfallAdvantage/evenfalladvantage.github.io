import { describe, it, expect } from "vitest";
import {
  checkPasswordStrength,
  sanitizeObject,
  encrypt,
  decrypt,
  secureRandomHex,
  generateCSRFToken,
  SESSION_TIMEOUT_MS,
  SESSION_TIMEOUT_EXTENDED_MS,
  MAX_LOGIN_ATTEMPTS,
  LOCKOUT_DURATION_MS,
  MIN_PASSWORD_LENGTH,
} from "@/lib/security";

// ---------------------------------------------------------------------------
// checkPasswordStrength
// ---------------------------------------------------------------------------

describe("checkPasswordStrength", () => {
  it("returns weak for empty string", () => {
    const result = checkPasswordStrength("");
    expect(result.strength).toBe("weak");
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it("returns weak for too-short passwords (< 12 chars)", () => {
    const result = checkPasswordStrength("Sh0rt!");
    expect(result.valid).toBe(false);
    expect(result.errors).toEqual(
      expect.arrayContaining([expect.stringMatching(/12 characters/i)])
    );
  });

  it("penalises passwords with no uppercase", () => {
    const result = checkPasswordStrength("alllowercase1!");
    // Missing uppercase means < 3 character types is still possible
    // but importantly the score won't reach "strong"
    expect(result.score).toBeLessThan(4);
  });

  it("penalises passwords with no lowercase", () => {
    const result = checkPasswordStrength("ALLUPPERCASE1!");
    expect(result.score).toBeLessThan(4);
  });

  it("penalises passwords with no digit", () => {
    const result = checkPasswordStrength("NoDigitsHere!!")
    expect(result.score).toBeLessThan(4);
  });

  it("penalises passwords with no special character", () => {
    const result = checkPasswordStrength("NoSpecialChar1A");
    // Only 3 types (lower, upper, digit) — still valid but not top score
    expect(result.score).toBeLessThan(5);
  });

  it("returns weak for common passwords regardless of casing", () => {
    const result = checkPasswordStrength("password");
    expect(result.strength).toBe("weak");
    expect(result.valid).toBe(false);
    expect(result.errors).toEqual(
      expect.arrayContaining([expect.stringMatching(/too common/i)])
    );
  });

  it("detects common passwords case-insensitively", () => {
    const result = checkPasswordStrength("PASSWORD");
    expect(result.errors).toEqual(
      expect.arrayContaining([expect.stringMatching(/too common/i)])
    );
  });

  it("penalises repeated characters (3+ in a row)", () => {
    const result = checkPasswordStrength("Gooood#Passw1");
    // "ooo" triggers the repeated-char penalty
    expect(result.errors).toEqual(
      expect.arrayContaining([expect.stringMatching(/repeating/i)])
    );
  });

  it("penalises sequential characters (123, abc)", () => {
    const result = checkPasswordStrength("Abcde!@#Pass1");
    expect(result.errors).toEqual(
      expect.arrayContaining([expect.stringMatching(/sequential/i)])
    );
  });

  it("penalises numeric sequences (1234)", () => {
    const result = checkPasswordStrength("Hello1234!@#W");
    expect(result.errors).toEqual(
      expect.arrayContaining([expect.stringMatching(/sequential/i)])
    );
  });

  it("rates a strong password (12+ chars, mixed case, digit, special)", () => {
    const result = checkPasswordStrength("T!g3rStr0ng#X");
    expect(result.valid).toBe(true);
    expect(result.score).toBeGreaterThanOrEqual(3);
    expect(["good", "strong", "military"]).toContain(result.strength);
  });

  it("rates a very strong / military password (16+ chars, all types)", () => {
    const result = checkPasswordStrength("X#9kLm!pQr2$vWzY");
    expect(result.valid).toBe(true);
    expect(result.score).toBeGreaterThanOrEqual(4);
    expect(["strong", "military"]).toContain(result.strength);
  });

  it("returns errors array for every violation", () => {
    // Short, common, has repeated chars, has sequential chars
    const result = checkPasswordStrength("aaa123");
    expect(result.errors.length).toBeGreaterThanOrEqual(2);
  });

  it("score is clamped between 0 and 5", () => {
    const weak = checkPasswordStrength("");
    const strong = checkPasswordStrength("X#9kLm!pQr2$vWzY");
    expect(weak.score).toBeGreaterThanOrEqual(0);
    expect(strong.score).toBeLessThanOrEqual(5);
  });
});

// ---------------------------------------------------------------------------
// sanitizeObject
// ---------------------------------------------------------------------------

describe("sanitizeObject", () => {
  it("escapes HTML in string values (via sanitizeInput which strips tags)", () => {
    const result = sanitizeObject({ name: "<b>bold</b>" });
    expect(result.name).toBe("bold");
  });

  it("passes numbers through unchanged", () => {
    const result = sanitizeObject({ count: 42 });
    expect(result.count).toBe(42);
  });

  it("passes booleans through unchanged", () => {
    const result = sanitizeObject({ active: true });
    expect(result.active).toBe(true);
  });

  it("passes null through unchanged", () => {
    const result = sanitizeObject({ value: null } as Record<string, unknown>);
    expect(result.value).toBeNull();
  });

  it("passes undefined through unchanged", () => {
    const result = sanitizeObject({ value: undefined } as Record<string, unknown>);
    expect(result.value).toBeUndefined();
  });

  it("recursively sanitizes nested objects", () => {
    const result = sanitizeObject({
      user: { name: "<script>alert(1)</script>", age: 25 },
    });
    expect((result.user as Record<string, unknown>).name).toBe("alert(1)");
    expect((result.user as Record<string, unknown>).age).toBe(25);
  });

  it("does not recurse into arrays (current implementation)", () => {
    // The implementation checks !Array.isArray(val) before recursing,
    // so arrays are left as-is.
    const input = { tags: ["<b>safe</b>", "ok"] };
    const result = sanitizeObject(input);
    expect(result.tags).toEqual(["<b>safe</b>", "ok"]);
  });

  it("strips script tags from string values", () => {
    const result = sanitizeObject({
      bio: '<script>document.cookie</script>Hello',
    });
    expect(result.bio).toBe("document.cookieHello");
  });

  it("returns empty object for empty input", () => {
    const result = sanitizeObject({});
    expect(result).toEqual({});
  });

  it("handles deeply nested objects", () => {
    const result = sanitizeObject({
      a: { b: { c: { d: "<img src=x onerror=alert(1)>" } } },
    });
    const d = (
      (((result as Record<string, unknown>).a as Record<string, unknown>)
        .b as Record<string, unknown>)
        .c as Record<string, unknown>
    ).d;
    // stripTags removes the entire <img> tag
    expect(d).toBe("");
  });
});

// ---------------------------------------------------------------------------
// encrypt / decrypt (AES-256-GCM)
// ---------------------------------------------------------------------------

describe("encrypt / decrypt", () => {
  // The test environment must provide crypto.subtle (Node 18+ does via globalThis).
  // setup.ts provides crypto.getRandomValues; Node 18+ has subtle natively.

  it("round-trips: encrypt then decrypt recovers original text", async () => {
    const plaintext = "Top Secret Mission Briefing";
    const passphrase = "correct-horse-battery-staple";
    const ciphertext = await encrypt(plaintext, passphrase);
    const recovered = await decrypt(ciphertext, passphrase);
    expect(recovered).toBe(plaintext);
  });

  it("produces base64-encoded output", async () => {
    const ciphertext = await encrypt("hello", "pass");
    // Base64 alphabet: A-Z a-z 0-9 + / =
    expect(ciphertext).toMatch(/^[A-Za-z0-9+/]+=*$/);
  });

  it("different passphrases produce different ciphertext", async () => {
    const plaintext = "same input";
    const c1 = await encrypt(plaintext, "passphrase-one");
    const c2 = await encrypt(plaintext, "passphrase-two");
    expect(c1).not.toBe(c2);
  });

  it("same passphrase produces different ciphertext (random IV/salt)", async () => {
    const plaintext = "determinism test";
    const pass = "same-pass";
    const c1 = await encrypt(plaintext, pass);
    const c2 = await encrypt(plaintext, pass);
    expect(c1).not.toBe(c2);
  });

  it("decrypting with wrong passphrase throws", async () => {
    const ciphertext = await encrypt("secret", "right-pass");
    await expect(decrypt(ciphertext, "wrong-pass")).rejects.toThrow();
  });

  it("round-trips empty string", async () => {
    const ciphertext = await encrypt("", "passphrase");
    const recovered = await decrypt(ciphertext, "passphrase");
    expect(recovered).toBe("");
  });

  it("round-trips unicode text", async () => {
    const plaintext = "Hello 🌍 — Ülkücü 日本語";
    const ciphertext = await encrypt(plaintext, "unicode-pass");
    const recovered = await decrypt(ciphertext, "unicode-pass");
    expect(recovered).toBe(plaintext);
  });
});

// ---------------------------------------------------------------------------
// secureRandomHex
// ---------------------------------------------------------------------------

describe("secureRandomHex", () => {
  it("defaults to 64 hex chars (32 bytes)", () => {
    const hex = secureRandomHex();
    expect(hex).toHaveLength(64);
  });

  it("respects custom byte count", () => {
    expect(secureRandomHex(8)).toHaveLength(16);
    expect(secureRandomHex(1)).toHaveLength(2);
    expect(secureRandomHex(64)).toHaveLength(128);
  });

  it("output contains only hex characters", () => {
    const hex = secureRandomHex();
    expect(hex).toMatch(/^[0-9a-f]+$/);
  });

  it("two calls produce different values", () => {
    const a = secureRandomHex();
    const b = secureRandomHex();
    expect(a).not.toBe(b);
  });
});

// ---------------------------------------------------------------------------
// generateCSRFToken
// ---------------------------------------------------------------------------

describe("generateCSRFToken", () => {
  it("returns a 64-char hex string", () => {
    const token = generateCSRFToken();
    expect(token).toHaveLength(64);
    expect(token).toMatch(/^[0-9a-f]+$/);
  });

  it("two calls produce different tokens", () => {
    const a = generateCSRFToken();
    const b = generateCSRFToken();
    expect(a).not.toBe(b);
  });
});

// ---------------------------------------------------------------------------
// Security Constants
// ---------------------------------------------------------------------------

describe("Security Constants", () => {
  it("SESSION_TIMEOUT_MS is a positive number (15 minutes)", () => {
    expect(SESSION_TIMEOUT_MS).toBeGreaterThan(0);
    expect(SESSION_TIMEOUT_MS).toBe(15 * 60 * 1000);
  });

  it("SESSION_TIMEOUT_EXTENDED_MS is longer than SESSION_TIMEOUT_MS", () => {
    expect(SESSION_TIMEOUT_EXTENDED_MS).toBeGreaterThan(SESSION_TIMEOUT_MS);
  });

  it("MAX_LOGIN_ATTEMPTS is a positive integer", () => {
    expect(MAX_LOGIN_ATTEMPTS).toBeGreaterThan(0);
    expect(Number.isInteger(MAX_LOGIN_ATTEMPTS)).toBe(true);
  });

  it("LOCKOUT_DURATION_MS is a positive number", () => {
    expect(LOCKOUT_DURATION_MS).toBeGreaterThan(0);
  });

  it("MIN_PASSWORD_LENGTH is >= 12", () => {
    expect(MIN_PASSWORD_LENGTH).toBeGreaterThanOrEqual(12);
  });
});
