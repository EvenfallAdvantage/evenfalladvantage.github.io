import { describe, it, expect } from "vitest";
import { pickMyPost, hasPostOrders, startsIn, directionsUrl } from "@/lib/post/my-post";

const now = new Date("2026-10-19T20:00:00Z");
const sh = (id: string, startH: number, endH: number, extra = {}) => ({ id, start_time: new Date(now.getTime() + startH * 3600e3).toISOString().replace("Z", ""), end_time: new Date(now.getTime() + endH * 3600e3).toISOString().replace("Z", ""), ...extra });

describe("my post", () => {
  it("prefers the shift on now (incl. 30 min early), else the next within 7 days", () => {
    expect(pickMyPost([sh("a", 2, 10), sh("b", -1, 3)], now)).toMatchObject({ shift: { id: "b" }, state: "on_now" });
    expect(pickMyPost([sh("a", 0.4, 8)], now)?.state).toBe("on_now");
    expect(pickMyPost([sh("c", 30, 38), sh("a", 5, 13)], now)).toMatchObject({ shift: { id: "a" }, state: "upcoming" });
    expect(pickMyPost([sh("far", 24 * 8, 24 * 8 + 8), sh("past", -10, -2)], now)).toBeNull();
  });
  it("detects post orders and formats start", () => {
    expect(hasPostOrders({ events: { post_orders: " " }, post_orders: null })).toBe(false);
    expect(hasPostOrders({ events: { post_orders: "Stay at gate" } })).toBe(true);
    expect(startsIn(sh("a", 0.5, 8), now)).toBe("Starts in 30 min");
    expect(startsIn(sh("a", 3, 8), now)).toBe("Starts in 3h");
  });
  it("builds directions links", () => {
    expect(directionsUrl({ location_lat: 1, location_lng: 2 })).toContain("destination=1,2");
    expect(directionsUrl({ location: "1 Main St" })).toContain("1%20Main%20St");
    expect(directionsUrl({})).toBeNull();
  });
});
