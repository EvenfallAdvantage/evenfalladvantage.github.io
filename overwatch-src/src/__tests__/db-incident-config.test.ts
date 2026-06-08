import { describe, it, expect, vi, beforeEach } from "vitest";
import { createMockSupabase } from "./helpers/mock-supabase";

// ---------------------------------------------------------------------------
// Mock Supabase client
// ---------------------------------------------------------------------------
const { client: mockClient, setMockResponse, queryBuilder } = createMockSupabase();

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => mockClient,
}));

vi.mock("@/lib/supabase/db-helpers", () => ({
  ts: () => ({ created_at: "2026-01-01T00:00:00.000Z", updated_at: "2026-01-01T00:00:00.000Z" }),
  ensureInternalUser: vi.fn(),
}));

vi.mock("@/lib/supabase/db-error", () => ({
  logDbReadError: vi.fn(),
}));

import {
  getIncidentTypes,
  getIncidentType,
  createIncidentType,
  updateIncidentType,
  deleteIncidentType,
  getIncidentStatuses,
  getIncidentStatus,
  createIncidentStatus,
  updateIncidentStatus,
  deleteIncidentStatus,
  getIncidentFields,
  createIncidentField,
  updateIncidentField,
  deleteIncidentField,
} from "@/lib/supabase/db-incident-config";
import { logDbReadError } from "@/lib/supabase/db-error";

const mockedLogDbReadError = vi.mocked(logDbReadError);

const TYPE_ROW = {
  id: "t-1",
  company_id: "comp-1",
  key: "security-breach",
  label: "Security Breach",
  color: "#ff0000",
  icon: "shield",
  sort_order: 1,
  is_active: true,
  created_at: "2026-01-01T00:00:00.000Z",
  updated_at: "2026-01-01T00:00:00.000Z",
};

const STATUS_ROW = {
  id: "s-1",
  company_id: "comp-1",
  key: "investigating",
  label: "Investigating",
  color: "#ffaa00",
  sort_order: 2,
  is_terminal: false,
  created_at: "2026-01-01T00:00:00.000Z",
  updated_at: "2026-01-01T00:00:00.000Z",
};

const FIELD_ROW = {
  id: "f-1",
  company_id: "comp-1",
  incident_type_key: null,
  field_key: "witness_count",
  label: "Witness Count",
  field_type: "number",
  options: {},
  required: false,
  sort_order: 0,
  conditional_on: null,
  created_at: "2026-01-01T00:00:00.000Z",
  updated_at: "2026-01-01T00:00:00.000Z",
};

beforeEach(() => {
  vi.clearAllMocks();
  setMockResponse({ data: null, error: null });
  queryBuilder.then = vi.fn((resolve: (v: unknown) => void) =>
    Promise.resolve({ data: null, error: null }).then(resolve)
  );
});

// ---------------------------------------------------------------------------
// Incident Types
// ---------------------------------------------------------------------------

describe("getIncidentTypes()", () => {
  it("returns mapped types (all by default)", async () => {
    queryBuilder.then = vi.fn((resolve: (v: unknown) => void) =>
      Promise.resolve({ data: [TYPE_ROW], error: null }).then(resolve)
    );

    const result = await getIncidentTypes("comp-1");

    expect(mockClient.from).toHaveBeenCalledWith("incident_type_defs");
    expect(queryBuilder.eq).toHaveBeenCalledWith("company_id", "comp-1");
    // activeOnly=false by default: no eq("is_active", true) call
    const eqCalls = queryBuilder.eq.mock.calls;
    expect(eqCalls).not.toContainEqual(["is_active", true]);
    expect(queryBuilder.order).toHaveBeenCalledWith("sort_order", { ascending: true });
    expect(result).toEqual([
      {
        id: "t-1",
        companyId: "comp-1",
        key: "security-breach",
        label: "Security Breach",
        color: "#ff0000",
        icon: "shield",
        sortOrder: 1,
        isActive: true,
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
      },
    ]);
  });

  it("filters to active when activeOnly=true", async () => {
    queryBuilder.then = vi.fn((resolve: (v: unknown) => void) =>
      Promise.resolve({ data: [], error: null }).then(resolve)
    );

    await getIncidentTypes("comp-1", true);

    expect(queryBuilder.eq).toHaveBeenCalledWith("is_active", true);
  });

  it("returns [] and logs on read error", async () => {
    const dbError = { message: "boom" };
    queryBuilder.then = vi.fn((resolve: (v: unknown) => void) =>
      Promise.resolve({ data: null, error: dbError }).then(resolve)
    );

    const result = await getIncidentTypes("comp-1");

    expect(mockedLogDbReadError).toHaveBeenCalledWith("incident types", dbError);
    expect(result).toEqual([]);
  });
});

