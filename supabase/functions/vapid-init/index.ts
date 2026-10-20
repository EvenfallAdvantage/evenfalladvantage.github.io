// Retired one-time VAPID initializer (keys now live in Vault). Always 410. Safe to delete from the dashboard.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
Deno.serve(() => new Response(JSON.stringify({ error: "gone" }), { status: 410, headers: { "Content-Type": "application/json" } }));
