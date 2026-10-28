import { describe, it, expect } from "vitest";
import {
  TtlCache,
  parseNearParam,
  parseBBoxParam,
  inBBox,
  bboxesIntersect,
  clampTomTomBBox,
  parseTileParam,
  TRANSPARENT_PNG_1X1,
  classifyIncidentKind,
  classifyIncidentSeverity,
  caltransDistrictsForBBox,
  parseCaltransLcs,
  parseCaltransCc,
  parse511Events,
  parseIowaEvents,
  parseDriveBcEvents,
  parseAustinEvents,
  parseTflDisruptions,
  parseDigitrafficMessages,
  parseTomTomIncidents,
  tomtomIncidentsUrl,
  tomtomFlowTileUrl,
  dedupeIncidents,
  type RoadIncident,
} from "../../../supabase/functions/intel-traffic/lib";

describe("intel-traffic pure helpers", () => {
  it("TtlCache stores, expires, and returns stale values", () => {
    const c = new TtlCache<string>(1000);
    c.set("k1", "v1", 1000, 100);
    expect(c.get("k1", 500)).toBe("v1");
    expect(c.get("k1", 1200)).toBeUndefined();
    expect(c.stale("k1")).toBe("v1");
  });

  it("parseBBoxParam & parseNearParam validate bounds and radii", () => {
    expect(parseBBoxParam("-122.6,37.6,-122.2,37.9")).toEqual([-122.6, 37.6, -122.2, 37.9]);
    expect(parseBBoxParam("bad")).toBeNull();
    expect(parseBBoxParam("-122.6,40,-122.2,37.9")).toBeNull();

    const near = parseNearParam("37.7749,-122.4194", "10");
    expect(near).not.toBeNull();
    expect(near![0]).toBeLessThan(-122.4194);
    expect(near![2]).toBeGreaterThan(-122.4194);
    expect(near![1]).toBeLessThan(37.7749);
    expect(near![3]).toBeGreaterThan(37.7749);
  });

  it("inBBox & bboxesIntersect handle normal boxes", () => {
    const box: [number, number, number, number] = [-123, 37, -121, 39];
    expect(inBBox(38, -122, box)).toBe(true);
    expect(inBBox(36, -122, box)).toBe(false);
    expect(bboxesIntersect(box, [-122.5, 37.5, -120, 40])).toBe(true);
    expect(bboxesIntersect(box, [-119, 33, -117, 35])).toBe(false);
  });

  it("clampTomTomBBox clamps oversized boxes around center to <= 0.85 deg span", () => {
    const huge: [number, number, number, number] = [-125, 32, -114, 42];
    const clamped = clampTomTomBBox(huge);
    expect(clamped[2] - clamped[0]).toBeLessThanOrEqual(0.86);
    expect(clamped[3] - clamped[1]).toBeLessThanOrEqual(0.86);
    const small: [number, number, number, number] = [-122.5, 37.7, -122.3, 37.85];
    expect(clampTomTomBBox(small)).toEqual(small);
  });

  it("parseTileParam validates slippy tile coordinates and TRANSPARENT_PNG_1X1 has PNG magic header", () => {
    expect(parseTileParam("12/655/1583")).toEqual({ z: 12, x: 655, y: 1583 });
    expect(parseTileParam("25/1/1")).toBeNull();
    expect(parseTileParam("2/99/1")).toBeNull();
    expect(parseTileParam("bad")).toBeNull();
    expect(Array.from(TRANSPARENT_PNG_1X1.slice(0, 4))).toEqual([0x89, 0x50, 0x4e, 0x47]);
  });

  it("classifyIncidentKind & classifyIncidentSeverity categorize closures, crashes, construction, congestion, and hazards", () => {
    expect(classifyIncidentKind("Road closed due to rockslide")).toBe("closure");
    expect(classifyIncidentKind("Multi-vehicle crash blocking left lane")).toBe("crash");
    expect(classifyIncidentKind("Roadwork and lane closure ahead")).toBe("construction");
    expect(classifyIncidentKind("Heavy traffic congestion and delays")).toBe("congestion");
    expect(classifyIncidentKind("Debris on roadway")).toBe("hazard");

    expect(classifyIncidentSeverity("Road closed in both directions", "closure")).toBe("major");
    expect(classifyIncidentSeverity("Minor fender bender", "crash")).toBe("moderate");
    expect(classifyIncidentSeverity("Shoulder work", "construction")).toBe("minor");
  });

  it("caltransDistrictsForBBox selects intersecting California districts", () => {
    const sfBox: [number, number, number, number] = [-122.6, 37.6, -122.2, 37.9];
    expect(caltransDistrictsForBBox(sfBox)).toContain(4);
    const londonBox: [number, number, number, number] = [-0.5, 51.3, 0.3, 51.7];
    expect(caltransDistrictsForBBox(londonBox)).toEqual([]);
  });

  it("parseCaltransLcs parses active 1097 lane & full closures and skips 1098/1022", () => {
    const sample = {
      data: [
        {
          lcs: {
            index: "1",
            location: {
              travelFlowDirection: "North",
              begin: {
                beginRoute: "I-80",
                beginLocationName: "Bay Bridge Toll Plaza",
                beginNearbyPlace: "Oakland",
                beginLatitude: "37.8245",
                beginLongitude: "-122.3120",
              },
              end: {
                endLocationName: "Treasure Island",
              },
            },
            closure: {
              closureID: "LCS-100",
              typeOfClosure: "Full",
              typeOfWork: "Bridge Maintenance",
              lanesClosed: "All",
              totalExistingLanes: "5",
              estimatedDelay: "45",
              closureTimestamp: {
                closureStartEpoch: "1761600000",
                closureEndEpoch: "1761700000",
              },
              code1097: { isCode1097: "true" },
              code1098: { isCode1098: "false" },
              code1022: { isCode1022: "false" },
            },
          },
        },
        {
          lcs: {
            index: "2",
            location: {
              begin: { beginRoute: "US-101", beginLatitude: "37.75", beginLongitude: "-122.40" },
            },
            closure: {
              closureID: "LCS-101",
              code1097: { isCode1097: "true" },
              code1098: { isCode1098: "true" },
            },
          },
        },
      ],
    };
    const res = parseCaltransLcs(sample, 4, 1761650000);
    expect(res).toHaveLength(1);
    expect(res[0].kind).toBe("closure");
    expect(res[0].road).toBe("I-80");
    expect(res[0].source).toBe("Caltrans");
  });

  it("parseCaltransCc parses active chain controls", () => {
    const sample = {
      data: [
        {
          cc: {
            index: "001",
            inService: "true",
            location: {
              district: "3",
              route: "I-80",
              direction: "East",
              locationName: "Donner Pass",
              nearbyPlace: "Truckee",
              latitude: "39.318",
              longitude: "-120.329",
            },
            statusData: {
              status: "R-2",
              statusDescription: "Chains required on all vehicles except 4WD with snow tires",
              statusTimestamp: { statusDate: "10/28/2026", statusTime: "08:00" },
            },
          },
        },
      ],
    };
    const res = parseCaltransCc(sample, 3);
    expect(res).toHaveLength(1);
    expect(res[0].kind).toBe("hazard");
    expect(res[0].title).toContain("R-2");
  });

  it("parse511Events parses IBI 511 v2 events", () => {
    const sample = [
      {
        ID: "GA-900",
        Organization: "Georgia DOT",
        RoadwayName: "I-75",
        DirectionOfTravel: "Southbound",
        Description: "Crash blocking 2 right lanes near Howell Mill Rd",
        Latitude: 33.802,
        Longitude: -84.412,
        EventType: "accidentsAndIncidents",
        EventSubType: "Crash",
        IsFullClosure: false,
        Severity: "Major",
      },
    ];
    const res = parse511Events(sample, "511 Georgia", "ga511", "Georgia DOT 511GA");
    expect(res).toHaveLength(1);
    expect(res[0].id).toBe("ga511-GA-900");
    expect(res[0].kind).toBe("crash");
    expect(res[0].severity).toBe("major");
  });

  it("parseIowaEvents parses Iowa DOT CARS 511 ArcGIS features", () => {
    const sample = {
      features: [
        {
          attributes: {
            OBJECTID: 42,
            Route: "I-80 WB",
            headline: "Road closed due to multi-vehicle crash",
            phrase: "Road closed",
            Desc0: "I-80 WB closed between Exit 120 and Exit 118",
            Priority: 1,
            Updated: 1761650000000,
          },
          geometry: { x: -93.609, y: 41.601 },
        },
      ],
    };
    const res = parseIowaEvents(sample);
    expect(res).toHaveLength(1);
    expect(res[0].id).toBe("iowa-42");
    expect(res[0].kind).toBe("closure");
    expect(res[0].attribution).toBe("Source: Iowa DOT");
  });

  it("parseDriveBcEvents parses Open511 BC events with Point or LineString geometry", () => {
    const sample = {
      events: [
        {
          id: "drivebc.ca/DBC-12345",
          headline: "CLOSURE",
          event_type: "INCIDENT",
          severity: "MAJOR",
          description: "Highway 1 closed in both directions near Revelstoke due to avalanche hazard.",
          created: "2026-10-28T06:00:00Z",
          roads: [{ name: "Highway 1", direction: "BOTH" }],
          geography: {
            type: "LineString",
            coordinates: [
              [-118.2, 51.0],
              [-118.18, 51.02],
            ],
          },
        },
      ],
    };
    const res = parseDriveBcEvents(sample);
    expect(res).toHaveLength(1);
    expect(res[0].kind).toBe("closure");
    expect(res[0].severity).toBe("critical");
    expect(res[0].road).toBe("Highway 1");
  });

  it("parseAustinEvents parses City of Austin Socrata active traffic reports", () => {
    const sample = [
      {
        traffic_report_id: "AUS-77",
        issue_reported: "COLLISION WITH INJURY",
        address: "N IH 35 SVRD SB & E 11TH ST",
        latitude: "30.2711",
        longitude: "-97.7345",
        published_date: "2026-10-28T11:30:00.000",
        traffic_report_status: "ACTIVE",
      },
    ];
    const res = parseAustinEvents(sample);
    expect(res).toHaveLength(1);
    expect(res[0].kind).toBe("crash");
    expect(res[0].source).toBe("City of Austin");
  });

  it("parseTflDisruptions parses London TfL road disruptions", () => {
    const sample = [
      {
        id: "TIMS-221931",
        category: "Works",
        subCategory: "Utility works",
        severity: "Moderate",
        location: "A406 NORTH CIRCULAR ROAD (N13, N18)",
        comments: "Lane closure for emergency gas main repair.",
        hasClosures: false,
        startDateTime: "2026-10-28T00:00:00Z",
        geography: {
          type: "Point",
          coordinates: [-0.0976, 51.6142],
        },
      },
    ];
    const res = parseTflDisruptions(sample);
    expect(res).toHaveLength(1);
    expect(res[0].kind).toBe("construction");
    expect(res[0].source).toBe("TfL");
  });

  it("parseDigitrafficMessages parses Finland Digitraffic GeoJSON announcements", () => {
    const sample = {
      features: [
        {
          geometry: { type: "Point", coordinates: [24.9384, 60.1699] },
          properties: {
            situationId: "FIN-01",
            situationType: "TRAFFIC_ANNOUNCEMENT",
            releaseTime: "2026-10-28T09:00:00Z",
            announcements: [
              {
                title: "Vt 1 Helsinki: Onnettomuus, tie on suljettu",
                location: { description: "Kehä I" },
                comment: "Collision blocking roadway",
              },
            ],
          },
        },
      ],
    };
    const res = parseDigitrafficMessages(sample);
    expect(res).toHaveLength(1);
    expect(res[0].kind).toBe("closure");
    expect(res[0].source).toBe("Digitraffic (FI)");
  });

  it("parseTomTomIncidents & URL builders handle TomTom v5 incident details and v4 flow tiles", () => {
    const sample = {
      incidents: [
        {
          type: "Feature",
          geometry: {
            type: "LineString",
            coordinates: [
              [-122.405, 37.781],
              [-122.401, 37.785],
            ],
          },
          properties: {
            id: "TT-1",
            iconCategory: 8,
            magnitudeOfDelay: 4,
            events: [{ description: "Road closed", code: 401 }],
            startTime: "2026-10-28T10:00:00Z",
            from: "Market St",
            to: "Folsom St",
            roadNumbers: ["I-80"],
            delay: 900,
          },
        },
      ],
    };
    const res = parseTomTomIncidents(sample);
    expect(res).toHaveLength(1);
    expect(res[0].id).toBe("tomtom-TT-1");
    expect(res[0].kind).toBe("closure");
    expect(res[0].severity).toBe("critical");
    expect(res[0].road).toBe("I-80");

    const tileUrl = tomtomFlowTileUrl(12, 655, 1583, "TEST_KEY", "relative0-dark");
    expect(tileUrl).toContain("/traffic/map/4/tile/flow/relative0-dark/12/655/1583.png");
    expect(tileUrl).toContain("key=TEST_KEY");

    const incUrl = tomtomIncidentsUrl([-122.5, 37.7, -122.3, 37.85], "TEST_KEY");
    expect(incUrl).toContain("/traffic/services/5/incidentDetails");
    expect(incUrl).toContain("key=TEST_KEY");
  });

  it("dedupeIncidents removes duplicate near-identical coordinates and sorts by severity", () => {
    const items: RoadIncident[] = [
      {
        id: "a",
        kind: "construction",
        severity: "minor",
        title: "Minor work",
        road: "I-5",
        description: "Work",
        lat: 37.775,
        lng: -122.419,
        source: "Caltrans",
        attribution: "Caltrans",
      },
      {
        id: "b",
        kind: "closure",
        severity: "critical",
        title: "Full closure",
        road: "I-5",
        description: "Closed",
        lat: 37.775,
        lng: -122.419,
        source: "TomTom",
        attribution: "TomTom",
      },
      {
        id: "c",
        kind: "closure",
        severity: "major",
        title: "Duplicate closure at same spot",
        road: "I-5",
        description: "Closed",
        lat: 37.7751,
        lng: -122.4191,
        source: "Caltrans",
        attribution: "Caltrans",
      },
    ];
    const deduped = dedupeIncidents(items);
    expect(deduped).toHaveLength(2);
    expect(deduped[0].id).toBe("b");
    expect(deduped[1].id).toBe("a");
  });
});
