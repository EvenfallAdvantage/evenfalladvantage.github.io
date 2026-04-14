// @vitest-environment happy-dom
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { escapeHtml, sanitizeInput } from "@/lib/security";

function SafeDisplay({ untrustedHtml }: { untrustedHtml: string }) {
  const safe = escapeHtml(untrustedHtml);
  return <div data-testid="display">{safe}</div>;
}

function SafeFormValue({ untrustedInput }: { untrustedInput: string }) {
  const safe = sanitizeInput(untrustedInput);
  return <input data-testid="input" defaultValue={safe} />;
}

describe("XSS-safe rendering", () => {
  it("escapes script tags in text content", () => {
    render(<SafeDisplay untrustedHtml='<script>alert("xss")</script>' />);
    const el = screen.getByTestId("display");
    // The escaped HTML should be visible as text, not executed
    expect(el.textContent).toContain("&lt;script&gt;");
    expect(el.innerHTML).not.toContain("<script>");
  });

  it("escapes event handlers in text", () => {
    render(
      <SafeDisplay untrustedHtml='<img onerror="alert(1)" src=x>' />
    );
    const el = screen.getByTestId("display");
    // The escaped string renders as text, not as a real <img> element
    expect(el.innerHTML).not.toContain("<img");
    expect(el.querySelector("img")).toBeNull();
  });

  it("sanitizes input values", () => {
    render(
      <SafeFormValue untrustedInput='"><script>alert(1)</script>' />
    );
    const input = screen.getByTestId("input") as HTMLInputElement;
    expect(input.value).not.toContain("<script>");
  });

  it("preserves safe text", () => {
    render(<SafeDisplay untrustedHtml="Hello World" />);
    expect(screen.getByTestId("display").textContent).toBe("Hello World");
  });
});
