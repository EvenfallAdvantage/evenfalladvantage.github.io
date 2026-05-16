/**
 * Unit tests for the SiteMapBounds quad helpers.
 *
 * These cover the geometry-only entry points (no Supabase / DB I/O):
 *   - imageToGeo: maps an image-space point (0..1, 0..1) to lat/lng
 *   - bboxOfQuad: derives the axis-aligned bbox containing a quad
 *
 * Both must work correctly for north-up, west-up, rotated, and sheared
 * quads — the whole point of the May 2026 affine upgrade is to make
 * rotation/shear handling exact.
 */

import { describe, it, expect } from "vitest";
import {
  imageToGeo,
  bboxOfQuad,
  type SiteMapBounds,
  type SiteMapQuad,
} from "@/lib/supabase/db-site-bounds";

// A unit-square north-up quad. Image (0,0) = top-left = (lat=1, lng=0).
// Spans 1 degree of lat and 1 degree of lng, both positive.
const NORTH_UP: SiteMapQuad = {
  c00: { lat: 1, lng: 0 }, // top-left
  c10: { lat: 1, lng: 1 }, // top-right
  c11: { lat: 0, lng: 1 }, // bottom-right
  c01: { lat: 0, lng: 0 }, // bottom-left
};

// Same quad rotated 90° clockwise in the world. The image's top edge
// now points east. Image top-left is at the north-east of the world.
//   image (0,0) = top-left   → world NE = (lat=1, lng=1)
//   image (1,0) = top-right  → world SE = (lat=0, lng=1)
//   image (1,1) = bot-right  → world SW = (lat=0, lng=0)
//   image (0,1) = bot-left   → world NW = (lat=1, lng=0)
const ROTATED_90_CW: SiteMapQuad = {
  c00: { lat: 1, lng: 1 },
  c10: { lat: 0, lng: 1 },
  c11: { lat: 0, lng: 0 },
  c01: { lat: 1, lng: 0 },
};

describe("imageToGeo", () => {
  it("maps image corners exactly to quad corners (north-up)", () => {
    const b: SiteMapBounds = { west: 0, south: 0, east: 1, north: 1, quad: NORTH_UP };
    expect(imageToGeo(b, 0, 0)).toEqual({ lat: 1, lng: 0 });
    expect(imageToGeo(b, 1, 0)).toEqual({ lat: 1, lng: 1 });
    expect(imageToGeo(b, 1, 1)).toEqual({ lat: 0, lng: 1 });
    expect(imageToGeo(b, 0, 1)).toEqual({ lat: 0, lng: 0 });
  });

  it("maps image center to quad center (north-up)", () => {
    const b: SiteMapBounds = { west: 0, south: 0, east: 1, north: 1, quad: NORTH_UP };
    const c = imageToGeo(b, 0.5, 0.5);
    expect(c.lat).toBeCloseTo(0.5, 6);
    expect(c.lng).toBeCloseTo(0.5, 6);
  });

  it("respects rotation: image top-left maps to world NE for a 90° CW quad", () => {
    const b: SiteMapBounds = { west: 0, south: 0, east: 1, north: 1, quad: ROTATED_90_CW };
    // Image (0,0) = top-left of the *image*, which is the NE of the world
    // for this rotated quad. A pin placed at image top-left in the
    // storyboard editor should appear at world NE on the tactical map.
    const tl = imageToGeo(b, 0, 0);
    expect(tl.lat).toBeCloseTo(1, 6);
    expect(tl.lng).toBeCloseTo(1, 6);
    // Image bottom-right should land at world SW.
    const br = imageToGeo(b, 1, 1);
    expect(br.lat).toBeCloseTo(0, 6);
    expect(br.lng).toBeCloseTo(0, 6);
  });

  it("falls back to axis-aligned bbox math when no quad is provided", () => {
    const b: SiteMapBounds = { west: -10, south: 30, east: -8, north: 32 };
    // Image (0,0) = top-left = (north, west) by convention.
    expect(imageToGeo(b, 0, 0)).toEqual({ lat: 32, lng: -10 });
    expect(imageToGeo(b, 1, 1)).toEqual({ lat: 30, lng: -8 });
    expect(imageToGeo(b, 0.5, 0.5)).toEqual({ lat: 31, lng: -9 });
  });

  it("bilinear interpolation is exact on the rotated quad's center", () => {
    const b: SiteMapBounds = { west: 0, south: 0, east: 1, north: 1, quad: ROTATED_90_CW };
    const c = imageToGeo(b, 0.5, 0.5);
    expect(c.lat).toBeCloseTo(0.5, 6);
    expect(c.lng).toBeCloseTo(0.5, 6);
  });

  it("handles non-uniform scale (wide-but-short site plan)", () => {
    const wide: SiteMapQuad = {
      c00: { lat: 10, lng: 0 },
      c10: { lat: 10, lng: 100 }, // image is 100° wide
      c11: { lat: 9, lng: 100 },  // and only 1° tall
      c01: { lat: 9, lng: 0 },
    };
    const b: SiteMapBounds = { west: 0, south: 9, east: 100, north: 10, quad: wide };
    expect(imageToGeo(b, 0.5, 0)).toEqual({ lat: 10, lng: 50 });
    expect(imageToGeo(b, 0, 0.5)).toEqual({ lat: 9.5, lng: 0 });
  });
});

describe("bboxOfQuad", () => {
  it("derives the axis-aligned bbox of a north-up quad", () => {
    expect(bboxOfQuad(NORTH_UP)).toEqual({ west: 0, south: 0, east: 1, north: 1 });
  });

  it("derives the bbox of a 90° CW rotated quad (same bbox as the unrotated one)", () => {
    // The world-space bounding box is unchanged by 90° rotation about
    // its center — the four corners just occupy the same four positions
    // in different image-space slots.
    expect(bboxOfQuad(ROTATED_90_CW)).toEqual({ west: 0, south: 0, east: 1, north: 1 });
  });

  it("derives the bbox of a sheared quad", () => {
    const sheared: SiteMapQuad = {
      c00: { lat: 1.0, lng: 0.5 }, // top-left shifted east
      c10: { lat: 1.0, lng: 1.5 }, // top-right
      c11: { lat: 0.0, lng: 1.0 }, // bottom-right
      c01: { lat: 0.0, lng: 0.0 }, // bottom-left
    };
    expect(bboxOfQuad(sheared)).toEqual({ west: 0, south: 0, east: 1.5, north: 1 });
  });
});
