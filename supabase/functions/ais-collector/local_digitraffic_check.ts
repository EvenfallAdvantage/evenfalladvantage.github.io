// Local check (no secrets, no Supabase): `deno run --allow-net=meri.digitraffic.fi ais-collector/local_digitraffic_check.ts`
import { ShipBuffer } from "./lib.ts";
import { collectDigitraffic } from "./collect.ts";
const buf = new ShipBuffer();
const t0 = Date.now();
const r = await collectDigitraffic(buf);
const rows = buf.rows();
console.log(JSON.stringify({ ms: Date.now() - t0, ...r, ships: rows.length, named: rows.filter((x) => x.name).length, sample: rows.slice(0, 2) }, null, 1));
