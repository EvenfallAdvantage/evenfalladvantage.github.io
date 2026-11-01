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
});
