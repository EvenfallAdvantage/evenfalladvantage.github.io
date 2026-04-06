import { describe, it, expect } from "vitest";

/**
 * Tests for cross-company data isolation logic.
 * These test the filtering patterns used in timesheet and analytics queries.
 */

type Timesheet = {
  id: string;
  user_id: string;
  company_id: string | null;
  event_id: string | null;
  events?: { company_id: string } | null;
};

// Simulate the getCompanyTimesheets filtering logic
function filterTimesheetsByCompany(timesheets: Timesheet[], companyId: string): Timesheet[] {
  // Primary: filter by company_id
  const direct = timesheets.filter(t => t.company_id === companyId);
  if (direct.length > 0) return direct;

  // Fallback: filter by event.company_id, exclude orphans
  return timesheets
    .filter(t => t.company_id === null)
    .filter(t => {
      if (!t.events) return false; // orphan — exclude
      return t.events.company_id === companyId;
    });
}

describe("Cross-Company Data Isolation", () => {
  const companyA = "company-aaa";
  const companyB = "company-bbb";
  const userId = "user-123";

  const timesheets: Timesheet[] = [
    // Company A timesheets (tagged)
    { id: "t1", user_id: userId, company_id: companyA, event_id: "e1", events: { company_id: companyA } },
    { id: "t2", user_id: userId, company_id: companyA, event_id: "e1", events: { company_id: companyA } },
    // Company B timesheets (tagged)
    { id: "t3", user_id: userId, company_id: companyB, event_id: "e2", events: { company_id: companyB } },
    // Orphan timesheet (no company, no event)
    { id: "t4", user_id: userId, company_id: null, event_id: null, events: null },
    // Legacy timesheet (no company_id but has event)
    { id: "t5", user_id: userId, company_id: null, event_id: "e3", events: { company_id: companyA } },
  ];

  it("returns only company A timesheets when filtering for company A", () => {
    const result = filterTimesheetsByCompany(timesheets, companyA);
    expect(result.map(t => t.id)).toEqual(["t1", "t2"]);
  });

  it("returns only company B timesheets when filtering for company B", () => {
    const result = filterTimesheetsByCompany(timesheets, companyB);
    expect(result.map(t => t.id)).toEqual(["t3"]);
  });

  it("does not include orphan timesheets", () => {
    const result = filterTimesheetsByCompany(timesheets, companyA);
    expect(result.find(t => t.id === "t4")).toBeUndefined();
  });

  it("company B does not see company A timesheets", () => {
    const result = filterTimesheetsByCompany(timesheets, companyB);
    expect(result.find(t => t.id === "t1")).toBeUndefined();
    expect(result.find(t => t.id === "t2")).toBeUndefined();
  });

  it("falls back to event.company_id when no tagged timesheets exist", () => {
    // Remove all tagged timesheets, only legacy remain
    const legacyOnly: Timesheet[] = [
      { id: "t5", user_id: userId, company_id: null, event_id: "e3", events: { company_id: companyA } },
      { id: "t6", user_id: userId, company_id: null, event_id: "e4", events: { company_id: companyB } },
      { id: "t7", user_id: userId, company_id: null, event_id: null, events: null },
    ];
    
    const resultA = filterTimesheetsByCompany(legacyOnly, companyA);
    expect(resultA.map(t => t.id)).toEqual(["t5"]);

    const resultB = filterTimesheetsByCompany(legacyOnly, companyB);
    expect(resultB.map(t => t.id)).toEqual(["t6"]);
  });

  it("returns empty array for company with no timesheets", () => {
    const result = filterTimesheetsByCompany(timesheets, "company-unknown");
    expect(result).toEqual([]);
  });
});

describe("Profile Sync — Field Selection", () => {
  const SYNC_KEYS = [
    "address", "bio", "guard_card_number", "guard_card_expiry",
    "emergency_contact_name", "emergency_contact_phone",
    "shirt_size", "jacket_size", "dietary_restrictions",
    "work_preferences", "whatsapp_opted_in",
  ];

  const NON_SYNC_KEYS = ["role", "hire_date", "status", "company_id", "user_id"];

  it("syncs personal fields across companies", () => {
    const payload: Record<string, unknown> = {
      address: "123 Main St",
      bio: "Security professional",
      shirt_size: "XL",
      role: "admin", // should NOT sync
      hire_date: "2026-01-01", // should NOT sync
    };

    const personalFields: Record<string, unknown> = {};
    for (const key of SYNC_KEYS) {
      if (key in payload) personalFields[key] = payload[key];
    }

    expect(personalFields).toHaveProperty("address");
    expect(personalFields).toHaveProperty("bio");
    expect(personalFields).toHaveProperty("shirt_size");
    expect(personalFields).not.toHaveProperty("role");
    expect(personalFields).not.toHaveProperty("hire_date");
  });

  it("does not sync company-specific fields", () => {
    for (const key of NON_SYNC_KEYS) {
      expect(SYNC_KEYS).not.toContain(key);
    }
  });

  it("syncs all 11 personal field types", () => {
    expect(SYNC_KEYS).toHaveLength(11);
  });
});
