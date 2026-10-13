import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createMockSupabase } from "./helpers/mock-supabase";

const { client: legacyMock, queryBuilder } = createMockSupabase();
const getSession = vi.fn();

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({ auth: { getSession } }),
}));
vi.mock("@/lib/legacy/client", () => ({
  getLegacyClient: () => legacyMock,
}));
vi.mock("@/stores/auth-store", () => ({
  useAuthStore: { getState: () => ({ activeCompanyId: "20000000-0000-0000-0000-00000000000a" }) },
}));

import { legacyBridgeWrite, _resetLegacyBridgeState } from "@/lib/legacy/bridge";
import { createLegacyCourse } from "@/lib/legacy/courses";
import { createLegacySlide, toSlideRow, updateLegacyProgress, createLegacyModule, updateLegacySlide, deleteLegacySlide } from "@/lib/legacy/modules";
import { updateLegacyCourse } from "@/lib/legacy/courses";
import { enrollStudentInClass, removeStudentFromClass, updateLegacyClass } from "@/lib/legacy/classes";
import { createLegacyAssessment, updateLegacyAssessment } from "@/lib/legacy/assessments";
import { createLegacyStudentProfile } from "@/lib/legacy/students";
import { createLegacyClass, markAttendance, toClassRow } from "@/lib/legacy/classes";
import { issueLegacyCertificate } from "@/lib/legacy/certificates";

const fetchMock = vi.fn();
const jsonRes = (status: number, body: unknown) =>
  ({ status, ok: status >= 200 && status < 300, json: () => Promise.resolve(body) }) as Response;

