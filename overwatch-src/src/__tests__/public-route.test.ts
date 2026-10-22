import { describe, expect, it } from "vitest";
import { isPublicRoute } from "@/components/app-shell";

describe("isPublicRoute", () => {
  it("matches public pages", () => {
    expect(isPublicRoute("/status/")).toBe(true);
    expect(isPublicRoute("/health")).toBe(true);
    expect(isPublicRoute("/")).toBe(true);
  });
  it("ignores doubled slashes", () => {
    expect(isPublicRoute("//status//")).toBe(true);
    expect(isPublicRoute("//careers/")).toBe(true);
    expect(isPublicRoute("//")).toBe(true);
  });
  it("keeps app pages private", () => {
    expect(isPublicRoute("/feed/")).toBe(false);
    expect(isPublicRoute("//feed//")).toBe(false);
  });
});
