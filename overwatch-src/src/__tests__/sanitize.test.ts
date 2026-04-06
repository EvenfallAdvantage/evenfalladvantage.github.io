import { describe, it, expect } from "vitest";

// Replicate the escapeHTML/escapeAttr functions from js/sanitize.js
function escapeHTML(str: unknown): string {
  if (str === null || str === undefined) return "";
  const s = String(str);
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;");
}

function escapeAttr(str: unknown): string {
  if (str === null || str === undefined) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

describe("XSS Prevention — escapeHTML", () => {
  it("escapes HTML tags", () => {
    expect(escapeHTML("<script>alert('xss')</script>")).toBe(
      "&lt;script&gt;alert(&#x27;xss&#x27;)&lt;/script&gt;"
    );
  });

  it("escapes ampersands", () => {
    expect(escapeHTML("AT&T")).toBe("AT&amp;T");
  });

  it("escapes quotes", () => {
    expect(escapeHTML('"hello"')).toBe("&quot;hello&quot;");
    expect(escapeHTML("it's")).toBe("it&#x27;s");
  });

  it("handles null and undefined", () => {
    expect(escapeHTML(null)).toBe("");
    expect(escapeHTML(undefined)).toBe("");
  });

  it("handles numbers", () => {
    expect(escapeHTML(42)).toBe("42");
    expect(escapeHTML(0)).toBe("0");
  });

  it("handles empty string", () => {
    expect(escapeHTML("")).toBe("");
  });

  it("does not modify safe strings", () => {
    expect(escapeHTML("Hello World")).toBe("Hello World");
    expect(escapeHTML("john@example.com")).toBe("john@example.com");
  });

  it("prevents event handler injection by escaping quotes", () => {
    const malicious = '" onmouseover="alert(1)" data-x="';
    const escaped = escapeHTML(malicious);
    // The quotes are escaped so the attribute can't break out
    expect(escaped).not.toContain('"');
    expect(escaped).toContain("&quot;");
    // When inserted into innerHTML, the escaped string is safe text, not executable HTML
    expect(escaped).toBe('&quot; onmouseover=&quot;alert(1)&quot; data-x=&quot;');
  });

  it("prevents nested injection", () => {
    expect(escapeHTML("<img src=x onerror=alert(1)>")).toBe(
      "&lt;img src=x onerror=alert(1)&gt;"
    );
  });
});

describe("XSS Prevention — escapeAttr", () => {
  it("escapes attribute injection", () => {
    const input = '"><script>alert(1)</script>';
    const escaped = escapeAttr(input);
    expect(escaped).not.toContain("<script>");
    expect(escaped).toContain("&quot;");
    expect(escaped).toContain("&gt;");
  });

  it("escapes single quotes for onclick handlers", () => {
    const malicious = "\\'); alert(\\'xss";
    expect(escapeAttr(malicious)).toContain("&#x27;");
  });

  it("handles null and undefined", () => {
    expect(escapeAttr(null)).toBe("");
    expect(escapeAttr(undefined)).toBe("");
  });
});
