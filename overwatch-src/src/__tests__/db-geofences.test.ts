import { describe, it, expect, vi, beforeEach } from "vitest";
import { createMockSupabase } from "./helpers/mock-supabase";

const { client: mockClient, setMockResponse, queryBuilder } = createMockSupabase();

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => mockClient,
}));

const mockEnsureInternalUser = vi.fn();
vi.mock("@/lib/supabase/db-helpers", () => ({
  ts: () => ({ created_at: "2026-01-01T00:00:00.000Z", updated_at: "2026-01-01T00:00:00.000Z" }),
  ensureInternalUser: (...args: unknown[]) => mockEnsureInternalUser(...args),
}));

vi.mock("@/lib/supabase/db-error", () => ({
  logDbReadError: vi.fn(),
}));

import {
  validateAndCloseGeometry,
  getGeofences,
  getGeofence,
  createGeofence,
  updateGeofence,
  deleteGeofence,
} from "@/lib/supabase/db-geofences";

const ROW = {
  id: "g-1",
  company_id: "comp-1",
  team_id: "team-1",
  name: "Stadium perimeter",
  description: "Outer fence",
  geometry: {
    type: "Polygon",
    coordinates: [
      [
        [-74.001, 40.7128],
        [-74.0, 40.7128],
        [-74.0, 40.7138],
        [-74.001, 40.7138],
        [-74.001, 40.7128],
      ],
    ],
  },
  color: "#ef4444",
  fill_opacity: "0.30",
  stroke_width: 3,
  is_active: true,
  created_by: "user-1",
  created_at: "2026-01-01T00:00:00.000Z",
  updated_at: "2026-01-01T00:00:00.000Z",
};

beforeEach(() => {
  vi.clearAllMocks();
  setMockResponse({ data: null, error: null });
  mockEnsureInternalUser.mockResolvedValue("user-123");
  queryBuilder.then = vi.fn((resolve: (v: unknown) => void) =>
    Promise.resolve({ data: null, error: null }).then(resolve),
  );
});

// ---------------------------------------------------------------------------
// validateAndCloseGeometry
// ---------------------------------------------------------------------------

describe("validateAndCloseGeometry()", () => {
  it("accepts a valid closed Polygon and returns it as-is", () => {
    const input = {
      type: "Polygon",
      coordinates: [
        [
          [0, 0],
          [1, 0],
          [1, 1],
          [0, 0],
        ],
      ],
    };
    const out = validateAndCloseGeometry(input);
    expect(out.type).toBe("Polygon");
    if (out.type !== "Polygon") return;
    expect(out.coordinates[0]).toHaveLength(4);
  });

  it("auto-closes an unclosed ring", () => {
    const input = {
      type: "Polygon",
      coordinates: [
        [
          [0, 0],
          [1, 0],
          [1, 1],
        ],
      ],
    };
    const out = validateAndCloseGeometry(input);
    if (out.type !== "Polygon") throw new Error("wrong type");
    expect(out.coordinates[0]).toHaveLength(4);
    expect(out.coordinates[0][0]).toEqual(out.coordinates[0][3]);
  });

  it("rejects non-Polygon types", () => {
    expect(() => validateAndCloseGeometry({ type: "Point", coordinates: [0, 0] })).toThrow(/Polygon or MultiPolygon/);
  });

  it("rejects rings with fewer than 3 points", () => {
    expect(() =>
      validateAndCloseGeometry({ type: "Polygon", coordinates: [[[0, 0], [1, 0]]] }),
    ).toThrow(/at least 3/);
  });

  it("rejects out-of-range coordinates", () => {
    expect(() =>
      validateAndCloseGeometry({
        type: "Polygon",
        coordinates: [
          [
            [200, 0],
            [201, 0],
            [201, 1],
            [200, 0],
          ],
        ],
      }),
    ).toThrow(/out of range/);
  });

  it("rejects non-numeric coordinates", () => {
    expect(() =>
      validateAndCloseGeometry({
        type: "Polygon",
        coordinates: [
          [
            ["a", 0],
            [1, 0],
            [1, 1],
            [0, 0],
          ],
        ],
      }),
    ).toThrow(/non-numeric/);
  });

  it("accepts a MultiPolygon and closes each inner ring", () => {
    const input = {
      type: "MultiPolygon",
      coordinates: [
        [[[0, 0], [1, 0], [1, 1]]],
        [[[2, 2], [3, 2], [3, 3]]],
      ],
    };
    const out = validateAndCloseGeometry(input);
    if (out.type !== "MultiPolygon") throw new Error("wrong type");
    expect(out.coordinates[0][0]).toHaveLength(4);
    expect(out.coordinates[1][0]).toHaveLength(4);
  });

  it("rejects garbage input", () => {
    expect(() => validateAndCloseGeometry(null)).toThrow();
    expect(() => validateAndCloseGeometry("not an object")).toThrow();
  });
});

