// @vitest-environment happy-dom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react";

const createShiftMock = vi.fn();
const getEventShiftsMock = vi.fn();

vi.mock("@/lib/supabase/db", () => ({
  createShift: (...args: unknown[]) => createShiftMock(...args),
  getEventShifts: (...args: unknown[]) => getEventShiftsMock(...args),
}));

import {
  QuickFillPanel,
  clampPostCount,
  expandQuickFillPosts,
} from "@/app/admin/events/components/shift-management/quick-fill-panel";

afterEach(() => {
  cleanup();
  createShiftMock.mockReset();
  getEventShiftsMock.mockReset();
});

describe("QuickFillPanel post count expansion", () => {
  it("clamps post counts into 1..99", () => {
    expect(clampPostCount(1)).toBe(1);
    expect(clampPostCount(10)).toBe(10);
    expect(clampPostCount(0)).toBe(1);
    expect(clampPostCount(-5)).toBe(1);
    expect(clampPostCount("abc")).toBe(1);
    expect(clampPostCount(150)).toBe(99);
  });

  it("expands count=1 as a single unnumbered post and count>1 as numbered posts 1..N", () => {
    expect(
      expandQuickFillPosts([
        { name: "Front Gate", count: 1 },
        { name: "Agent", count: 10 },
      ]),
    ).toEqual([
      "Front Gate",
      "Agent 1",
      "Agent 2",
      "Agent 3",
      "Agent 4",
      "Agent 5",
      "Agent 6",
      "Agent 7",
      "Agent 8",
      "Agent 9",
      "Agent 10",
    ]);
  });

  it("generates Agent 1 through Agent 10 shifts when [10] [Agent] is added", async () => {
    createShiftMock.mockResolvedValue({ id: "s1" });
    getEventShiftsMock.mockResolvedValue([]);
    const onShiftsChange = vi.fn();
    const onClose = vi.fn();

    render(
      <QuickFillPanel
        eventId="ev-1"
        opDays={["2026-10-28"]}
        eventTimezone="America/New_York"
        onShiftsChange={onShiftsChange}
        onClose={onClose}
      />,
    );

    const countInput = screen.getByLabelText("Post count");
    const nameInput = screen.getByLabelText("Post or position name");
    const addBtn = screen.getByLabelText("Add post");

    fireEvent.change(countInput, { target: { value: "10" } });
    fireEvent.change(nameInput, { target: { value: "Agent" } });
    fireEvent.click(addBtn);

    // Select 12-Hour (2 periods: Day / Night) and Select All days (1 day)
    fireEvent.click(screen.getByText("12-Hour (Day / Night)"));
    fireEvent.click(screen.getByText("Select All"));

    // 10 expanded posts × 2 periods × 1 day = 20 shifts
    const genBtn = screen.getByRole("button", { name: /Generate 20 Shifts/i });
    expect(genBtn).toBeTruthy();
    expect(screen.getByText("10 posts × 2 periods × 1 day")).toBeTruthy();

    fireEvent.click(genBtn);

    await waitFor(() => {
      expect(createShiftMock).toHaveBeenCalledTimes(20);
    });

    const roles = createShiftMock.mock.calls.map((c) => (c[0] as { role: string }).role);
    expect(roles.slice(0, 10)).toEqual([
      "Agent 1 — Day",
      "Agent 2 — Day",
      "Agent 3 — Day",
      "Agent 4 — Day",
      "Agent 5 — Day",
      "Agent 6 — Day",
      "Agent 7 — Day",
      "Agent 8 — Day",
      "Agent 9 — Day",
      "Agent 10 — Day",
    ]);
    expect(roles.slice(10, 20)).toEqual([
      "Agent 1 — Night",
      "Agent 2 — Night",
      "Agent 3 — Night",
      "Agent 4 — Night",
      "Agent 5 — Night",
      "Agent 6 — Night",
      "Agent 7 — Night",
      "Agent 8 — Night",
      "Agent 9 — Night",
      "Agent 10 — Night",
    ]);
    expect(onShiftsChange).toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });
});
