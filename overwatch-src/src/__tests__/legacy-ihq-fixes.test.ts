import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createMockSupabase } from "./helpers/mock-supabase";

// Instructor HQ fixes found in the 2026-10-06 3:15-3:26 PM PT live test:
//  - class create always failed: scheduled_classes.class_type is NOT NULL (23502)
//  - no way to delete a course
//  - no way to write an assessment's questions

const { client: legacyMock, queryBuilder, setMockResponse } = createMockSupabase();
const getSession = vi.fn();

vi.mock("@/lib/supabase/client", () => ({ createClient: () => ({ auth: { getSession } }) }));
vi.mock("@/lib/legacy/client", () => ({ getLegacyClient: () => legacyMock }));
vi.mock("@/stores/auth-store", () => ({
  useAuthStore: { getState: () => ({ activeCompanyId: "20000000-0000-0000-0000-00000000000a" }) },
}));

import { _resetLegacyBridgeState, legacyWriteErrorMessage } from "@/lib/legacy/bridge";
import { deleteLegacyCourse } from "@/lib/legacy/courses";
import { createLegacyClass, getLegacyClasses, localDateString, LEGACY_CLASS_TYPES } from "@/lib/legacy/classes";
import {
  deleteLegacyAssessment, getLegacyAssessmentQuestions, saveLegacyAssessmentQuestions, validateLegacyQuestions, type LegacyQuestion,
} from "@/lib/legacy/assessments";

const fetchMock = vi.fn();
const jsonRes = (status: number, body: unknown) =>
  ({ status, ok: status >= 200 && status < 300, json: () => Promise.resolve(body) }) as Response;
const sentBody = (i = 0) => JSON.parse(fetchMock.mock.calls[i][1].body);
const Q: LegacyQuestion = { question: "What is 2+2?", options: ["1", "2", "3", "4"], correctAnswer: 3, explanation: "maths" };

