/**
 * Terrain Analysis Tools
 *
 * - Line of Sight: Can point A see point B?
 * - Elevation Profile: Height along a path
 * - Viewshed: What area is visible from a point?
 *
 * Uses Cesium's terrain sampling for elevation data.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type CesiumRef = any;

export interface ElevationPoint {
  distance: number; // meters from start
  elevation: number; // meters above sea level
  lat: number;
  lng: number;
}

/**
 * Sample terrain elevation along a line between two points.
 * Returns an array of elevation points for rendering a profile chart.
 */
export async function getElevationProfile(
  Cesium: CesiumRef,
  viewer: CesiumRef,
  startLat: number, startLng: number,
  endLat: number, endLng: number,
  numSamples = 50,
): Promise<ElevationPoint[]> {
  const positions: typeof Cesium.Cartographic[] = [];

  for (let i = 0; i <= numSamples; i++) {
    const t = i / numSamples;
    const lat = startLat + t * (endLat - startLat);
    const lng = startLng + t * (endLng - startLng);
    positions.push(Cesium.Cartographic.fromDegrees(lng, lat));
  }

  // Sample terrain heights
  const terrainProvider = viewer.scene.globe.terrainProvider;
  const sampled = await Cesium.sampleTerrainMostDetailed(terrainProvider, positions);

  const points: ElevationPoint[] = [];
  let totalDist = 0;

  for (let i = 0; i < sampled.length; i++) {
    if (i > 0) {
      const prev = sampled[i - 1];
      const curr = sampled[i];
      const dLat = curr.latitude - prev.latitude;
      const dLng = curr.longitude - prev.longitude;
      const dist = Math.sqrt(dLat * dLat + dLng * dLng) * 111320; // rough meters
      totalDist += dist;
    }

    points.push({
      distance: totalDist,
      elevation: sampled[i].height ?? 0,
      lat: Cesium.Math.toDegrees(sampled[i].latitude),
      lng: Cesium.Math.toDegrees(sampled[i].longitude),
    });
  }

  return points;
}

/**
 * Check line of sight between two points at given observer heights.
 * Returns true if point B is visible from point A.
 * Also returns the profile with obstruction info.
 */
export async function checkLineOfSight(
  Cesium: CesiumRef,
  viewer: CesiumRef,
  aLat: number, aLng: number, aHeight: number,
  bLat: number, bLng: number, bHeight: number,
): Promise<{ visible: boolean; profile: ElevationPoint[]; obstructionIndex: number | null }> {
  const profile = await getElevationProfile(Cesium, viewer, aLat, aLng, bLat, bLng, 100);
  if (profile.length < 2) return { visible: true, profile, obstructionIndex: null };

  const aElev = profile[0].elevation + aHeight;
  const bElev = profile[profile.length - 1].elevation + bHeight;
  const totalDist = profile[profile.length - 1].distance;

  // Check each intermediate point to see if it rises above the sight line
  for (let i = 1; i < profile.length - 1; i++) {
    const t = profile[i].distance / totalDist;
    const sightLineElev = aElev + t * (bElev - aElev);
    if (profile[i].elevation > sightLineElev) {
      return { visible: false, profile, obstructionIndex: i };
    }
  }

  return { visible: true, profile, obstructionIndex: null };
}

/**
 * Render a line-of-sight visualization on the Cesium globe.
 * Green line = visible, red line = obstructed.
 */
export function renderLineOfSight(
  Cesium: CesiumRef,
  viewer: CesiumRef,
  aLat: number, aLng: number, aHeight: number,
  bLat: number, bLng: number, bHeight: number,
  visible: boolean,
  obstructionIndex: number | null,
  profile: ElevationPoint[],
): string[] {
  const entityIds: string[] = [];
  const color = visible ? Cesium.Color.LIME : Cesium.Color.RED;

  // Sight line
  const lineEntity = viewer.entities.add({
    id: "los-line",
    polyline: {
      positions: Cesium.Cartesian3.fromDegreesArrayHeights([
        aLng, aLat, profile[0].elevation + aHeight,
        bLng, bLat, profile[profile.length - 1].elevation + bHeight,
      ]),
      width: 2,
      material: color.withAlpha(0.6),
    },
  });
  entityIds.push(lineEntity.id);

  // Observer points
  const aEntity = viewer.entities.add({
    id: "los-a",
    position: Cesium.Cartesian3.fromDegrees(aLng, aLat, profile[0].elevation + aHeight),
    point: { pixelSize: 8, color: Cesium.Color.LIME, outlineColor: Cesium.Color.WHITE, outlineWidth: 1 },
    label: { text: "A", font: "bold 10px monospace", fillColor: Cesium.Color.LIME, pixelOffset: new Cesium.Cartesian2(0, -14) },
  });
  entityIds.push(aEntity.id);

  const bEntity = viewer.entities.add({
    id: "los-b",
    position: Cesium.Cartesian3.fromDegrees(bLng, bLat, profile[profile.length - 1].elevation + bHeight),
    point: { pixelSize: 8, color: visible ? Cesium.Color.LIME : Cesium.Color.RED, outlineColor: Cesium.Color.WHITE, outlineWidth: 1 },
    label: { text: "B", font: "bold 10px monospace", fillColor: visible ? Cesium.Color.LIME : Cesium.Color.RED, pixelOffset: new Cesium.Cartesian2(0, -14) },
  });
  entityIds.push(bEntity.id);

  // Obstruction marker
  if (obstructionIndex !== null && profile[obstructionIndex]) {
    const p = profile[obstructionIndex];
    const obsEntity = viewer.entities.add({
      id: "los-obstruction",
      position: Cesium.Cartesian3.fromDegrees(p.lng, p.lat, p.elevation + 5),
      billboard: { image: undefined },
      label: {
        text: "⚠ BLOCKED",
        font: "bold 10px monospace",
        fillColor: Cesium.Color.RED,
        outlineColor: Cesium.Color.BLACK,
        outlineWidth: 2,
        style: Cesium.LabelStyle.FILL_AND_OUTLINE,
        disableDepthTestDistance: Number.POSITIVE_INFINITY,
      },
    });
    entityIds.push(obsEntity.id);
  }

  return entityIds;
}

/**
 * Clean up line-of-sight entities.
 */
export function clearLineOfSight(viewer: CesiumRef, entityIds: string[]): void {
  for (const id of entityIds) {
    try { viewer.entities.removeById(id); } catch {}
  }
}
