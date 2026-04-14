import { describe, it, expect } from "vitest";
import {
  SEVERITY,
  STATUS,
  TYPES,
  WEATHER_OPTIONS,
  LIGHTING_OPTIONS,
  SERVICES_OPTIONS,
  EVIDENCE_OPTIONS,
  ACTIONS_OPTIONS,
  INJURY_TYPES,
  PROPERTY_DAMAGE,
  sevInfo,
  statInfo,
} from "@/app/incidents/components/constants";

describe("SEVERITY constant", () => {
  it("has 4 severity levels", () => {
    expect(SEVERITY).toHaveLength(4);
  });

  it("contains critical, high, medium, low values", () => {
    const values = SEVERITY.map((s) => s.value);
    expect(values).toEqual(["critical", "high", "medium", "low"]);
  });

  it("each entry has value, label, color, and icon", () => {
    for (const sev of SEVERITY) {
      expect(sev).toHaveProperty("value");
      expect(sev).toHaveProperty("label");
      expect(sev).toHaveProperty("color");
      expect(sev).toHaveProperty("icon");
      expect(typeof sev.value).toBe("string");
      expect(typeof sev.label).toBe("string");
      expect(typeof sev.color).toBe("string");
      expect(sev.icon).toBeDefined();
    }
  });
});

describe("STATUS constant", () => {
  it("has 4 statuses", () => {
    expect(STATUS).toHaveLength(4);
  });

  it("contains open, investigating, resolved, closed values", () => {
    const values = STATUS.map((s) => s.value);
    expect(values).toEqual(["open", "investigating", "resolved", "closed"]);
  });

  it("each entry has value, label, and color", () => {
    for (const st of STATUS) {
      expect(st).toHaveProperty("value");
      expect(st).toHaveProperty("label");
      expect(st).toHaveProperty("color");
    }
  });
});

describe("TYPES constant", () => {
  it("has 21 incident types", () => {
    expect(TYPES).toHaveLength(21);
  });

  it("includes 'general' and 'other'", () => {
    expect(TYPES).toContain("general");
    expect(TYPES).toContain("other");
  });

  it("includes common security incident types", () => {
    expect(TYPES).toContain("trespass");
    expect(TYPES).toContain("theft");
    expect(TYPES).toContain("assault");
    expect(TYPES).toContain("fire");
    expect(TYPES).toContain("medical");
  });
});

describe("Option arrays", () => {
  it("WEATHER_OPTIONS has entries", () => {
    expect(WEATHER_OPTIONS.length).toBeGreaterThan(0);
    expect(WEATHER_OPTIONS).toContain("Clear");
    expect(WEATHER_OPTIONS).toContain("N/A — Indoors");
  });

  it("LIGHTING_OPTIONS has entries", () => {
    expect(LIGHTING_OPTIONS.length).toBeGreaterThan(0);
    expect(LIGHTING_OPTIONS).toContain("Well-lit");
  });

  it("SERVICES_OPTIONS has entries", () => {
    expect(SERVICES_OPTIONS.length).toBeGreaterThan(0);
    expect(SERVICES_OPTIONS).toContain("None");
  });

  it("EVIDENCE_OPTIONS has entries", () => {
    expect(EVIDENCE_OPTIONS.length).toBeGreaterThan(0);
    expect(EVIDENCE_OPTIONS).toContain("None");
  });

  it("ACTIONS_OPTIONS has entries", () => {
    expect(ACTIONS_OPTIONS.length).toBeGreaterThan(0);
  });

  it("INJURY_TYPES starts with None", () => {
    expect(INJURY_TYPES[0]).toBe("None");
  });

  it("PROPERTY_DAMAGE starts with None", () => {
    expect(PROPERTY_DAMAGE[0]).toBe("None");
  });
});

describe("sevInfo helper", () => {
  it("returns correct info for 'critical'", () => {
    const info = sevInfo("critical");
    expect(info.label).toBe("Critical");
    expect(info.color).toContain("red");
  });

  it("returns correct info for 'high'", () => {
    const info = sevInfo("high");
    expect(info.label).toBe("High");
    expect(info.color).toContain("orange");
  });

  it("returns correct info for 'medium'", () => {
    const info = sevInfo("medium");
    expect(info.label).toBe("Medium");
  });

  it("returns correct info for 'low'", () => {
    const info = sevInfo("low");
    expect(info.label).toBe("Low");
    expect(info.color).toContain("blue");
  });

  it("falls back to low for unknown severity", () => {
    const info = sevInfo("unknown_value");
    expect(info.value).toBe("low");
  });
});

describe("statInfo helper", () => {
  it("returns correct info for 'open'", () => {
    const info = statInfo("open");
    expect(info.label).toBe("Open");
    expect(info.color).toContain("red");
  });

  it("returns correct info for 'resolved'", () => {
    const info = statInfo("resolved");
    expect(info.label).toBe("Resolved");
    expect(info.color).toContain("green");
  });

  it("falls back to open for unknown status", () => {
    const info = statInfo("nonexistent");
    expect(info.value).toBe("open");
  });
});
