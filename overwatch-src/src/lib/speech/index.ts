/**
 * Speech Engine — auto-selects the best available speech-to-text backend.
 *
 * Tier 1: Browser-native Web Speech API (Chrome/Edge only, online only)
 *   - Free, real-time streaming, interim results
 *   - Fails on Brave, Firefox, Safari, offline
 *
 * Tier 2: Whisper WASM (all browsers, works offline after first model download)
 *   - ~75MB model download on first use (cached)
 *   - Not streaming — transcribes after recording stops
 *   - Works everywhere including Brave, Firefox, Safari
 */

export type SpeechTier = "native" | "whisper";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function isBrave(): boolean {
  return typeof navigator !== "undefined" && !!(navigator as any).brave;
}

function hasNativeSpeechRecognition(): boolean {
  if (typeof window === "undefined") return false;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const w = window as any;
  return !!(w.SpeechRecognition || w.webkitSpeechRecognition);
}

/**
 * Determine which speech engine tier is available and recommended.
 */
export function detectSpeechTier(): SpeechTier {
  // Brave exposes the constructor but blocks it — always use Whisper
  if (isBrave()) return "whisper";

  // Firefox and Safari don't support Web Speech API reliably
  if (hasNativeSpeechRecognition()) return "native";

  // Fallback: Whisper WASM works everywhere
  return "whisper";
}

/**
 * Human-readable description of the active speech tier.
 */
export function describeTier(tier: SpeechTier): string {
  switch (tier) {
    case "native":
      return "Browser speech recognition (Google)";
    case "whisper":
      return "Whisper AI (local, private)";
  }
}
