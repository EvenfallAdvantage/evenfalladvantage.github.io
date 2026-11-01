import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

describe("HQ Config Feature Visibility gate", () => {
  const src = readFileSync(join(__dirname, "../app/admin/settings/page.tsx"), "utf8");
  it("renders for owners and admins (matches companies_update RLS)", () => {
    expect(src).toMatch(/\{isAdminPlus && \(\s*<FeatureVisibilitySection/);
    expect(src).not.toMatch(/isOwner && \(\s*<FeatureVisibilitySection/);
  });
});
