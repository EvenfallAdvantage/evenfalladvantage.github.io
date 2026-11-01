// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { CommsTabs } from "@/components/comms-tabs";
import { navPathname } from "@/components/layout/nav-items";

vi.mock("next/link", () => ({ default: ({ href, children, ...p }: { href: string; children: React.ReactNode }) => <a href={href} {...p}>{children}</a> }));

describe("Comms tab row", () => {
  it("keeps every tab, Scanner included, when Briefings is active", () => {
    Element.prototype.scrollIntoView = vi.fn();
    render(<CommsTabs active="briefings" />);
    const tabs = screen.getAllByRole("tab").map((t) => t.textContent);
    expect(tabs).toEqual(["Briefings", "Channels", "Messages", "External Groups", "Scanner"]);
    expect(screen.getByRole("tab", { selected: true }).textContent).toBe("Briefings");
  });
  it("highlights Comms in the nav on the Briefings route", () => {
    expect(navPathname("/updates")).toBe("/chat");
    expect(navPathname("/patrols")).toBe("/patrols");
  });
});