beforeEach(() => {
  vi.clearAllMocks();
  _resetLegacyBridgeState();
  vi.stubGlobal("fetch", fetchMock);
  vi.stubEnv("NEXT_PUBLIC_LEGACY_SUPABASE_URL", "https://eadb.example.co");
  vi.stubEnv("NEXT_PUBLIC_LEGACY_SUPABASE_ANON_KEY", "legacy-anon");
  vi.stubEnv("NEXT_PUBLIC_LEGACY_BRIDGE_MODE", "");
  getSession.mockResolvedValue({ data: { session: { access_token: "ow-token" } } });
  queryBuilder.single.mockResolvedValue({ data: { id: "direct-id" }, error: null });
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("legacyBridgeWrite()", () => {
  it("POSTs op + args with the Overwatch token and active company", async () => {
    fetchMock.mockResolvedValueOnce(jsonRes(200, { ok: true, id: "new-id" }));

    const r = await legacyBridgeWrite("course.create", { values: { course_code: "C1" } });

    expect(r).toEqual({ status: "ok", id: "new-id" });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://eadb.example.co/functions/v1/legacy-bridge-write");
    expect(init.headers).toMatchObject({
      Authorization: "Bearer ow-token",
      apikey: "legacy-anon",
      "x-overwatch-company": "20000000-0000-0000-0000-00000000000a",
    });
    expect(JSON.parse(init.body)).toEqual({ op: "course.create", args: { values: { course_code: "C1" } } });
  });

  it("returns an error (no fallback) when the server refuses", async () => {
    fetchMock.mockResolvedValueOnce(jsonRes(403, { error: "forbidden" }));
    expect(await legacyBridgeWrite("slide.delete", { keys: { id: "x" } })).toEqual({ status: "error", error: "forbidden", httpStatus: 403 });
  });

  it("treats 404 from the gateway (function not deployed) as unavailable and caches it", async () => {
    fetchMock.mockResolvedValueOnce(jsonRes(404, { message: "Function not found" }));
    expect(await legacyBridgeWrite("course.update")).toEqual({ status: "unavailable" });
    expect(await legacyBridgeWrite("course.update")).toEqual({ status: "unavailable" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("does not treat the function's own unknown_op 404 as unavailable", async () => {
    fetchMock.mockResolvedValueOnce(jsonRes(404, { error: "unknown_op" }));
    expect(await legacyBridgeWrite("course.update")).toMatchObject({ status: "error", error: "unknown_op" });
  });

  it("treats a network/CORS failure as unavailable", async () => {
    fetchMock.mockRejectedValueOnce(new TypeError("Failed to fetch"));
    expect(await legacyBridgeWrite("course.update")).toEqual({ status: "unavailable" });
  });

  it("server mode never falls back", async () => {
    vi.stubEnv("NEXT_PUBLIC_LEGACY_BRIDGE_MODE", "server");
    fetchMock.mockResolvedValueOnce(jsonRes(404, {}));
    expect(await legacyBridgeWrite("course.update")).toMatchObject({ status: "error", error: "bridge_not_deployed" });
  });

  it("requires an Overwatch session", async () => {
    getSession.mockResolvedValueOnce({ data: { session: null } });
    expect(await legacyBridgeWrite("course.update")).toEqual({ status: "error", error: "not_signed_in" });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("legacy write helpers", () => {
  it("createLegacyCourse goes through the bridge and skips the anon write", async () => {
    fetchMock.mockResolvedValueOnce(jsonRes(200, { ok: true, id: "srv-id" }));
    expect(await createLegacyCourse({ course_code: "C1", course_name: "Basics" })).toEqual({ success: true, id: "srv-id" });
    expect(legacyMock.from).not.toHaveBeenCalled();
  });

  it("createLegacyCourse falls back to the direct write when the bridge is not deployed", async () => {
    fetchMock.mockResolvedValueOnce(jsonRes(404, {}));
    expect(await createLegacyCourse({ course_code: "C1", course_name: "Basics" })).toEqual({ success: true, id: "direct-id" });
    expect(legacyMock.from).toHaveBeenCalledWith("courses");
  });

  it("bridge errors are reported as failures", async () => {
    fetchMock.mockResolvedValueOnce(jsonRes(403, { error: "forbidden" }));
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(await createLegacyCourse({ course_code: "C1", course_name: "Basics" })).toMatchObject({ success: false });
    spy.mockRestore();
  });

  it("slides send `content` (the real EADB column), not content_html", async () => {
    expect(toSlideRow({ title: "T", content_html: "<p>x</p>" })).toEqual({ title: "T", content: "<p>x</p>" });
    fetchMock.mockResolvedValueOnce(jsonRes(200, { ok: true, id: "s1" }));
    await createLegacySlide({ module_id: "m1", title: "T", content_html: "<p>x</p>", slide_number: 1 });
    expect(JSON.parse(fetchMock.mock.calls[0][1].body).args.values).toEqual({ module_id: "m1", title: "T", content: "<p>x</p>", slide_number: 1 });
  });

  it("classes send `capacity` instead of max_students", async () => {
    expect(toClassRow({ class_name: "A", max_students: 12 })).toEqual({ class_name: "A", capacity: 12 });
    fetchMock.mockResolvedValueOnce(jsonRes(200, { ok: true, id: "c1" }));
    await createLegacyClass({ instructor_id: "i1", class_name: "A", scheduled_date: "2026-10-10", start_time: "09:00", max_students: 12 });
    expect(JSON.parse(fetchMock.mock.calls[0][1].body).args.values).toMatchObject({ capacity: 12 });
  });

  it("attendance uses attendance_status, also on the direct fallback", async () => {
    fetchMock.mockResolvedValueOnce(jsonRes(404, {}));
    queryBuilder.upsert.mockReturnValueOnce(Promise.resolve({ data: null, error: null }) as never);
    await markAttendance("c1", "s1", "late");
    expect(queryBuilder.upsert).toHaveBeenCalledWith(
      { class_id: "c1", student_id: "s1", attendance_status: "late", notes: null },
      { onConflict: "class_id,student_id" },
    );
  });

  it("certificate.issue never sends issued_by (server resolves it)", async () => {
    fetchMock.mockResolvedValueOnce(jsonRes(200, { ok: true, id: "cert1" }));
    await issueLegacyCertificate({ student_id: "s1", issued_by: "spoofed", certificate_type: "t", certificate_name: "n" });
    expect(JSON.parse(fetchMock.mock.calls[0][1].body).args.values).toEqual({ student_id: "s1", certificate_type: "t", certificate_name: "n" });
  });
});

describe("progress.save (training viewer)", () => {
  it("sends only module + percent + slide; the server resolves the student", async () => {
    fetchMock.mockResolvedValueOnce(jsonRes(200, { ok: true }));
    expect(await updateLegacyProgress("client-student-id", "m1", { progress_percentage: 50, current_slide: 4 })).toEqual({ success: true });
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({
      op: "progress.save", args: { keys: { module_id: "m1" }, values: { progress_percentage: 50, current_slide: 4 } },
    });
    expect(legacyMock.from).not.toHaveBeenCalled();
  });
});

describe("server mode: no direct EADB write ever", () => {
  const calls: Array<[string, () => Promise<unknown>]> = [
    ["createLegacyCourse", () => createLegacyCourse({ course_code: "C1", course_name: "B" })],
    ["updateLegacyCourse", () => updateLegacyCourse("c1", { course_name: "B" })],
    ["createLegacyModule", () => createLegacyModule({ module_code: "M", module_name: "N" } as never)],
    ["createLegacySlide", () => createLegacySlide({ module_id: "m1", title: "T", slide_number: 1 })],
    ["updateLegacySlide", () => updateLegacySlide("s1", { title: "T" })],
    ["deleteLegacySlide", () => deleteLegacySlide("s1")],
    ["createLegacyClass", () => createLegacyClass({ instructor_id: "i1", class_name: "A", scheduled_date: "2026-10-10", start_time: "09:00" })],
    ["updateLegacyClass", () => updateLegacyClass("c1", { class_name: "A" })],
    ["enrollStudentInClass", () => enrollStudentInClass("c1", "s1")],
    ["removeStudentFromClass", () => removeStudentFromClass("c1", "s1")],
    ["markAttendance", () => markAttendance("c1", "s1", "present")],
    ["createLegacyAssessment", () => createLegacyAssessment({ assessment_name: "A", total_questions: 1, passing_score: 70 } as never)],
    ["updateLegacyAssessment", () => updateLegacyAssessment("a1", { assessment_name: "A" })],
    ["issueLegacyCertificate", () => issueLegacyCertificate({ student_id: "s1", issued_by: "ignored", certificate_type: "t", certificate_name: "n" })],
    ["createLegacyStudentProfile", () => createLegacyStudentProfile("u1", "a@b.co", "A", "B")],
    ["updateLegacyProgress", () => updateLegacyProgress("s1", "m1", { progress_percentage: 10 })],
  ];
  for (const [name, call] of calls) {
    it(`${name}: bridge down (404) -> error, no anon write`, async () => {
      vi.stubEnv("NEXT_PUBLIC_LEGACY_BRIDGE_MODE", "server");
      fetchMock.mockResolvedValue(jsonRes(404, {}));
      const spy = vi.spyOn(console, "error").mockImplementation(() => {});
      const r = (await call()) as { success: boolean };
      spy.mockRestore();
      expect(r.success).toBe(false);
      expect(legacyMock.from).not.toHaveBeenCalled();
    });
  }
});
