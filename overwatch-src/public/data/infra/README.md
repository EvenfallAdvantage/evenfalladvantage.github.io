# Overwatch infrastructure extract

Pre-built, static extract used by the Operations map layer
Infrastructure > "Data centres, dams, power & military".

**Licence:** this extract is a database derived from OpenStreetMap and is
made available under the [Open Database License 1.0](https://opendatacommons.org/licenses/odbl/1-0/).
© OpenStreetMap contributors. Any rights in individual contents of the
database are licensed under the [Database Contents License](https://opendatacommons.org/licenses/dbcl/1-0/).

| Kind | Source | Notes |
|---|---|---|
| Data centres | OpenStreetMap, via gods-eye-view's bundled ODbL extract | `telecom=data_center` and similar |
| Dams | OpenStreetMap, via Open Infrastructure Map / gods-eye-view | |
| Military areas (named) | OpenStreetMap, via Overture Maps base/land_use / gods-eye-view | Name + class + OSM id |
| Substations (≥ 110 kV), transmission lines (≥ 345 kV) | OpenStreetMap via the Overpass API, US only | Present when `index.json` `sources.power` says so |

Format: `index.json` lists 10° cells; each `c_<lat>_<lng>.json` holds
`f` rows `[kind, lng, lat, name, extra?]` (`d` data centre, `w` dam,
`m` military area, `s` substation) and optional `l` lines `[kV, [[lng, lat], …]]`.
Contact-type tags are never copied.

Rebuild with `overwatch-src/scripts/build-infra-extract.mjs` (see its header).
Mapped features do not show current activity or complete coverage.
