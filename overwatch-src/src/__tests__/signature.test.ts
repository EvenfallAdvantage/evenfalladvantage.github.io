import { describe, it, expect, vi, beforeEach } from "vitest";
const PNG = "data:image/png;base64," + "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==";
const UID = "11111111-2222-4333-8444-555555555555";
const st = { upload: vi.fn(async () => ({ error: null })), remove: vi.fn(async () => ({ error: null })), download: vi.fn(async () => ({ data: null as Blob | null, error: { message: "nf" } as unknown })) };
const inserts: Record<string, unknown>[] = [];
let insertErrors: ({ code: string } | null)[] = [];
let selectResults: { data: unknown; error: { code: string } | null }[] = [];
const selects: string[] = [];
function client() {
  return {
    auth: { getUser: async () => ({ data: { user: { id: UID } } }) },
    storage: { from: (b: string) => { expect(b).toBe("signatures"); return st; } },
    from: () => ({
      insert: async (row: Record<string, unknown>) => { inserts.push(row); return { error: insertErrors.shift() ?? null }; },
      select: (cols: string) => { selects.push(cols); return { eq: () => ({ maybeSingle: async () => selectResults.shift() ?? { data: null, error: null } }) }; },
    }),
  };
}
vi.mock("@/lib/supabase/client", () => ({ createClient: () => client() }));
vi.mock("../lib/supabase/client", () => ({ createClient: () => client() }));
import { isValidSignatureDataUrl, signaturePath, saveMySignature, deleteMySignature, getMySignature, dataUrlToBlob, MAX_SIGNATURE_DATA_URL } from "@/lib/signature/signature";
import { signDAR, getDarSignoff } from "@/lib/supabase/db-dar";

beforeEach(() => { inserts.length = 0; selects.length = 0; insertErrors = []; selectResults = []; vi.clearAllMocks(); });

describe("signature helpers", () => {
  it("validates PNG data URLs only", () => {
    expect(isValidSignatureDataUrl(PNG)).toBe(true);
    expect(isValidSignatureDataUrl("data:image/jpeg;base64,AAAA")).toBe(false);
    expect(isValidSignatureDataUrl("data:image/png;base64,<script>")).toBe(false);
    expect(isValidSignatureDataUrl("data:image/png;base64," + "A".repeat(MAX_SIGNATURE_DATA_URL))).toBe(false);
    expect(isValidSignatureDataUrl(null)).toBe(false);
  });
  it("stores per user under the auth uid folder", () => {
    expect(signaturePath(UID)).toBe(`${UID}/signature.png`);
    expect(() => signaturePath("../other")).toThrow();
  });
  it("round-trips a data URL to a PNG blob", () => {
    const b = dataUrlToBlob(PNG);
    expect(b.type).toBe("image/png");
    expect(b.size).toBeGreaterThan(20);
  });
});

describe("saved signature storage", () => {
  it("uploads (upsert) to my own path and refuses bad input", async () => {
    expect(await saveMySignature(PNG)).toEqual({ ok: true });
    expect(st.upload).toHaveBeenCalledWith(`${UID}/signature.png`, expect.any(Blob), expect.objectContaining({ upsert: true, contentType: "image/png" }));
    expect(await saveMySignature("nope")).toEqual({ ok: false });
    expect(st.upload).toHaveBeenCalledTimes(1);
  });
  it("deletes my own file", async () => {
    expect(await deleteMySignature()).toEqual({ ok: true });
    expect(st.remove).toHaveBeenCalledWith([`${UID}/signature.png`]);
  });
  it("returns null when nothing is saved and a PNG data URL when it is", async () => {
    expect(await getMySignature()).toBeNull();
    st.download.mockResolvedValueOnce({ data: dataUrlToBlob(PNG), error: null });
    expect(await getMySignature()).toBe(PNG);
  });
});

describe("signDAR with a signature snapshot", () => {
  const base = { companyId: "c", timesheetId: "t", userId: "u", summary: "ok", signedName: "ZZ Guard", report: null };
  it("stores the snapshot on the sign-off row", async () => {
    expect(await signDAR({ ...base, signaturePng: PNG })).toEqual({ ok: true });
    expect(inserts[0].signature_png).toBe(PNG);
  });
  it("drops an invalid signature instead of sending it", async () => {
    await signDAR({ ...base, signaturePng: "data:text/html;base64,AAAA" });
    expect(inserts[0]).not.toHaveProperty("signature_png");
  });
  it("falls back to typed-name-only before the migration is applied", async () => {
    insertErrors = [{ code: "PGRST204" }, null];
    expect(await signDAR({ ...base, signaturePng: PNG })).toEqual({ ok: true });
    expect(inserts).toHaveLength(2);
    expect(inserts[1]).not.toHaveProperty("signature_png");
  });
});

describe("getDarSignoff with signature", () => {
  const row = { id: "s", timesheet_id: "t", summary: "x", signed_name: "ZZ", signed_at: "2026-10-21T00:00:00Z" };
  it("returns the snapshot", async () => {
    selectResults = [{ data: { ...row, signature_png: PNG }, error: null }];
    expect((await getDarSignoff("t"))?.signaturePng).toBe(PNG);
    expect(selects[0]).toContain("signature_png");
  });
  it("retries without the column when it doesn't exist yet", async () => {
    selectResults = [{ data: null, error: { code: "42703" } }, { data: row, error: null }];
    const s = await getDarSignoff("t");
    expect(s?.signedName).toBe("ZZ");
    expect(s?.signaturePng).toBeNull();
    expect(selects[1]).not.toContain("signature_png");
  });
});
