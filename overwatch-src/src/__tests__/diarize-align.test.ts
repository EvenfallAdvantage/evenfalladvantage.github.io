import { describe, it, expect } from "vitest";
import { alignWordsToSpeakers } from "@/lib/speech/diarize-align";
import type { DiarizationSegment } from "@/lib/speech/diarization";

const w = (text: string, start: number, end: number) => ({ text, start, end });

describe("alignWordsToSpeakers", () => {
  it("keeps the last word of a sentence with its speaker when its timestamp runs into the next turn", () => {
    const segs: DiarizationSegment[] = [
      { speaker: "0", start: 0, end: 2.0 },
      { speaker: "1", start: 2.3, end: 5 },
    ];
    // "tonight?" timestamp drifts well into speaker 1's segment
    const words = [w("Can", 0.2, 0.5), w("you", 0.5, 0.8), w("tell", 0.8, 1.1), w("me", 1.1, 1.4), w("tonight?", 1.9, 2.8), w("I", 3.0, 3.1), w("was", 3.1, 3.4), w("walking.", 3.4, 3.9)];
    const turns = alignWordsToSpeakers(words, segs);
    expect(turns.map(t => [t.speaker, t.text])).toEqual([
      ["0", "Can you tell me tonight?"],
      ["1", "I was walking."],
    ]);
  });

  it("never splits a sentence on a single flipped word", () => {
    const segs: DiarizationSegment[] = [
      { speaker: "0", start: 0, end: 1.0 },
      { speaker: "1", start: 1.0, end: 1.3 },
      { speaker: "0", start: 1.3, end: 3 },
    ];
    const words = [w("What", 0.1, 0.4), w("time", 0.4, 0.9), w("was", 1.0, 1.3), w("that?", 1.3, 1.8)];
    const turns = alignWordsToSpeakers(words, segs);
    expect(turns).toHaveLength(1);
    expect(turns[0].text).toBe("What time was that?");
  });

  it("splits at crosstalk, marks the interruption, and drops no words", () => {
    const segs: DiarizationSegment[] = [
      { speaker: "0", start: 0, end: 2.4 },
      { speaker: "0", start: 1.8, end: 2.4, overlap: true },
      { speaker: "1", start: 1.8, end: 2.4, overlap: true },
      { speaker: "1", start: 1.8, end: 4 },
    ];
    const words = [w("Did", 0, 0.3), w("you", 0.3, 0.6), w("see", 0.6, 0.9), w("anyone", 0.9, 1.5), w("yes", 1.9, 2.2), w("a", 2.2, 2.4), w("man", 2.5, 2.8), w("ran.", 2.8, 3.2)];
    const turns = alignWordsToSpeakers(words, segs);
    expect(turns.map(t => t.speaker)).toEqual(["0", "1"]);
    expect(turns[0].text.endsWith("—")).toBe(true);
    expect(turns[1].text.startsWith("[crosstalk]")).toBe(true);
    const all = turns.map(t => t.text).join(" ").replace(/\[crosstalk\]|—/g, " ").split(/\s+/).filter(Boolean);
    expect(all).toEqual(["Did", "you", "see", "anyone", "yes", "a", "man", "ran."]);
  });
});
