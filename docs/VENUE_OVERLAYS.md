# Venue overlays (CAD floorplans, site maps)

Phase 7.3 / HALO_PARITY_PLAN.md — venue-scale overlay imagery (CAD floorplans,
event site maps, indoor diagrams).

## TL;DR

**No new schema. Reuse the existing storyboard / operation site-map system.**

Operations already support a `site_map_url` + `site_map_bounds` pair on the
`events` table. The tactical map's `useSiteOverlay` / site-map adjuster
controls already handle uploading an image, georeferencing it onto a
lat/lng rectangle, and adjusting opacity. We do **not** introduce a parallel
"CAD overlay" table.

## Where this lives

| Concern | Location |
|---|---|
| Upload image | Site-map adjuster (Cesium toolbar → "Add site map") |
| Storage | Supabase Storage bucket `site-maps/` |
| URL ↔ bounds persistence | `events.site_map_url` + `events.site_map_bounds` (JSONB) |
| Per-company storyboards (separate, sketch / annotation system) | `storyboards` table + `add-storyboard-system.sql` |
| Overlay opacity control | `map-layers-panel.tsx` → "Site overlays" group |
| Per-overlay visibility | `layers.siteOverlays: Record<string, boolean>` + `layers.siteOverlayOpacity: number` |

The site map adjuster (`SiteMapAdjuster` component in
`overwatch-src/src/components/tactical-map/`) lets an admin click two
opposite corners on a CAD scan to set the bounds. Done once per venue.

## Why not Mapbox?

The plan calls out skipping Mapbox: Cesium is already the established stack,
introducing Mapbox would conflict with the existing tactical map, weather
radar, 3D buildings, and storyboard primitive plumbing. Per the parity plan:

> **Mapbox**: skipped — Cesium is the established stack.

This is the deliberate divergence from Halo.

## CAD specifics

CAD/floorplan images are uploaded the same way as event site maps:

1. Export the CAD to PNG (transparent background preferred so the basemap
   shows through unmapped areas).
2. Open Tactical Map → site-map adjuster.
3. Upload the PNG.
4. Click two opposite ground-truth corners on the Cesium globe at the venue.
5. Adjust opacity (default 0.75) via the layer panel under SITE OVERLAYS.

Indoor floor switching (e.g. ground floor vs. mezzanine) is a follow-up task
tracked under "future enhancements" below.

## Limits

- One overlay per event (operation). Multi-floor venues currently need a
  composite image.
- No automatic georeferencing — the admin must manually align two corners.
  Auto-georef from CAD metadata (GeoTIFF) is a documented future enhancement.

## Future enhancements (NOT in Phase 7)

- Multi-floor switcher (one overlay per floor, vertical-stack picker)
- GeoTIFF / world-file auto-import
- DWG/DXF native ingestion (would require an Edge Function with `node-dxf` or
  similar)
- Editable indoor zones (rooms, corridors) — overlaps with geofences; we
  could re-use the geofence table with a `parent_overlay_id` link

---

**Status:** documented. No code changes in this commit; venue overlays
already work via the existing site-map adjuster.
