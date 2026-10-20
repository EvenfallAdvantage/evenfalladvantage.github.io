import { assert, assertEquals } from "jsr:@std/assert@1";
import { ShipBuffer, StreamSession } from "./lib.ts";
import { collectAisstream, ERROR_CLOSE_GRACE_MS } from "./collect.ts";

Deno.test("StreamSession: client window close, gaps and timings", () => {
  const s = new StreamSession(1000);
  s.open(1200, "permessage-deflate");
  s.message(1300); s.message(1350); s.message(4350); // 3000 ms gap
  s.clientClose(41_200, "window");
  const r = s.summary(41_300);
  assertEquals(r.ended_by, "client:window");
  assertEquals(r.connect_ms, 200);
  assertEquals(r.session_ms, 40_000);
  assertEquals(r.messages, 3);
  assertEquals(r.first_msg_ms, 100);
  assertEquals(r.last_msg_ms, 3150);
  assertEquals(r.max_gap_ms, 36_850); // silence from the last message to our close
  assertEquals(r.extensions, "permessage-deflate");
});

Deno.test("StreamSession: error then close records code/reason as an error end", () => {
  const s = new StreamSession(0);
  s.open(100, "");
  s.message(200);
  s.onError(30_000, "Unexpected EOF");
  s.onClose(30_050, 1006, "", false);
  const r = s.summary(31_000);
  assertEquals([r.ended_by, r.close_code, r.close_reason, r.was_clean, r.error], ["error", 1006, null, false, "Unexpected EOF"]);
  assertEquals(r.session_ms, 29_950);
  assertEquals(r.extensions, "");
});

Deno.test("StreamSession: server close without error, connect failure, server error object", () => {
  const a = new StreamSession(0); a.open(50); a.onClose(20_000, 1001, "going away", true);
  assertEquals([a.summary(0).ended_by, a.summary(0).close_code, a.summary(0).close_reason], ["server_close", 1001, "going away"]);
  const b = new StreamSession(0); b.onError(300, null);
  assertEquals([b.summary(400).ended_by, b.summary(400).connect_ms, b.summary(400).error], ["connect_failed", null, "error event (no detail)"]);
  const c = new StreamSession(0); c.open(10); c.serverErrorMessage(20, "Api Key Is Not Valid");
  assertEquals([c.summary(30).ended_by, c.summary(30).server_error], ["subscribe_error", "Api Key Is Not Valid"]);
});

// Fake WebSocket driven by the test.
class FakeWs {
  binaryType = ""; extensions = "permessage-deflate"; sent: string[] = []; closedWith: unknown[] | null = null;
  onopen: (() => void) | null = null; onmessage: ((e: { data: unknown }) => void) | null = null;
  onerror: ((e: unknown) => void) | null = null; onclose: ((e: unknown) => void) | null = null;
  send(s: string) { this.sent.push(s); }
  close(...a: unknown[]) { this.closedWith = a; }
}
const pos = (mmsi: number) => JSON.stringify({ MessageType: "PositionReport", MetaData: { MMSI: mmsi }, Message: { PositionReport: { UserID: mmsi, Latitude: 51.9, Longitude: 4.05, Sog: 10, Cog: 90, TrueHeading: 91 } } });

Deno.test("collectAisstream: server drop mid-session reports error + close code, keeps old 'closed' field", async () => {
  let t = 0; const ws = new FakeWs();
  const p = collectAisstream(new ShipBuffer(), "k", 40_000, 4000, () => ws, () => t);
  t = 120; ws.onopen!();
  assertEquals(JSON.parse(ws.sent[0]).APIKey, "k");
  t = 500; ws.onmessage!({ data: pos(244650909) });
  t = 31_000; ws.onerror!({ message: "connection reset" });
  t = 31_040; ws.onclose!({ code: 1006, reason: "", wasClean: false });
  const r = await p;
  assertEquals([r.closed, r.ended_by, r.close_code, r.error, r.messages, r.connect_ms], ["error", "error", 1006, "connection reset", 1, 120]);
  assertEquals(r.session_ms, 30_920);
  assert(!("APIKey" in r));
});

Deno.test("collectAisstream: error without a close event resolves after the grace period", async () => {
  let t = 0; const ws = new FakeWs();
  const p = collectAisstream(new ShipBuffer(), "k", 40_000, 4000, () => ws, () => t);
  t = 100; ws.onopen!();
  t = 5_000; ws.onerror!({});
  const start = Date.now();
  const r = await p;
  assert(Date.now() - start >= ERROR_CLOSE_GRACE_MS - 50);
  assertEquals([r.ended_by, r.close_code, r.error], ["error", null, "error event (no detail)"]);
});

Deno.test("collectAisstream: cap closes from our side", async () => {
  let t = 0; const ws = new FakeWs();
  const p = collectAisstream(new ShipBuffer(), "k", 40_000, 2, () => ws, () => t);
  ws.onopen!(); t = 10; ws.onmessage!({ data: pos(244650909) }); t = 20; ws.onmessage!({ data: pos(244650910) });
  const r = await p;
  assertEquals([r.closed, r.ended_by, r.messages], ["cap", "client:cap", 2]);
  assertEquals(ws.closedWith, [1000, "cap"]);
});