beforeEach(() => {
  vi.clearAllMocks();
  _resetLegacyBridgeState();
  vi.stubGlobal("fetch", fetchMock);
  vi.stubEnv("NEXT_PUBLIC_LEGACY_SUPABASE_URL", "https://eadb.example.co");
  vi.stubEnv("NEXT_PUBLIC_LEGACY_SUPABASE_ANON_KEY", "legacy-anon");
  vi.stubEnv("NEXT_PUBLIC_LEGACY_BRIDGE_MODE", "");
  getSession.mockResolvedValue({ data: { session: { access_token: "ow-token" } } });
  setMockResponse({ data: { id: "direct-id" }, error: null });
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("createLegacyClass: class_type (NOT NULL in EADB)", () => {
  const base = { instructor_id: "i-1", class_name: "Night shift", scheduled_date: "2026-10-20", start_time: "09:00", max_students: 12 };

  it("sends the chosen class_type and capacity to the bridge", async () => {
    fetchMock.mockResolvedValueOnce(jsonRes(200, { ok: true, id: "c-1" }));
    expect(await createLegacyClass({ ...base, class_type: "review" })).toEqual({ success: true, id: "c-1" });
    expect(sentBody()).toEqual({ op: "class.create", args: { values: {
      instructor_id: "i-1", class_name: "Night shift", scheduled_date: "2026-10-20", start_time: "09:00", capacity: 12, class_type: "review",
    } } });
  });

  it("defaults class_type to 'training'", async () => {
    fetchMock.mockResolvedValueOnce(jsonRes(200, { ok: true, id: "c-2" }));
    await createLegacyClass(base);
    expect(sentBody().args.values.class_type).toBe("training");
  });

  it("includes class_type on the direct (fallback) insert too", async () => {
    fetchMock.mockRejectedValueOnce(new TypeError("Failed to fetch"));
    expect(await createLegacyClass(base)).toEqual({ success: true, id: "direct-id" });
    expect(queryBuilder.insert).toHaveBeenCalledWith(expect.objectContaining({ class_type: "training", capacity: 12, status: "scheduled" }));
    expect(queryBuilder.insert.mock.calls[0][0]).not.toHaveProperty("max_students");
  });

  it("returns the server error instead of pretending it worked", async () => {
    fetchMock.mockResolvedValueOnce(jsonRes(500, { error: "write_failed", code: "23502" }));
    expect(await createLegacyClass(base)).toEqual({ success: false, error: "write_failed" });
  });

  it("offers the static portal's class types, 'training' first", () => {
    expect(LEGACY_CLASS_TYPES.map((t) => t.value)).toEqual(["training", "review", "scenario", "proctored_exam"]);
  });
});

describe("upcoming classes use the local date, not UTC", () => {
  it("localDateString() is the local calendar day", () => {
    expect(localDateString(new Date(2026, 9, 6, 23, 30))).toBe("2026-10-06");
    expect(localDateString(new Date(2026, 0, 2, 0, 5))).toBe("2026-01-02");
  });

  it("getLegacyClasses filters scheduled_date >= local today", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 9, 6, 22, 0));
    // Bridge path: sends the local date.
    fetchMock.mockResolvedValueOnce(jsonRes(200, { ok: true, data: [{ id: "c", capacity: 9, max_students: null }] }));
    const viaBridge = await getLegacyClasses("i-1");
    expect(sentBody(0)).toEqual({ op: "classes.list", args: { values: { from_date: "2026-10-06", instructor_id: "i-1" } } });
    expect(viaBridge[0].max_students).toBe(9);
    // Fallback path (bridge not deployed, auto mode): direct read, same filter.
    fetchMock.mockResolvedValueOnce(jsonRes(404, {}));
    setMockResponse({ data: [{ id: "c", capacity: 9, max_students: null }], error: null });
    const rows = await getLegacyClasses("i-1");
    expect(queryBuilder.gte).toHaveBeenCalledWith("scheduled_date", "2026-10-06");
    expect(queryBuilder.eq).toHaveBeenCalledWith("instructor_id", "i-1");
    expect(rows[0].max_students).toBe(9);
  });
});

describe("deleteLegacyCourse", () => {
  const ID = "93f18e55-2234-4b6a-ad30-be9a5c6b3c00";

  it("calls course.delete on the bridge", async () => {
    fetchMock.mockResolvedValueOnce(jsonRes(200, { ok: true }));
    expect(await deleteLegacyCourse(ID)).toEqual({ success: true });
    expect(sentBody()).toEqual({ op: "course.delete", args: { keys: { id: ID } } });
  });

  it("passes course_in_use through (students/payments attached)", async () => {
    fetchMock.mockResolvedValueOnce(jsonRes(409, { error: "course_in_use", enrollments: 3, payments: 0, reviews: 0 }));
    expect(await deleteLegacyCourse(ID)).toEqual({ success: false, error: "course_in_use" });
  });

  it("never falls back to a direct anon delete", async () => {
    fetchMock.mockRejectedValueOnce(new TypeError("Failed to fetch"));
    expect(await deleteLegacyCourse(ID)).toEqual({ success: false, error: "bridge_required" });
    expect(queryBuilder.delete).not.toHaveBeenCalled();
  });
});

