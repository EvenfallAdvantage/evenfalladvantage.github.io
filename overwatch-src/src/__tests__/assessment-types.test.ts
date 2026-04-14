import { describe, it, expect } from "vitest";
import {
  calculateRisk,
  getDefaultData,
  SECTIONS,
  STORAGE_KEY,
} from "@/app/site-assessment/components/assessment-types";

describe("calculateRisk", () => {
  it("returns Low risk for low-threat inputs", () => {
    const result = calculateRisk({
      threatLikelihood: "Rare",
      potentialImpact: "Negligible",
      overallVulnerability: "Minimal",
      resilienceLevel: "Excellent",
    });
    expect(result.level).toBe("Low");
    expect(result.color).toBe("#22c55e");
    expect(result.score).toBeLessThan(25);
  });

  it("returns High risk for worst-case inputs", () => {
    const result = calculateRisk({
      threatLikelihood: "Certain",
      potentialImpact: "Catastrophic",
      overallVulnerability: "Critical",
      resilienceLevel: "None",
    });
    // formula: (90*100)*(100)*2.0/10000*1.5*20 = 54
    expect(result.level).toBe("High");
    expect(result.color).toBe("#f97316");
    expect(result.score).toBeGreaterThanOrEqual(50);
  });

  it("returns Low risk for high-threat inputs without extreme vulnerability", () => {
    const result = calculateRisk({
      threatLikelihood: "Likely",
      potentialImpact: "Major",
      overallVulnerability: "High",
      resilienceLevel: "Poor",
    });
    // formula: (70*75)*1.6/10000*1.2*20 ≈ 20.2
    expect(result.level).toBe("Low");
    expect(result.color).toBe("#22c55e");
    expect(result.score).toBeLessThan(25);
  });

  it("returns Low risk for moderate inputs", () => {
    const result = calculateRisk({
      threatLikelihood: "Possible",
      potentialImpact: "Moderate",
      overallVulnerability: "Moderate",
      resilienceLevel: "Fair",
    });
    // formula: (50*50)*1.3/10000*1.0*20 = 6.5
    expect(result.level).toBe("Low");
    expect(result.color).toBe("#22c55e");
    expect(result.score).toBeLessThan(25);
  });

  it("falls back to defaults (Possible/Moderate/Moderate/Fair) for unknown keys", () => {
    const result = calculateRisk({});
    // Same as moderate inputs → score 6.5 → Low
    expect(result.level).toBe("Low");
    expect(result.score).toBeCloseTo(6.5, 0);
  });

  it("score is capped at 100", () => {
    const result = calculateRisk({
      threatLikelihood: "Certain",
      potentialImpact: "Catastrophic",
      overallVulnerability: "Critical",
      resilienceLevel: "None",
    });
    expect(result.score).toBeLessThanOrEqual(100);
  });

  it("returns recommendations array", () => {
    const result = calculateRisk({
      threatLikelihood: "Likely",
      potentialImpact: "Major",
      overallVulnerability: "High",
      resilienceLevel: "Poor",
    });
    expect(Array.isArray(result.recommendations)).toBe(true);
  });

  it("generates recommendations based on data", () => {
    const result = calculateRisk({
      threatLikelihood: "Likely",
      potentialImpact: "Major",
      overallVulnerability: "High",
      resilienceLevel: "Poor",
      doorType: "Hollow-core",
      interiorLocks: "No interior locks",
      cameraCoverage: "Minimal - limited coverage",
      staffTraining: "None",
    });
    expect(result.recommendations.length).toBeGreaterThan(0);
    // Check that priority sorting works (lower priority first)
    for (let i = 1; i < result.recommendations.length; i++) {
      expect(result.recommendations[i].priority).toBeGreaterThanOrEqual(
        result.recommendations[i - 1].priority,
      );
    }
  });

  it("recommendation for weak doors mentions door replacement", () => {
    const result = calculateRisk({ doorType: "Glass" });
    const doorRec = result.recommendations.find((r) =>
      r.issue.toLowerCase().includes("door"),
    );
    expect(doorRec).toBeDefined();
    expect(doorRec!.recommendation.toLowerCase()).toContain("replace");
  });

  it("no door recommendation when doors are solid-core/metal", () => {
    const result = calculateRisk({ doorType: "Solid-core/Metal" });
    const doorRec = result.recommendations.find((r) =>
      r.issue.toLowerCase().includes("door construction"),
    );
    expect(doorRec).toBeUndefined();
  });
});

