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
| ip-api.com | IP geolocation (RECON tab) | `ip-api.com` |
| AlienVault OTX | Threat intel (RECON tab) | `otx.alienvault.com` |
| Shodan InternetDB | IP sweep (RECON tab) | `internetdb.shodan.io` |
| CISA KEV | Cyber threats status bar | `cisa.gov` |
| RestCountries | Region dossier | `restcountries.com` |
| Wikipedia / Wikidata | Region dossier | `*.wikipedia.org`, `query.wikidata.org` |
| Nominatim | Reverse geocoding, region dossier | `nominatim.openstreetmap.org` |
| RDAP via rdap.org | WHOIS lookups (RECON tab) | `rdap.org` |

### Free with attribution required

| Source | Used for | Attribution string |
|---|---|---|
| NASA FIRMS (VIIRS/MODIS) | Active fires layer | "NASA FIRMS" |
| NASA EONET imagery | EONET events layer | "NASA EONET" |
| CelesTrak TLE catalog | Satellite orbits | "CelesTrak" |
| OpenSky Network / adsb.lol | Flight tracking layer | "OpenSky Network" |
| LTA Singapore (data.gov.sg) | CCTV layer — Singapore | "LTA Singapore" |
| Florida DOT (FL-511) | CCTV layer — Florida | "FL-511" |
| Caltrans (cwwp2.dot.ca.gov) | CCTV layer — California | "Caltrans" |

### Available for future activation — per-region legal review required

The upstream Osiris CCTV aggregator supports additional sources whose ToS
need per-jurisdiction review before the regions are wired into `intel-cctv`:

| Source | Restriction |
|---|---|
| TfL JamCams (London) | Free for non-commercial; commercial use requires TfL registration |
| WSDOT, NYC DOT, etc. | Open data with varying terms; check per-jurisdiction |
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
