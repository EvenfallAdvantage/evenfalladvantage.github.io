import fs from "fs";
import path from "path";
import { describe, it, expect } from "vitest";
import { SCENARIOS as scenarios, getSubjectImage } from "@/lib/deescalation-scenarios";

// Static assets live at the repo root (served as /images, /audio).
const ROOT = path.resolve(__dirname, "../../..");
const STATES = ["Distressed", "Sad", "Angry", "Faded", "Happy", "Fail"];

describe("de-escalation scenario assets", () => {
  it("finds the scenario list", () => {
    expect(scenarios?.length).toBeGreaterThanOrEqual(3);
  });

  it.each(STATES)("denied-entry-id has subject 3 image for %s", (state) => {
    const s = scenarios.find((x) => x.id === "denied-entry-id")!;
    expect(s.subjectId).toBe(3);
    expect(fs.existsSync(path.join(ROOT, `images/de_escalation/3-${state}.jpg`))).toBe(true);
  });

  it("every scenario's audio files and step-state images exist", () => {
    for (const s of scenarios) {
      for (const [step, url] of Object.entries(s.audioMap)) {
        expect(s.steps[step], `${s.id}:${step}`).toBeDefined();
        expect(fs.existsSync(path.join(ROOT, url)), url).toBe(true);
      }
      if (s.subjectId) {
        for (const step of Object.values(s.steps)) {
          const img = getSubjectImage(s.subjectId, step.state)!;
          expect(fs.existsSync(path.join(ROOT, img)), img).toBe(true);
        }
      }
    }
  });

  it("denied-entry-id has audio for every step", () => {
    const s = scenarios.find((x) => x.id === "denied-entry-id")!;
    expect(Object.keys(s.audioMap).sort()).toEqual(Object.keys(s.steps).sort());
  });

  it.each([
    ["assault-disclosure", 4],
    ["service-dog-entry", 5],
  ] as const)("%s has subject %i images and audio for every step", (id, subject) => {
    const s = scenarios.find((x) => x.id === id)!;
    expect(s.subjectId).toBe(subject);
    expect(Object.keys(s.audioMap).sort()).toEqual(Object.keys(s.steps).sort());
    for (const state of STATES) {
      expect(fs.existsSync(path.join(ROOT, `images/de_escalation/${subject}-${state}.jpg`))).toBe(true);
    }
  });

  it("every choice points to an existing step", () => {
    for (const s of scenarios) {
      for (const step of Object.values(s.steps)) {
        for (const c of step.choices ?? []) expect(s.steps[c.next], `${s.id}->${c.next}`).toBeDefined();
      }
    }
  });

  it("assault-disclosure has a content note with the RAINN hotline", () => {
    const s = scenarios.find((x) => x.id === "assault-disclosure")!;
    expect(s.contentNote).toMatch(/800-656-HOPE/);
  });
});
