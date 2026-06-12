import { getCorsHeaders } from "../_shared/cors.ts";

const TILE_BASE = "https://tiles.blitzortung.org/Tiles/01";

Deno.serve(async (req: Request) => {
  const origin = req.headers.get("origin");
  const cors = getCorsHeaders(origin);

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: cors });
  }

  const url = new URL(req.url);
  const tilePath = url.pathname.replace(/^\/?functions\/v1\/intel-lightning-tile/, "");
  if (!tilePath || tilePath === "/") {
    return new Response(JSON.stringify({ error: "Missing tile path: /z/x/y" }), {
      status: 400,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  const tileUrl = `${TILE_BASE}${tilePath}.png`;
  const tileRes = await fetch(tileUrl, {
    headers: { "User-Agent": "Overwatch/1.0", Accept: "image/png,*/*" },
    signal: AbortSignal.timeout(10_000),
  });

  if (!tileRes.ok) {
    return new Response(await tileRes.text(), {
      status: tileRes.status,
      headers: { ...cors },
    });
  }

  const blob = await tileRes.arrayBuffer();
  return new Response(blob, {
    status: 200,
    headers: {
      ...cors,
      "Content-Type": "image/png",
      "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300",
    },
  });
});
