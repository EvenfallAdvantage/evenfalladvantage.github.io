import { getCorsHeaders } from "../_shared/cors.ts";

// Timestamps from lightningmaps.org are in epoch-ms.
interface Stroke {
  id: number;
  time: number; // epoch ms
  lat: number;
  lon: number;
  src: number;
}

Deno.serve(async (req: Request) => {
  const origin = req.headers.get("origin");
  const cors = getCorsHeaders(origin);

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: cors });
  }

  try {
    const strokes = await collectStrokes(4_000);

    return new Response(
      JSON.stringify({
        type: "FeatureCollection",
        features: strokes.map((s) => ({
          type: "Feature",
          geometry: { type: "Point", coordinates: [s.lon, s.lat] },
          properties: { time: s.time / 1000, id: s.id, src: s.src },
        })),
      }),
      {
        headers: {
          ...cors,
          "Content-Type": "application/json",
          "Cache-Control": "public, s-maxage=10",
        },
      },
    );
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }
});

async function collectStrokes(durationMs: number): Promise<Stroke[]> {
  return new Promise((resolve, reject) => {
    const strokes: Stroke[] = [];
    const seen = new Set<number>();
    let ws: WebSocket;
    let settled = false;

    const finish = () => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      try {
        ws?.close();
      } catch { /* ok */ }
      resolve(strokes);
    };

    const timer = setTimeout(finish, durationMs);

    try {
      ws = new WebSocket("wss://live.lightningmaps.org");
      ws.binaryType = "arraybuffer";

      ws.onopen = () => {
        ws.send(JSON.stringify({
          v: 24,
          i: {},
          s: true,
          x: 0,
          w: 0,
          tx: 0,
          tw: 0,
          a: 4,
          z: 5,
          b: true,
          h: "",
          l: 0,
          t: 0,
          from_lightningmaps_org: true,
          p: [90, 180, -90, -180],
          r: "feed",
        }));
      };

      ws.onmessage = (event: MessageEvent) => {
        try {
          const text = typeof event.data === "string" ? event.data : new TextDecoder().decode(event.data as ArrayBuffer);
          const msg = JSON.parse(text);
          const list = msg?.strokes ?? [];
          for (const s of list) {
            if (!s.id || seen.has(s.id)) continue;
            seen.add(s.id);
            if (Number.isFinite(s.lat) && Number.isFinite(s.lon)) {
              strokes.push({ id: s.id, time: s.time, lat: s.lat, lon: s.lon, src: s.src ?? 0 });
            }
          }
        } catch { /* skip unparseable messages */ }
      };

      ws.onerror = () => {
        if (!settled) reject(new Error("WebSocket connection failed"));
      };

      ws.onclose = finish;
    } catch (err) {
      clearTimeout(timer);
      reject(err);
    }
  });
}
