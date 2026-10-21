/**
 * Officer-chosen names for diarized speakers. Detection labels speakers
 * "Speaker 1", "Speaker 2", …; after recording the officer can rename them
 * (e.g. "Officer Lee", "Witness"). A rename applies across the whole
 * transcript. Pure string helpers; everything stays on the device until saved.
 */
import type { SpeakerTurn } from "./diarize-align";

/** speaker id ("0", "1", …) -> display name. Missing = default "Speaker N". */
export type SpeakerNames = Record<string, string>;

export const defaultSpeakerLabel = (id: string) => `Speaker ${Number(id) + 1}`;

/** Clean a typed name: one line, no brackets, max 40 chars. Empty = default. */
export function cleanSpeakerName(raw: string): string {
  return raw.replace(/[[\]\r\n]+/g, " ").replace(/\s+/g, " ").trim().slice(0, 40);
}

export function speakerLabel(id: string, names: SpeakerNames | null | undefined): string {
  const n = names?.[id] ? cleanSpeakerName(names[id]) : "";
  return n || defaultSpeakerLabel(id);
}

/** Distinct speaker ids in order of first appearance. */
export function speakerIds(turns: SpeakerTurn[]): string[] {
  return [...new Set(turns.map((t) => t.speaker))];
}

/** Inline transcript with names: "[Officer Lee] text". */
export function turnsToNamedText(turns: SpeakerTurn[], names: SpeakerNames | null | undefined): string {
  return turns.map((t) => `[${speakerLabel(t.speaker, names)}] ${t.text}`).join("\n");
}

const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Turn "[Officer Lee]" prefixes back into "[Speaker N]" so the text can be re-parsed into turns. */
export function toCanonicalLabels(text: string, names: SpeakerNames | null | undefined): string {
  let out = text;
  for (const [id, raw] of Object.entries(names ?? {})) {
    const name = cleanSpeakerName(raw);
    if (!name) continue;
    out = out.replace(new RegExp(`^(\\s*)\\[${esc(name)}\\]`, "gim"), `$1[${defaultSpeakerLabel(id)}]`);
  }
  return out;
}

/** Rename one speaker everywhere. Returns the new names map (empty name resets to default). */
export function renameSpeaker(names: SpeakerNames | null | undefined, id: string, raw: string): SpeakerNames {
  const next = { ...(names ?? {}) };
  const name = cleanSpeakerName(raw);
  if (!name || name === defaultSpeakerLabel(id)) delete next[id]; else next[id] = name;
  return next;
}
