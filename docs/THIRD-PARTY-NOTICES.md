# Third-Party Notices

This document tracks vendored open-source code and external data sources used
by the Overwatch tactical map and Intel features.

## Vendored code

### Osiris — OSINT dashboard

- **Repository:** https://github.com/simplifaisoul/osiris
- **License:** MIT (declared in README; `LICENSE` file missing from upstream at
  time of vendoring — opened upstream issue to request commit)
- **Commit/version:** vendored as of May 2026 (Next.js 16 / React 19 era of
  the upstream tree)
- **Files derived from Osiris:**
  - `overwatch-src/src/lib/ssrf-guard.ts` — verbatim port, comments preserved
  - `overwatch-src/src/app/api/intel/*` — Next.js route handlers ported and
    namespaced under `/api/intel`
  - `overwatch-src/src/components/intel/*` — UI components (OSINT panel,
    camera viewer, intel feed, live alerts, etc.)
  - `overwatch-src/src/components/tactical-map/intel-drawer*` — RECON drawer
    integrated into the existing Cesium tactical map
- **Attribution requirement:** MIT requires preserving copyright notice and
  license text. The README's MIT declaration is the license-of-record.

## External data sources

Each Intel layer surfaces upstream data. Some sources require attribution on
display, some restrict commercial use, some require API keys for production.
The `src/lib/intel-feature-flags.ts` file is the source of truth for which
sources are currently enabled and any gating reasons.

### Fully public, no restrictions

| Source | Used for | API |
|---|---|---|
| USGS Earthquake Catalog | Earthquakes layer | `earthquake.usgs.gov` GeoJSON |
| NASA EONET | Severe weather events | `eonet.gsfc.nasa.gov` |
| NOAA SWPC | Space weather (Kp index) | `services.swpc.noaa.gov` |
| Google DNS-over-HTTPS | DNS lookups (RECON tab) | `dns.google/resolve` |
| MITRE CVE / CIRCL | CVE lookups (RECON tab) | `cveawg.mitre.org`, `cve.circl.lu` |
| BGPView | ASN / prefix lookups (RECON tab) | `api.bgpview.io` |
| crt.sh | Certificate transparency (RECON tab) | `crt.sh` |
| ip-api.com | IP geolocation (RECON tab) | `ip-api.com` (free tier non-commercial; permission requested 2026-10-16) |
| AlienVault OTX | Threat intel (RECON tab) | `otx.alienvault.com` |
| Shodan InternetDB | IP sweep (RECON tab) | `internetdb.shodan.io` |
| CISA KEV | Cyber threats status bar | `cisa.gov` |
| RestCountries | Region dossier | `restcountries.com` |
| Wikipedia / Wikidata | Region dossier | `*.wikipedia.org`, `query.wikidata.org` |
| Nominatim | Reverse geocoding, region dossier | `nominatim.openstreetmap.org` |
| RDAP via rdap.org | WHOIS lookups (RECON tab) | `rdap.org` |

### Free with attribution required

The public, user-facing list (exact credit strings + licence links) is
`/data-sources.html` at the site root (https://www.evenfalladvantage.com/data-sources.html).
Keep this table and that page in sync.

| Source | Used for | Attribution string / licence |
|---|---|---|
| NASA FIRMS (VIIRS/MODIS) | Active fires layer | "NASA FIRMS" (NASA data policy) |
| NASA EONET imagery | EONET events layer | "NASA EONET" |
| CelesTrak TLE catalog | Satellite orbits | "CelesTrak" |
| ADSB.lol (primary) / adsb.fi (fallback) | Flight tracking layer (`opensky-proxy`) | "Aircraft data © adsb.lol / adsb.fi contributors (ODbL)"; adsb.lol ODbL 1.0; adsb.fi open-data terms (non-commercial; permission requested 2026-10-16) |
| CARTO / OpenStreetMap | Basemap | "© OpenStreetMap contributors, © CARTO" (ODbL + CARTO basemap terms) |
| EOX EOxCloudless 2021 | Sentinel-2 mosaic | "EOxCloudless … by EOX IT Services GmbH (Contains modified Copernicus Sentinel data 2021)" CC BY-NC-SA 4.0; licensing enquiry sent 2026-10-16 |
| Blitzortung.org / LightningMaps | Lightning layer | "© Blitzortung.org and contributors" (non-commercial; permission requested 2026-10-16) |
| Caltrans CWWP2 | CCTV — California | "Caltrans" |
| NYC DOT | CCTV — New York City | "NYC DOT" (data-sharing agreement requested 2026-10-16) |
| LTA Singapore (data.gov.sg) | CCTV — Singapore | Singapore Open Data Licence 1.0 notice + link |
| DriveBC | CCTV — British Columbia | "Contains information licensed under the Open Government Licence – British Columbia" |
| HK Transport Department (DATA.GOV.HK) | CCTV — Hong Kong | Government of HKSAR / TD / DATA.GOV.HK; licence includes user indemnity (passed through in ToS §16.11) |
| City of Austin | CCTV — Austin, TX | "City of Austin Open Data" |
| Transport for London | CCTV — London | "Powered by TfL Open Data" |
| NZ Transport Agency Waka Kotahi | CCTV — New Zealand | NZTA (imagery excluded from CC BY; permission requested 2026-10-16) |

### Terms pending — wired but disabled

Disabled unless the `CCTV_ENABLE_PENDING_SOURCES` env allowlist is set on
`intel-cctv-ingest` (it is not set).

| Source | Status |
|---|---|
| Illinois DOT (Gateway / Travel Midwest) | Registration submitted 2026-10-17. Requires credit "Gateway traffic information courtesy of the Illinois Department of Transportation", IDOT logo, policy link, ≤1 image request / 5 min |
| Iowa DOT | Permission requested 2026-10-16 |
| Oregon DOT (TripCheck) | Permission requested 2026-10-16. Credit "Camera courtesy of ODOT" |

### Not yet integrated — per-region legal review required

| Source | Restriction |
|---|---|
| WSDOT, etc. | Open data with varying terms; check per-jurisdiction |
| ASFINAG (Austria) | Free with attribution; check ToS |
| 511 Ontario / Alberta (Canada) | Open data |
| Netherlands NDW (RWS) | Open data |
| Bulgaria / Greece / Serbia / Macedonia / Romania / Turkey | Varies; some require source attribution |

### Restricted — still gated

| Source | Used for | Restriction |
|---|---|---|
| aisstream.io | Live AIS ship tracking | Free for non-commercial / requires registered API key for production traffic |

Layers with restrictions are toggled OFF in `INTEL_LAYER_FLAGS` until legal
sign-off. The corresponding API routes are vendored but their UI controls
render disabled with a tooltip explaining the gating reason.

## Updating attribution

When a layer is active on the tactical map, its `attributionRequired`
attribution string must be rendered somewhere accessible (status bar,
attribution modal, or layer tooltip). The `getRequiredAttributions(...)`
helper in `src/lib/intel-feature-flags.ts` returns the list for any given
set of active layers.

## Legal surfaces

- Terms of Service §16 (Overwatch Platform and Third-Party Data): `/terms-of-service.html#overwatch`
- Privacy Policy §8A (map data, no camera image archiving): `/privacy-policy.html#overwatch-map-data`
- In-app: map footer "Not for emergency use", Data Sources modal link, and a
  one-time CCTV acknowledgement (`src/lib/map/cctv-ack.ts`).
