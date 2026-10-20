import { describe, it, expect, beforeEach, vi } from "vitest";
const store = new Map<string, string>();
vi.stubGlobal("localStorage", { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v), removeItem: (k: string) => void store.delete(k), clear: () => store.clear() });
import { searchKB, snippetFor } from "@/lib/kb/search";
import { getPins, pinDoc, unpinDoc, isPinned } from "@/lib/kb/pins";

const docs = [
  { id: "1", title: "Fire alarm response", content: "Evacuate via stairwell B. Call 911.", folder_name: "Emergencies" },
  { id: "2", title: "Lobby opening", content: "Unlock doors at 6am. Check fire panel is green.", folder_name: "Post orders" },
  { id: "3", title: "Café key log", content: null, file_name: "keys.pdf", folder_name: "Admin" },
];
describe("searchKB", () => {
  it("ranks title matches above body matches and requires all words", () => {
    expect(searchKB(docs, "fire").map((h) => h.doc.id)).toEqual(["1", "2"]);
    expect(searchKB(docs, "fire panel").map((h) => h.doc.id)).toEqual(["2"]);
    expect(searchKB(docs, "x")).toEqual([]);
  });
  it("matches accents-insensitively and file/folder names", () => {
    expect(searchKB(docs, "cafe")[0].doc.id).toBe("3");
    expect(searchKB(docs, "keys.pdf")[0].doc.id).toBe("3");
    expect(searchKB(docs, "emergencies")[0].doc.id).toBe("1");
  });
  it("snippets around the hit", () => {
    expect(snippetFor("a ".repeat(100) + "stairwell B", "stairwell")).toMatch(/^….*stairwell B$/);
  });
});
describe("pins (text docs)", () => {
  beforeEach(() => localStorage.clear());
  it("pins, lists, unpins", async () => {
    await pinDoc("co", { id: "1", title: "Fire", content: "x", file_url: null, file_name: null, mime_type: null, folder_name: "E" });
    expect(isPinned("co", "1")).toBe(true);
    expect(getPins("co")[0]).toMatchObject({ id: "1", fileCached: false });
    expect(getPins("other")).toEqual([]);
    await unpinDoc("co", "1");
    expect(isPinned("co", "1")).toBe(false);
  });
});
