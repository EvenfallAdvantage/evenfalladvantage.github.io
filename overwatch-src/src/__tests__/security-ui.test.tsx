// @vitest-environment happy-dom
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { useState } from "react";
import userEvent from "@testing-library/user-event";
import { checkPasswordStrength } from "@/lib/security";

function PasswordForm() {
  const [password, setPassword] = useState("");
  const result = checkPasswordStrength(password);
  return (
    <div>
      <input
        data-testid="password-input"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      />
      <span data-testid="strength-label">{result.strength}</span>
      <span data-testid="strength-score">{result.score}</span>
      {result.errors.length > 0 && (
        <ul data-testid="feedback-list">
          {result.errors.map((f, i) => (
            <li key={i}>{f}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

describe("Password strength UI", () => {
  it("shows weak for empty password", () => {
    render(<PasswordForm />);
    expect(screen.getByTestId("strength-label").textContent).toBe("weak");
  });

  it("updates strength as user types a strong password", async () => {
    const user = userEvent.setup();
    render(<PasswordForm />);
    const input = screen.getByTestId("password-input");
    await user.type(input, "MyStr0ng!Pass#2026");
    const label = screen.getByTestId("strength-label").textContent;
    expect(["strong", "military"]).toContain(label);
  });

  it("shows feedback for weak password", async () => {
    const user = userEvent.setup();
    render(<PasswordForm />);
    await user.type(screen.getByTestId("password-input"), "short");
    expect(screen.getByTestId("feedback-list")).toBeDefined();
  });

  it("shows high score for very strong password", async () => {
    const user = userEvent.setup();
    render(<PasswordForm />);
    await user.type(screen.getByTestId("password-input"), "X9$kL2!mNp@qR4wZ");
    const score = parseInt(
      screen.getByTestId("strength-score").textContent || "0"
    );
    expect(score).toBeGreaterThanOrEqual(3);
  });
});
