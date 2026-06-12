import { getCorsHeaders } from "../_shared/cors.ts";

interface Strike {
  time: number;
  lat: number;
  lon: number;
  amp: number;
}

Deno.serve(async (req: Request) => {
  const origin = req.headers.get("origin");
  const cors = getCorsHeaders(origin);

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: cors });
  }

  try {
    const strikes = await collectStrikes(4_000);

    return new Response(
      JSON.stringify({
        type: "FeatureCollection",
        features: strikes.map((s) => ({
          type: "Feature",
          geometry: { type: "Point", coordinates: [s.lon, s.lat] },
          properties: { time: s.time, amplitude: s.amp },
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

async function collectStrikes(durationMs: number): Promise<Strike[]> {
  return new Promise((resolve, reject) => {
    const strikes: Strike[] = [];
    let ws: WebSocket;
    let settled = false;

    const finish = () => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      try {
        ws?.close();
      } catch {
        /* ok */
      }
      resolve(strikes);
    };

    const timer = setTimeout(finish, durationMs);

    try {
      ws = new WebSocket("ws://ws.blitzortung.org:3000");
      ws.binaryType = "arraybuffer";

      ws.onopen = () => {
        // connected — strikes will start flowing immediately
      };

      ws.onmessage = (event: MessageEvent) => {
        const buf = event.data as ArrayBuffer;
        if (!buf || buf.byteLength < 18) return;
        const view = new DataView(buf);
        for (let i = 0; i + 18 <= buf.byteLength; i += 18) {
          const time = view.getUint32(i, true);
          const micro = view.getUint32(i + 4, true);
          const lat = view.getInt32(i + 8, true) / 10_000_000;
          const lon = view.getInt32(i + 12, true) / 10_000_000;
          const amp = view.getUint16(i + 16, true);
          if (lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180) {
            strikes.push({ time: time + micro / 1_000_000, lat, lon, amp });
          }
        }
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
