// @vitest-environment happy-dom
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import DeliveryChannelsSection from "@/app/admin/settings/components/delivery-channels-section";

describe("DeliveryChannelsSection", () => {
  it("links both delivery pages, including SMS", () => {
    render(<DeliveryChannelsSection integrations={[{ provider: "email", verified_at: "2026-06-12T00:00:00Z", delivery_method: "smtp" }]} />);
    expect(screen.getByRole("link", { name: /Email sending/ }).getAttribute("href")).toBe("/admin/settings/email");
    expect(screen.getByRole("link", { name: /SMS sending/ }).getAttribute("href")).toBe("/admin/settings/sms");
    expect(screen.getByText("Verified · smtp")).toBeTruthy();
    expect(screen.getByText("Using Overwatch sender")).toBeTruthy();
  });
});
