import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { detectSpeechTier, describeTier } from "@/lib/speech";

describe("dictation is on-device only", () => {
  it("always picks Whisper", () => {
    expect(detectSpeechTier()).toBe("whisper");
    expect(describeTier()).toMatch(/on-device/i);
  });
  it("no dictation code constructs the browser Web Speech API", () => {
    const files = ["components/dictation-recorder.tsx", "lib/speech/index.ts", "app/dictate/page.tsx", "components/incidents/statement-sheet.tsx"];
    for (const f of files) {
      const src = fs.readFileSync(path.join(__dirname, "..", f), "utf8");
      expect(src, f).not.toMatch(/new\s+\w*SpeechRecognition|webkitSpeechRecognition|window\.SpeechRecognition/);
    }
  });
});
