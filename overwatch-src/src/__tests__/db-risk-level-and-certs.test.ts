import { describe, it, expect, vi, beforeEach } from "vitest";
import { createMockSupabase } from "./helpers/mock-supabase";

const { client: mockClient, queryBuilder } = createMockSupabase();

vi.mock("@/lib/supabase/client", () => ({ createClient: () => mockClient }));
vi.mock("@/lib/supabase/db-helpers", () => ({ ensureInternalUser: vi.fn().mockResolvedValue("internal-user-1") }));
vi.mock("./client", () => ({ createClient: () => mockClient }));

import {
  DB_RISK_LEVELS, toDbRiskLevel, fromDbRiskLevel, saveSiteAssessment, getCompanyAssessments,
} from "@/lib/supabase/db-assessments";
import { getEventUserCertifications } from "@/lib/supabase/db-certifications";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("site_assessments risk_level normalisation", () => {
  // Mirrors the live constraint:
  // CHECK (risk_level = ANY (ARRAY['low','moderate','high','critical']))
  it("matches the DB check constraint values", () => {
    expect([...DB_RISK_LEVELS]).toEqual(["low", "moderate", "high", "critical"]);
  });

  it.each([
    ["Low", "low"], ["Moderate", "moderate"], ["High", "high"], ["Critical", "critical"],
    ["  CRITICAL ", "critical"], ["medium", "moderate"], ["Minimal", "low"],
  ])("maps %j to %j", (input, expected) => {
    expect(toDbRiskLevel(input)).toBe(expected);
  });

  it("returns null for empty or unknown values instead of violating the constraint", () => {
    expect(toDbRiskLevel(undefined)).toBeNull();
    expect(toDbRiskLevel("")).toBeNull();
    expect(toDbRiskLevel("purple")).toBeNull();
  });

  it("maps stored values back to the title case the UI compares against", () => {
    expect(fromDbRiskLevel("critical")).toBe("Critical");
    expect(fromDbRiskLevel("moderate")).toBe("Moderate");
    expect(fromDbRiskLevel(null)).toBeNull();
  });

  it("saves the scorer's title-case level as the lowercase DB value and returns title case", async () => {
    queryBuilder.single.mockResolvedValueOnce({ data: { id: "a1", risk_level: "high" }, error: null });
    const saved = await saveSiteAssessment("comp-1", { data: {}, risk_level: "High", risk_score: 60 });
    const insertArg = queryBuilder.insert.mock.calls[0][0] as Record<string, unknown>;
    expect(insertArg.risk_level).toBe("high");
    expect(saved.risk_level).toBe("High");
  });

  it("normalises rows on read", async () => {
    queryBuilder.then = vi.fn((resolve: (v: unknown) => void) =>
      Promise.resolve({ data: [{ id: "a1", risk_level: "critical" }, { id: "a2", risk_level: null }], error: null }).then(resolve),
    );
    const rows = await getCompanyAssessments("comp-1");
    expect(rows.map((r) => r.risk_level)).toEqual(["Critical", null]);
  });
});

describe("getEventUserCertifications() shifts query", () => {
  it("filters assigned shifts with NOT IS NULL (never neq.null on a uuid column)", async () => {
    queryBuilder.then = vi.fn((resolve: (v: unknown) => void) =>
      Promise.resolve({ data: [], error: null }).then(resolve),
    );
    await getEventUserCertifications("event-1");
    expect(mockClient.from).toHaveBeenCalledWith("shifts");
    expect(queryBuilder.not).toHaveBeenCalledWith("assigned_user_id", "is", null);
    expect(queryBuilder.neq).not.toHaveBeenCalled();
    expect(queryBuilder.is).not.toHaveBeenCalledWith("assigned_user_id", null);
  });

  it("looks up certifications for the distinct assigned users and flags ABC certs", async () => {
    let call = 0;
    queryBuilder.then = vi.fn((resolve: (v: unknown) => void) => {
      call += 1;
      const payload = call === 1
        ? { data: [{ assigned_user_id: "u1" }, { assigned_user_id: "u1" }, { assigned_user_id: "u2" }], error: null }
        : { data: [{ user_id: "u1", cert_type: "ABC Certification", state_issued: "CA" }, { user_id: "u2", cert_type: "Guard Card" }], error: null };
      return Promise.resolve(payload).then(resolve);
    });
    const result = await getEventUserCertifications("event-1");
    expect(queryBuilder.in).toHaveBeenCalledWith("user_id", ["u1", "u2"]);
    expect(result).toEqual({ u1: { hasAbcCert: true, abcState: "CA" }, u2: { hasAbcCert: false, abcState: null } });
  });
});
