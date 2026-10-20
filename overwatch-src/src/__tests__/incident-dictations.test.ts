import { describe, it, expect } from "vitest";
import { mapDictation } from "@/lib/supabase/db-forms";
describe("mapDictation", () => {
  it("maps a saved dictation with segments", () => {
    const d = mapDictation({ id: "1", created_at: "2026-10-20 20:00:00", data: { transcript: "hi", segments: [{ speaker: 0, text: "hi" }, null], personType: "Witness", personName: " ", recordedBy: "ZZ Guard", recordedAt: "2026-10-20T19:59:00Z", linkedIncidentId: "x" } });
    expect(d).toEqual({ id: "1", transcript: "hi", segments: [{ speaker: 0, text: "hi" }], personType: "Witness", personName: null, recordedBy: "ZZ Guard", recordedAt: "2026-10-20T19:59:00Z" });
  });
  it("falls back to created_at and tolerates empty data", () => {
    const d = mapDictation({ id: "2", created_at: "2026-10-20 20:00:00", data: null });
    expect(d.transcript).toBe("");
    expect(d.segments).toBeUndefined();
    expect(d.recordedAt).toBe("2026-10-20 20:00:00");
  });
});
