/**
 * Pure helpers that turn per-company incident definitions (HQ Config →
 * Incident Configuration) into what the incident screens show, with the
 * built-in defaults as a fallback when a company hasn't configured anything.
 */

import { TYPES, STATUS } from "@/app/incidents/components/constants";
import type { IncidentType, IncidentStatus, IncidentField } from "@/lib/supabase/db-incident-config";

export type TypeOption = { key: string; label: string; color?: string };
export type StatusOption = { key: string; label: string; color?: string; isTerminal: boolean };
export type Choice = { value: string; label: string };

/** "suspicious_activity" -> "Suspicious Activity" */
export function humanizeKey(key: string): string {
  return key.replace(/[_-]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()).trim();
}

/** "Slip, Trip & Fall!" -> "slip_trip_fall". Max 48 chars. */
export function slugKey(label: string): string {
  return label
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 48);
}

export const DEFAULT_TYPE_OPTIONS: TypeOption[] = TYPES.map((k) => ({ key: k, label: humanizeKey(k) }));

const TERMINAL_DEFAULTS = new Set(["resolved", "closed"]);
const DEFAULT_STATUS_COLORS: Record<string, string> = {
  open: "#ef4444",
  investigating: "#f59e0b",
  resolved: "#22c55e",
  closed: "#6b7280",
};
export const DEFAULT_STATUS_OPTIONS: StatusOption[] = STATUS.map((s) => ({
  key: s.value,
  label: s.label,
  color: DEFAULT_STATUS_COLORS[s.value],
  isTerminal: TERMINAL_DEFAULTS.has(s.value),
}));

/**
 * Types offered on the report form: the company's active, sorted types, or the
 * built-in list when none are configured. `current` is kept visible so an
 * existing value never disappears from the picker.
 */
export function effectiveIncidentTypes(defs: IncidentType[], current?: string): TypeOption[] {
  const active = defs.filter((d) => d.isActive).sort((a, b) => a.sortOrder - b.sortOrder);
  const list: TypeOption[] = active.length
    ? active.map((d) => ({ key: d.key, label: d.label, color: d.color }))
    : DEFAULT_TYPE_OPTIONS;
  if (current && !list.some((t) => t.key === current)) {
    return [...list, { key: current, label: humanizeKey(current) }];
  }
  return list;
}

/** Statuses for the board/list: configured ones, or the built-in four. */
export function effectiveIncidentStatuses(defs: IncidentStatus[]): StatusOption[] {
  if (!defs.length) return DEFAULT_STATUS_OPTIONS;
  return [...defs]
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((d) => ({ key: d.key, label: d.label, color: d.color, isTerminal: d.isTerminal }));
}

/** Custom fields that apply to a type: fields for "All types" plus that type's own. */
export function fieldsForType(fields: IncidentField[], typeKey: string): IncidentField[] {
  return fields
    .filter((f) => !f.incidentTypeKey || f.incidentTypeKey === typeKey)
    .sort((a, b) => a.sortOrder - b.sortOrder);
}

/** Choices stored as options.choices = [{ value, label }]. */
export function getChoices(field: Pick<IncidentField, "options">): Choice[] {
  const raw = (field.options as { choices?: unknown } | null | undefined)?.choices;
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((c): c is Choice => !!c && typeof c === "object" && typeof (c as Choice).value === "string")
    .map((c) => ({ value: c.value, label: typeof c.label === "string" && c.label ? c.label : c.value }));
}

/** One choice per line (commas also split). Dedupes by value; max 50. */
export function parseChoices(text: string): Choice[] {
  const out: Choice[] = [];
  for (const part of text.split(/[\n,]+/)) {
    const label = part.trim();
    if (!label) continue;
    const value = slugKey(label) || label.toLowerCase();
    if (!out.some((c) => c.value === value)) out.push({ value, label: label.slice(0, 80) });
    if (out.length >= 50) break;
  }
  return out;
}

export function choicesToText(choices: Choice[]): string {
  return choices.map((c) => c.label).join("\n");
}

function isEmpty(v: unknown): boolean {
  if (v === undefined || v === null) return true;
  if (typeof v === "string") return v.trim() === "";
  if (Array.isArray(v)) return v.length === 0;
  return false; // numbers, booleans (an unticked required checkbox is caught below)
}

/** Labels of required fields (for this type) that are still empty/unticked. */
export function missingRequiredFields(fields: IncidentField[], values: Record<string, unknown>): string[] {
  return fields
    .filter((f) => f.required)
    .filter((f) => (f.fieldType === "checkbox" ? values[f.fieldKey] !== true : isEmpty(values[f.fieldKey])))
    .map((f) => f.label);
}

/** Keep only values for fields that apply to the chosen type. */
export function pickFieldValues(fields: IncidentField[], values: Record<string, unknown>): Record<string, unknown> {
  const keys = new Set(fields.map((f) => f.fieldKey));
  return Object.fromEntries(Object.entries(values).filter(([k]) => keys.has(k)));
}

/**
 * Same as effectiveIncidentStatuses but in the IncidentStatus shape the board
 * already renders (synthetic ids for the built-in defaults).
 */
export function statusDefsOrDefaults(defs: IncidentStatus[], companyId: string): IncidentStatus[] {
  if (defs.length) return defs;
  return DEFAULT_STATUS_OPTIONS.map((s, i) => ({
    id: `default-${s.key}`,
    companyId,
    key: s.key,
    label: s.label,
    color: s.color ?? "#6b7280",
    sortOrder: i,
    isTerminal: s.isTerminal,
    createdAt: "",
    updatedAt: "",
  }));
}

/**
 * Move item `index` one step up (-1) or down (+1) and return the sort_order
 * updates needed (renumbers 0..n-1 so ties from old data are fixed too).
 */
export function reorderUpdates<T extends { id: string; sortOrder: number }>(
  items: T[],
  index: number,
  dir: -1 | 1,
): { id: string; sortOrder: number }[] {
  const target = index + dir;
  if (index < 0 || index >= items.length || target < 0 || target >= items.length) return [];
  const next = [...items];
  [next[index], next[target]] = [next[target], next[index]];
  return next
    .map((it, i) => ({ id: it.id, sortOrder: i, prev: it.sortOrder }))
    .filter((u) => u.sortOrder !== u.prev)
    .map(({ id, sortOrder }) => ({ id, sortOrder }));
}

export const KEY_RE = /^[a-z0-9][a-z0-9_]{0,47}$/;
