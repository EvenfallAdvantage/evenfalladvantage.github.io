import { describe, it, expect, vi } from "vitest";

const dispatch = vi.fn(async (_arg: unknown) => ({ inApp: true, push: true }));
vi.mock("@/lib/services/notification-dispatcher", () => ({ dispatch }));
vi.mock("@/lib/supabase/db-helpers", async (orig) => ({ ...(await orig() as object), ensureInternalUser: async () => "me" }));
const row = { id: "33333333-3333-4333-8333-333333333333", from_user_id: "me", to_user_id: "peer", content: "ZZTEST ping", file_url: null, created_at: "2026-10-20T20:00:00Z", read: false };
const chain: Record<string, unknown> = {};
for (const k of ["from", "insert", "select", "eq", "update"]) chain[k] = () => chain;
chain.single = async () => ({ data: row, error: null });
chain.maybeSingle = async () => ({ data: { first_name: "Zz", last_name: "Test" }, error: null });
vi.mock("@/lib/supabase/client", () => ({ createClient: () => chain }));
vi.mock("../lib/supabase/client", () => ({ createClient: () => chain }));

describe("sendDM wiring", () => {
  it("dispatches a rate-limited DM alert with a dm ref", async () => {
    const { sendDM } = await import("@/lib/supabase/db-messages");
    await sendDM("co", "peer", "ZZTEST ping");
    await sendDM("co", "peer", "second");
    await vi.waitFor(() => expect(dispatch).toHaveBeenCalledTimes(1));
    await new Promise((r) => setTimeout(r, 50));
    expect(dispatch).toHaveBeenCalledTimes(1);
    expect(dispatch.mock.calls[0][0]).toMatchObject({ userId: "peer", type: "dm", title: "Message from Zz T.", body: "ZZTEST ping", ref: { type: "dm", id: row.id } });
  });
});