// ---------------------------------------------------------------------------
// getGeofences()
// ---------------------------------------------------------------------------

describe("getGeofences()", () => {
  it("returns mapped fences ordered by created_at desc", async () => {
    queryBuilder.then = vi.fn((resolve: (v: unknown) => void) =>
      Promise.resolve({ data: [ROW], error: null }).then(resolve),
    );

    const result = await getGeofences("comp-1");

    expect(mockClient.from).toHaveBeenCalledWith("geofences");
    expect(queryBuilder.eq).toHaveBeenCalledWith("company_id", "comp-1");
    expect(queryBuilder.order).toHaveBeenCalledWith("created_at", { ascending: false });
    expect(result).toEqual([
      {
        id: "g-1",
        companyId: "comp-1",
        teamId: "team-1",
        name: "Stadium perimeter",
        description: "Outer fence",
        geometry: ROW.geometry,
        color: "#ef4444",
        fillOpacity: 0.3,
        strokeWidth: 3,
        isActive: true,
        createdById: "user-1",
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
      },
    ]);
  });

  it("applies activeOnly filter when set", async () => {
    queryBuilder.then = vi.fn((resolve: (v: unknown) => void) =>
      Promise.resolve({ data: [], error: null }).then(resolve),
    );

    await getGeofences("comp-1", { activeOnly: true });

    expect(queryBuilder.eq).toHaveBeenCalledWith("is_active", true);
  });

  it("applies teamId filter when provided", async () => {
    queryBuilder.then = vi.fn((resolve: (v: unknown) => void) =>
      Promise.resolve({ data: [], error: null }).then(resolve),
    );

    await getGeofences("comp-1", { teamId: "team-1" });

    expect(queryBuilder.eq).toHaveBeenCalledWith("team_id", "team-1");
  });

  it("returns [] on error", async () => {
    queryBuilder.then = vi.fn((resolve: (v: unknown) => void) =>
      Promise.resolve({ data: null, error: { message: "boom" } }).then(resolve),
    );

    const result = await getGeofences("comp-1");
    expect(result).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// getGeofence()
// ---------------------------------------------------------------------------

describe("getGeofence()", () => {
  it("returns single mapped fence", async () => {
    queryBuilder.maybeSingle.mockResolvedValueOnce({ data: ROW, error: null });

    const result = await getGeofence("g-1");

    expect(queryBuilder.eq).toHaveBeenCalledWith("id", "g-1");
    expect(result?.id).toBe("g-1");
  });

  it("returns null on error", async () => {
    queryBuilder.maybeSingle.mockResolvedValueOnce({ data: null, error: { message: "boom" } });
    const result = await getGeofence("g-1");
    expect(result).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// createGeofence()
// ---------------------------------------------------------------------------

describe("createGeofence()", () => {
  it("validates geometry, applies defaults, inserts", async () => {
    queryBuilder.maybeSingle.mockResolvedValueOnce({ data: ROW, error: null });

    await createGeofence("comp-1", {
      name: "Stadium perimeter",
      geometry: {
        type: "Polygon",
        coordinates: [[[0, 0], [1, 0], [1, 1]]],
      },
    });

    const insertArg = queryBuilder.insert.mock.calls[0][0] as Record<string, unknown>;
    expect(insertArg.company_id).toBe("comp-1");
    expect(insertArg.name).toBe("Stadium perimeter");
    expect(insertArg.color).toBe("#6366f1");
    expect(insertArg.fill_opacity).toBe(0.2);
    expect(insertArg.stroke_width).toBe(2);
    expect(insertArg.is_active).toBe(true);
    // Geometry should be closed automatically.
    const geom = insertArg.geometry as { type: string; coordinates: number[][][] };
    expect(geom.coordinates[0]).toHaveLength(4);
  });

  it("throws when unauthenticated", async () => {
    mockEnsureInternalUser.mockResolvedValueOnce(null);
    await expect(
      createGeofence("comp-1", {
        name: "x",
        geometry: { type: "Polygon", coordinates: [[[0, 0], [1, 0], [1, 1], [0, 0]]] },
      }),
    ).rejects.toThrow("Not authenticated");
  });

  it("throws on insert error", async () => {
    queryBuilder.maybeSingle.mockResolvedValueOnce({ data: null, error: { message: "denied" } });
    await expect(
      createGeofence("comp-1", {
        name: "x",
        geometry: { type: "Polygon", coordinates: [[[0, 0], [1, 0], [1, 1], [0, 0]]] },
      }),
    ).rejects.toEqual({ message: "denied" });
  });

  it("validates bad geometry up front (does not call insert)", async () => {
    await expect(
      createGeofence("comp-1", {
        name: "x",
        geometry: { type: "Polygon", coordinates: [[[0, 0], [1, 0]]] } as unknown as never,
      }),
    ).rejects.toThrow(/at least 3/);
    expect(queryBuilder.insert).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// updateGeofence()
// ---------------------------------------------------------------------------

describe("updateGeofence()", () => {
  it("only updates provided fields", async () => {
    queryBuilder.maybeSingle.mockResolvedValueOnce({ data: ROW, error: null });

    await updateGeofence("g-1", { name: "New name" });

    expect(queryBuilder.eq).toHaveBeenCalledWith("id", "g-1");
    const updateArg = queryBuilder.update.mock.calls[0][0] as Record<string, unknown>;
    expect(updateArg.name).toBe("New name");
    expect(updateArg).not.toHaveProperty("geometry");
    expect(updateArg).not.toHaveProperty("color");
    expect(updateArg.updated_at).toBeDefined();
  });

  it("validates geometry on update too", async () => {
    await expect(
      updateGeofence("g-1", {
        geometry: { type: "Polygon", coordinates: [[[0, 0]]] } as unknown as never,
      }),
    ).rejects.toThrow(/at least 3/);
  });

  it("allows clearing team_id by passing null", async () => {
    queryBuilder.maybeSingle.mockResolvedValueOnce({ data: ROW, error: null });

    await updateGeofence("g-1", { teamId: null });

    const updateArg = queryBuilder.update.mock.calls[0][0] as Record<string, unknown>;
    expect(updateArg.team_id).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// deleteGeofence()
// ---------------------------------------------------------------------------

describe("deleteGeofence()", () => {
  it("deletes by id and returns true on success", async () => {
    queryBuilder.then = vi.fn((resolve: (v: unknown) => void) =>
      Promise.resolve({ data: null, error: null }).then(resolve),
    );

    const ok = await deleteGeofence("g-1");

    expect(queryBuilder.delete).toHaveBeenCalled();
    expect(queryBuilder.eq).toHaveBeenCalledWith("id", "g-1");
    expect(ok).toBe(true);
  });

  it("returns false on error", async () => {
    queryBuilder.then = vi.fn((resolve: (v: unknown) => void) =>
      Promise.resolve({ data: null, error: { message: "denied" } }).then(resolve),
    );

    const ok = await deleteGeofence("g-1");
    expect(ok).toBe(false);
  });
});