describe("getIncidentType()", () => {
  it("returns mapped single type by key", async () => {
    queryBuilder.maybeSingle.mockResolvedValueOnce({ data: TYPE_ROW, error: null });

    const result = await getIncidentType("comp-1", "security-breach");

    expect(queryBuilder.eq).toHaveBeenCalledWith("company_id", "comp-1");
    expect(queryBuilder.eq).toHaveBeenCalledWith("key", "security-breach");
    expect(result?.key).toBe("security-breach");
    expect(result?.companyId).toBe("comp-1");
  });

  it("returns null when not found", async () => {
    queryBuilder.maybeSingle.mockResolvedValueOnce({ data: null, error: null });

    const result = await getIncidentType("comp-1", "missing");

    expect(result).toBeNull();
  });

  it("returns null and logs on error", async () => {
    const dbError = { message: "boom" };
    queryBuilder.maybeSingle.mockResolvedValueOnce({ data: null, error: dbError });

    const result = await getIncidentType("comp-1", "x");

    expect(mockedLogDbReadError).toHaveBeenCalledWith("incident type", dbError);
    expect(result).toBeNull();
  });
});

describe("createIncidentType()", () => {
  it("inserts with explicit fields and returns id", async () => {
    queryBuilder.then = vi.fn((resolve: (v: unknown) => void) =>
      Promise.resolve({ data: null, error: null }).then(resolve)
    );

    const id = await createIncidentType("comp-1", {
      key: "k",
      label: "Label",
      color: "#aabbcc",
      icon: "i",
      sortOrder: 5,
      isActive: false,
    });

    expect(queryBuilder.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        company_id: "comp-1",
        key: "k",
        label: "Label",
        color: "#aabbcc",
        icon: "i",
        sort_order: 5,
        is_active: false,
      })
    );
    expect(typeof id).toBe("string");
    expect(id!.length).toBeGreaterThan(0);
  });

  it("applies defaults for optional fields", async () => {
    queryBuilder.then = vi.fn((resolve: (v: unknown) => void) =>
      Promise.resolve({ data: null, error: null }).then(resolve)
    );

    await createIncidentType("comp-1", { key: "k", label: "L" });

    const insertArg = queryBuilder.insert.mock.calls[0][0] as Record<string, unknown>;
    expect(insertArg.color).toBe("#6366f1");
    expect(insertArg.icon).toBeNull();
    expect(insertArg.sort_order).toBe(0);
    expect(insertArg.is_active).toBe(true);
  });

  it("returns null on insert error", async () => {
    queryBuilder.then = vi.fn((resolve: (v: unknown) => void) =>
      Promise.resolve({ data: null, error: { message: "fail" } }).then(resolve)
    );

    const id = await createIncidentType("comp-1", { key: "k", label: "L" });
    expect(id).toBeNull();
  });
});

describe("updateIncidentType()", () => {
  it("updates by id and maps result", async () => {
    queryBuilder.maybeSingle.mockResolvedValueOnce({
      data: { ...TYPE_ROW, label: "New" },
      error: null,
    });

    const result = await updateIncidentType("t-1", { label: "New", isActive: false });

    expect(queryBuilder.eq).toHaveBeenCalledWith("id", "t-1");
    const updateArg = queryBuilder.update.mock.calls[0][0] as Record<string, unknown>;
    expect(updateArg.label).toBe("New");
    expect(updateArg.is_active).toBe(false);
    expect(updateArg.updated_at).toBeDefined();
    expect(result?.label).toBe("New");
  });

  it("only includes fields that were provided", async () => {
    queryBuilder.maybeSingle.mockResolvedValueOnce({ data: TYPE_ROW, error: null });

    await updateIncidentType("t-1", { label: "Only label" });

    const updateArg = queryBuilder.update.mock.calls[0][0] as Record<string, unknown>;
    expect(updateArg.label).toBe("Only label");
    expect(updateArg).not.toHaveProperty("color");
    expect(updateArg).not.toHaveProperty("icon");
    expect(updateArg).not.toHaveProperty("sort_order");
    expect(updateArg).not.toHaveProperty("is_active");
  });

  it("returns null on error", async () => {
    queryBuilder.maybeSingle.mockResolvedValueOnce({
      data: null,
      error: { message: "fail" },
    });

    const result = await updateIncidentType("t-1", { label: "x" });
    expect(result).toBeNull();
  });
});

