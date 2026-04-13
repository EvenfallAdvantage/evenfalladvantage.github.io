import { describe, it, expect } from "vitest";
import { escapeHtml, stripTags, sanitizeInput } from "@/lib/security";

describe("XSS Prevention — escapeHtml", () => {
  it("escapes HTML tags", () => {
    expect(escapeHtml("<script>alert('xss')</script>")).toBe(
      "&lt;script&gt;alert(&#x27;xss&#x27;)&lt;&#x2F;script&gt;"
    );
  });

  it("escapes ampersands", () => {
    expect(escapeHtml("AT&T")).toBe("AT&amp;T");
  });

  it("escapes quotes", () => {
    expect(escapeHtml('"hello"')).toBe("&quot;hello&quot;");
    expect(escapeHtml("it's")).toBe("it&#x27;s");
  });

  it("escapes forward slashes and backticks", () => {
    expect(escapeHtml("/path/to")).toContain("&#x2F;");
    expect(escapeHtml("`code`")).toContain("&#96;");
  });

  it("handles empty string", () => {
    expect(escapeHtml("")).toBe("");
  });

  it("does not modify safe strings", () => {
    expect(escapeHtml("Hello World")).toBe("Hello World");
    expect(escapeHtml("john@example.com")).toBe("john@example.com");
  });

  it("prevents event handler injection by escaping quotes", () => {
    const malicious = '" onmouseover="alert(1)" data-x="';
    const escaped = escapeHtml(malicious);
    expect(escaped).not.toContain('"');
    expect(escaped).toContain("&quot;");
  });

  it("prevents nested injection", () => {
    expect(escapeHtml("<img src=x onerror=alert(1)>")).toBe(
      "&lt;img src=x onerror=alert(1)&gt;"
    );
  });
});

describe("XSS Prevention — stripTags", () => {
  it("strips HTML tags", () => {
    expect(stripTags("<b>bold</b>")).toBe("bold");
    expect(stripTags("<script>alert(1)</script>")).toBe("alert(1)");
  });

  it("handles strings without tags", () => {
    expect(stripTags("no tags here")).toBe("no tags here");
  });
});

describe("XSS Prevention — sanitizeInput", () => {
  it("strips tags and trims", () => {
    expect(sanitizeInput("  <b>hello</b>  ")).toBe("hello");
  });

  it("truncates to max length", () => {
    const long = "a".repeat(200);
    expect(sanitizeInput(long, 100)).toHaveLength(100);
  });

  it("handles empty/falsy input", () => {
    expect(sanitizeInput("")).toBe("");
  });
});