describe("getDefaultData", () => {
  it("returns an object", () => {
    const data = getDefaultData();
    expect(typeof data).toBe("object");
    expect(data).not.toBeNull();
  });

  it("has a key for every field in all sections", () => {
    const data = getDefaultData();
    const allFieldNames: string[] = [];
    SECTIONS.forEach((s) => s.fields.forEach((f) => allFieldNames.push(f.name)));

    for (const name of allFieldNames) {
      expect(data).toHaveProperty(name);
    }
  });

  it("date fields default to today's date string", () => {
    const data = getDefaultData();
    const today = new Date().toISOString().split("T")[0];
    expect(data.assessmentDate).toBe(today);
  });

  it("non-date fields default to empty string", () => {
    const data = getDefaultData();
    expect(data.clientName).toBe("");
    expect(data.city).toBe("");
    expect(data.doorType).toBe("");
  });
});

describe("SECTIONS constant", () => {
  it("has 7 sections", () => {
    expect(SECTIONS).toHaveLength(7);
  });

  it("each section has required properties", () => {
    for (const section of SECTIONS) {
      expect(section).toHaveProperty("id");
      expect(section).toHaveProperty("title");
      expect(section).toHaveProperty("icon");
      expect(section).toHaveProperty("tooltip");
      expect(section).toHaveProperty("fields");
      expect(Array.isArray(section.fields)).toBe(true);
      expect(section.fields.length).toBeGreaterThan(0);
    }
  });

  it("section IDs are unique", () => {
    const ids = SECTIONS.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("contains expected section IDs", () => {
    const ids = SECTIONS.map((s) => s.id);
    expect(ids).toContain("clientInfo");
    expect(ids).toContain("physicalSecurity");
    expect(ids).toContain("accessControl");
    expect(ids).toContain("surveillance");
    expect(ids).toContain("emergency");
    expect(ids).toContain("training");
    expect(ids).toContain("riskScoring");
  });

  it("clientInfo section has expected field names", () => {
    const clientInfo = SECTIONS.find((s) => s.id === "clientInfo")!;
    const names = clientInfo.fields.map((f) => f.name);
    expect(names).toContain("clientName");
    expect(names).toContain("facilityType");
    expect(names).toContain("city");
    expect(names).toContain("state");
    expect(names).toContain("assessmentDate");
    expect(names).toContain("assessorName");
  });

  it("riskScoring section has 4 fields", () => {
    const riskScoring = SECTIONS.find((s) => s.id === "riskScoring")!;
    expect(riskScoring.fields).toHaveLength(4);
    const names = riskScoring.fields.map((f) => f.name);
    expect(names).toContain("threatLikelihood");
    expect(names).toContain("potentialImpact");
    expect(names).toContain("overallVulnerability");
    expect(names).toContain("resilienceLevel");
  });

  it("all field names across sections are unique", () => {
    const allNames: string[] = [];
    SECTIONS.forEach((s) => s.fields.forEach((f) => allNames.push(f.name)));
    expect(new Set(allNames).size).toBe(allNames.length);
  });
});

describe("STORAGE_KEY", () => {
  it("is a non-empty string", () => {
    expect(typeof STORAGE_KEY).toBe("string");
    expect(STORAGE_KEY.length).toBeGreaterThan(0);
  });
});