describe("assessment questions", () => {
  const AID = "53590137-c17a-4813-9bb0-d33d0d8cd5db";

  it("loads questions through the bridge", async () => {
    fetchMock.mockResolvedValueOnce(jsonRes(200, { ok: true, data: { questions: [Q], source: "rows" } }));
    expect(await getLegacyAssessmentQuestions(AID)).toEqual({ success: true, questions: [Q] });
    expect(sentBody()).toEqual({ op: "assessment.get_questions", args: { keys: { id: AID } } });
  });

  it("falls back to questions_json when the bridge is unavailable", async () => {
    fetchMock.mockRejectedValueOnce(new TypeError("Failed to fetch"));
    setMockResponse({ data: { questions_json: [Q] }, error: null });
    expect(await getLegacyAssessmentQuestions(AID)).toEqual({ success: true, questions: [Q] });
    expect(legacyMock.from).toHaveBeenCalledWith("assessments");
  });

  it("saves trimmed questions with assessment.set_questions", async () => {
    fetchMock.mockResolvedValueOnce(jsonRes(200, { ok: true }));
    const r = await saveLegacyAssessmentQuestions(AID, [
      { question: "  Q1 ", options: [" a", "b ", "c", "d"], correctAnswer: 2, explanation: "  " },
    ]);
    expect(r).toEqual({ success: true });
    expect(sentBody()).toEqual({ op: "assessment.set_questions", args: {
      keys: { id: AID }, values: { questions: [{ question: "Q1", options: ["a", "b", "c", "d"], correctAnswer: 2 }] },
    } });
  });

  it("refuses to save without the bridge (no half-writes)", async () => {
    fetchMock.mockRejectedValueOnce(new TypeError("Failed to fetch"));
    expect(await saveLegacyAssessmentQuestions(AID, [Q])).toEqual({ success: false, error: "bridge_required" });
    expect(queryBuilder.update).not.toHaveBeenCalled();
  });

  it("validateLegacyQuestions explains what's missing", () => {
    expect(validateLegacyQuestions([])).toEqual(["Add at least one question."]);
    expect(validateLegacyQuestions([Q])).toEqual([]);
    expect(validateLegacyQuestions([{ ...Q, question: " ", options: ["a", "", "c", "d"] }])).toEqual([
      "Question 1 has no text.", "Question 1 needs all 4 answers filled in.",
    ]);
  });
});

describe("deleteLegacyAssessment", () => {
  const AID = "613f4bb4-6b59-4aca-b4f7-3f9e87539b0e";

  it("calls assessment.delete on the bridge", async () => {
    fetchMock.mockResolvedValueOnce(jsonRes(200, { ok: true }));
    expect(await deleteLegacyAssessment(AID)).toEqual({ success: true });
    expect(sentBody()).toEqual({ op: "assessment.delete", args: { keys: { id: AID } } });
  });

  it("passes assessment_in_use through (students have results)", async () => {
    fetchMock.mockResolvedValueOnce(jsonRes(409, { error: "assessment_in_use", results: 14 }));
    expect(await deleteLegacyAssessment(AID)).toEqual({ success: false, error: "assessment_in_use" });
  });

  it("reports an out-of-date server (unknown_op) instead of failing silently", async () => {
    fetchMock.mockResolvedValueOnce(jsonRes(404, { error: "unknown_op" }));
    expect(await deleteLegacyAssessment(AID)).toEqual({ success: false, error: "unknown_op" });
  });

  it("never falls back to a direct anon delete", async () => {
    fetchMock.mockRejectedValueOnce(new TypeError("Failed to fetch"));
    expect(await deleteLegacyAssessment(AID)).toEqual({ success: false, error: "bridge_required" });
    expect(queryBuilder.delete).not.toHaveBeenCalled();
  });
});

describe("legacyWriteErrorMessage", () => {
  it("turns error codes into plain words", () => {
    expect(legacyWriteErrorMessage("delete the course", "course_in_use")).toMatch(/students, payments or reviews/);
    expect(legacyWriteErrorMessage("delete the assessment", "assessment_in_use")).toMatch(/already taken it.*No linked module/);
    expect(legacyWriteErrorMessage("create the class", "invalid_value:class_type")).toBe('Couldn\'t create the class: check the "class type" field.');
    expect(legacyWriteErrorMessage("save", "write_failed")).toBe("Couldn't save: write_failed.");
    expect(legacyWriteErrorMessage("save")).toBe("Couldn't save: unknown error.");
  });
});