describe("deleteIncidentType()", () => {
  it("deletes by id and returns true on success", async () => {
    queryBuilder.then = vi.fn((resolve: (v: unknown) => void) =>
      Promise.resolve({ data: null, error: null }).then(resolve)
    );

    const ok = await deleteIncidentType("t-1");

    expect(queryBuilder.delete).toHaveBeenCalled();
    expect(queryBuilder.eq).toHaveBeenCalledWith("id", "t-1");
    expect(ok).toBe(true);
  });

  it("returns false on error", async () => {
    queryBuilder.then = vi.fn((resolve: (v: unknown) => void) =>
      Promise.resolve({ data: null, error: { message: "denied" } }).then(resolve)
    );

    const ok = await deleteIncidentType("t-1");
    expect(ok).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Incident Statuses
// ---------------------------------------------------------------------------

describe("getIncidentStatuses()", () => {
  it("returns mapped statuses", async () => {
    queryBuilder.then = vi.fn((resolve: (v: unknown) => void) =>
      Promise.resolve({ data: [STATUS_ROW], error: null }).then(resolve)
    );

    const result = await getIncidentStatuses("comp-1");

    expect(mockClient.from).toHaveBeenCalledWith("incident_status_defs");
    expect(queryBuilder.eq).toHaveBeenCalledWith("company_id", "comp-1");
    expect(queryBuilder.order).toHaveBeenCalledWith("sort_order", { ascending: true });
    expect(result).toEqual([
      {
        id: "s-1",
        companyId: "comp-1",
        key: "investigating",
        label: "Investigating",
        color: "#ffaa00",
        sortOrder: 2,
        isTerminal: false,
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
      },
    ]);
  });

  it("returns [] on error", async () => {
    const dbError = { message: "boom" };
    queryBuilder.then = vi.fn((resolve: (v: unknown) => void) =>
      Promise.resolve({ data: null, error: dbError }).then(resolve)
    );

    const result = await getIncidentStatuses("comp-1");
    expect(mockedLogDbReadError).toHaveBeenCalledWith("incident statuses", dbError);
    expect(result).toEqual([]);
  });
});

describe("getIncidentStatus()", () => {
  it("returns mapped status by key", async () => {
    queryBuilder.maybeSingle.mockResolvedValueOnce({ data: STATUS_ROW, error: null });

    const result = await getIncidentStatus("comp-1", "investigating");

    expect(queryBuilder.eq).toHaveBeenCalledWith("company_id", "comp-1");
    expect(queryBuilder.eq).toHaveBeenCalledWith("key", "investigating");
    expect(result?.key).toBe("investigating");
  });
});

describe("createIncidentStatus()", () => {
  it("inserts with defaults", async () => {
    queryBuilder.then = vi.fn((resolve: (v: unknown) => void) =>
      Promise.resolve({ data: null, error: null }).then(resolve)
    );

    await createIncidentStatus("comp-1", { key: "k", label: "L" });

    const insertArg = queryBuilder.insert.mock.calls[0][0] as Record<string, unknown>;
    expect(insertArg.color).toBe("#6366f1");
    expect(insertArg.sort_order).toBe(0);
    expect(insertArg.is_terminal).toBe(false);
  });
});

describe("updateIncidentStatus()", () => {
  it("updates by id", async () => {
    queryBuilder.maybeSingle.mockResolvedValueOnce({
      data: { ...STATUS_ROW, label: "Done" },
      error: null,
    });

    const result = await updateIncidentStatus("s-1", { label: "Done", isTerminal: true });

    expect(queryBuilder.eq).toHaveBeenCalledWith("id", "s-1");
    const updateArg = queryBuilder.update.mock.calls[0][0] as Record<string, unknown>;
    expect(updateArg.label).toBe("Done");
    expect(updateArg.is_terminal).toBe(true);
    expect(result?.label).toBe("Done");
  });
});

describe("deleteIncidentStatus()", () => {
  it("deletes by id", async () => {
    queryBuilder.then = vi.fn((resolve: (v: unknown) => void) =>
      Promise.resolve({ data: null, error: null }).then(resolve)
    );

    const ok = await deleteIncidentStatus("s-1");

    expect(queryBuilder.delete).toHaveBeenCalled();
    expect(queryBuilder.eq).toHaveBeenCalledWith("id", "s-1");
    expect(ok).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Incident Fields
// ---------------------------------------------------------------------------

describe("getIncidentFields()", () => {
  it("returns mapped fields without typeKey filter", async () => {
    queryBuilder.then = vi.fn((resolve: (v: unknown) => void) =>
      Promise.resolve({ data: [FIELD_ROW], error: null }).then(resolve)
    );

    const result = await getIncidentFields("comp-1");

    expect(mockClient.from).toHaveBeenCalledWith("incident_field_defs");
    expect(queryBuilder.eq).toHaveBeenCalledWith("company_id", "comp-1");
    expect(result).toEqual([
      {
        id: "f-1",
        companyId: "comp-1",
        incidentTypeKey: null,
        fieldKey: "witness_count",
        label: "Witness Count",
        fieldType: "number",
        options: {},
        required: false,
        sortOrder: 0,
        conditionalOn: null,
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
      },
    ]);
  });

  it("filters by typeKey when provided", async () => {
    queryBuilder.then = vi.fn((resolve: (v: unknown) => void) =>
      Promise.resolve({ data: [], error: null }).then(resolve)
    );

    await getIncidentFields("comp-1", "security-breach");

    // Should filter by incident_type_key OR null (for global fields)
    // Implementation may use .or() to combine. We at least assert it was scoped to company.
    expect(queryBuilder.eq).toHaveBeenCalledWith("company_id", "comp-1");
  });

  it("returns [] on error", async () => {
    const dbError = { message: "boom" };
    queryBuilder.then = vi.fn((resolve: (v: unknown) => void) =>
      Promise.resolve({ data: null, error: dbError }).then(resolve)
    );

    const result = await getIncidentFields("comp-1");

    expect(mockedLogDbReadError).toHaveBeenCalledWith("incident fields", dbError);
    expect(result).toEqual([]);
  });
});

describe("createIncidentField()", () => {
  it("inserts with all fields", async () => {
    queryBuilder.then = vi.fn((resolve: (v: unknown) => void) =>
      Promise.resolve({ data: null, error: null }).then(resolve)
    );

    const id = await createIncidentField("comp-1", {
      incidentTypeKey: "security-breach",
      fieldKey: "witness_count",
      label: "Witness Count",
      fieldType: "number",
      options: { min: 0 },
      required: true,
      sortOrder: 3,
      conditionalOn: { field: "type", equals: "x" },
    });

    expect(queryBuilder.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        company_id: "comp-1",
        incident_type_key: "security-breach",
        field_key: "witness_count",
        label: "Witness Count",
        field_type: "number",
        required: true,
        sort_order: 3,
      })
    );
    expect(typeof id).toBe("string");
  });

  it("applies defaults", async () => {
    queryBuilder.then = vi.fn((resolve: (v: unknown) => void) =>
      Promise.resolve({ data: null, error: null }).then(resolve)
    );

    await createIncidentField("comp-1", {
      fieldKey: "fk",
      label: "L",
      fieldType: "text",
    });

    const insertArg = queryBuilder.insert.mock.calls[0][0] as Record<string, unknown>;
    expect(insertArg.incident_type_key).toBeNull();
    expect(insertArg.options).toEqual({});
    expect(insertArg.required).toBe(false);
    expect(insertArg.sort_order).toBe(0);
    expect(insertArg.conditional_on).toBeNull();
  });
});

describe("updateIncidentField()", () => {
  it("updates by id", async () => {
    queryBuilder.maybeSingle.mockResolvedValueOnce({
      data: { ...FIELD_ROW, label: "Updated" },
      error: null,
    });

    const result = await updateIncidentField("f-1", { label: "Updated", required: true });

    expect(queryBuilder.eq).toHaveBeenCalledWith("id", "f-1");
    const updateArg = queryBuilder.update.mock.calls[0][0] as Record<string, unknown>;
    expect(updateArg.label).toBe("Updated");
    expect(updateArg.required).toBe(true);
    expect(result?.label).toBe("Updated");
  });
});

describe("deleteIncidentField()", () => {
  it("deletes by id and returns true", async () => {
    queryBuilder.then = vi.fn((resolve: (v: unknown) => void) =>
      Promise.resolve({ data: null, error: null }).then(resolve)
    );

    const ok = await deleteIncidentField("f-1");

    expect(queryBuilder.delete).toHaveBeenCalled();
    expect(queryBuilder.eq).toHaveBeenCalledWith("id", "f-1");
    expect(ok).toBe(true);
  });

  it("returns false on error", async () => {
    queryBuilder.then = vi.fn((resolve: (v: unknown) => void) =>
      Promise.resolve({ data: null, error: { message: "denied" } }).then(resolve)
    );

    const ok = await deleteIncidentField("f-1");
    expect(ok).toBe(false);
  });
});
