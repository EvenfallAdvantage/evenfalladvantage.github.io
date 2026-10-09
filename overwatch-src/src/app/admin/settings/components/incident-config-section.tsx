"use client";

import { useState, useCallback, useEffect } from "react";
import { ArrowDown, ArrowUp, Check, Loader2, Pencil, Plus, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { toast } from "sonner";
import { hasMinRole } from "@/lib/permissions";
import { useAuthStore } from "@/stores/auth-store";
import { useConfirmDialog } from "@/hooks/use-confirm-dialog";
import { logger } from "@/lib/logger";
import {
  getIncidentTypes,
  createIncidentType,
  updateIncidentType,
  deleteIncidentType,
  getIncidentStatuses,
  createIncidentStatus,
  updateIncidentStatus,
  deleteIncidentStatus,
  getIncidentFields,
  createIncidentField,
  updateIncidentField,
  deleteIncidentField,
} from "@/lib/supabase/db";
import type { IncidentType, IncidentStatus, IncidentField } from "@/lib/supabase/db-incident-config";
import {
  DEFAULT_STATUS_OPTIONS,
  DEFAULT_TYPE_OPTIONS,
  KEY_RE,
  choicesToText,
  getChoices,
  parseChoices,
  reorderUpdates,
  slugKey,
} from "@/lib/incident-config-resolve";

type FieldType = IncidentField["fieldType"];
const FIELD_TYPES: { value: FieldType; label: string }[] = [
  { value: "text", label: "Short text" },
  { value: "textarea", label: "Long text" },
  { value: "number", label: "Number" },
  { value: "date", label: "Date" },
  { value: "checkbox", label: "Checkbox" },
  { value: "select", label: "Pick one" },
  { value: "multiselect", label: "Pick several" },
];
const hasChoices = (t: FieldType) => t === "select" || t === "multiselect";

/* Touch-friendly icon button (44px on phones, compact on desktop). */
function IconBtn({ label, onClick, disabled, children, danger }: { label: string; onClick: () => void; disabled?: boolean; children: React.ReactNode; danger?: boolean }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      disabled={disabled}
      className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted/40 disabled:opacity-30 sm:h-8 sm:w-8 ${danger ? "hover:text-red-500" : "hover:text-foreground"}`}
    >
      {children}
    </button>
  );
}

/* Inline label editor. */
function EditableLabel({ value, onSave }: { value: string; onSave: (v: string) => Promise<void> }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const [busy, setBusy] = useState(false);
  if (!editing) {
    return (
      <span className="flex min-w-0 items-center gap-1">
        <span className="truncate font-medium">{value}</span>
        <IconBtn label={`Rename ${value}`} onClick={() => { setDraft(value); setEditing(true); }}>
          <Pencil className="h-3.5 w-3.5" />
        </IconBtn>
      </span>
    );
  }
  return (
    <form
      className="flex min-w-0 flex-1 items-center gap-1"
      onSubmit={async (e) => {
        e.preventDefault();
        if (!draft.trim() || draft.trim() === value) { setEditing(false); return; }
        setBusy(true);
        try { await onSave(draft.trim()); setEditing(false); } finally { setBusy(false); }
      }}
    >
      <Input value={draft} onChange={(e) => setDraft(e.target.value)} aria-label="New label" className="h-11 min-w-0 flex-1 sm:h-8" autoFocus maxLength={60} />
      <button type="submit" aria-label="Save label" disabled={busy} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-muted/40 hover:text-foreground disabled:opacity-30 sm:h-8 sm:w-8">
        {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-4 w-4" />}
      </button>
      <IconBtn label="Cancel" onClick={() => setEditing(false)}>
        <X className="h-4 w-4" />
      </IconBtn>
    </form>
  );
}

export default function IncidentConfigSection({ companyId }: { companyId: string }) {
  const activeCompany = useAuthStore((s) => s.getActiveCompany());
  const canManage = !!activeCompany && hasMinRole(activeCompany.role, "manager");
  const { confirm, ConfirmDialog } = useConfirmDialog();

  const [types, setTypes] = useState<IncidentType[]>([]);
  const [statuses, setStatuses] = useState<IncidentStatus[]>([]);
  const [fields, setFields] = useState<IncidentField[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [busy, setBusy] = useState(false);

  // add forms
  const [typeLabel, setTypeLabel] = useState("");
  const [typeColor, setTypeColor] = useState("#6366f1");
  const [statusLabel, setStatusLabel] = useState("");
  const [statusColor, setStatusColor] = useState("#6366f1");
  const [statusTerminal, setStatusTerminal] = useState(false);
  const [fieldLabel, setFieldLabel] = useState("");
  const [fieldType, setFieldType] = useState<FieldType>("text");
  const [fieldTypeKey, setFieldTypeKey] = useState("");
  const [fieldRequired, setFieldRequired] = useState(false);
  const [fieldChoices, setFieldChoices] = useState("");
  // choices being edited on an existing field
  const [choiceEdit, setChoiceEdit] = useState<{ id: string; text: string } | null>(null);

  const load = useCallback(async () => {
    if (!canManage) return;
    try {
      const [t, s, f] = await Promise.all([
        getIncidentTypes(companyId),
        getIncidentStatuses(companyId),
        getIncidentFields(companyId),
      ]);
      setTypes([...t].sort((a, b) => a.sortOrder - b.sortOrder));
      setStatuses([...s].sort((a, b) => a.sortOrder - b.sortOrder));
      setFields([...f].sort((a, b) => a.sortOrder - b.sortOrder));
      setLoadFailed(false);
    } catch (e) {
      logger.swallow("incident-config:load", e, "warn");
      setLoadFailed(true);
    } finally {
      setLoading(false);
    }
  }, [companyId, canManage]);

  useEffect(() => { void load(); }, [load]);

  /** Run a write, toast the outcome, reload. Writes return a truthy value on success. */
  async function run(action: () => Promise<unknown>, ok: string, fail: string) {
    setBusy(true);
    try {
      const res = await action();
      if (res === null || res === false) throw new Error(fail);
      toast.success(ok);
      await load();
      return true;
    } catch (e) {
      logger.swallow("incident-config:write", e, "warn");
      toast.error(fail);
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function move<T extends { id: string; sortOrder: number }>(items: T[], i: number, dir: -1 | 1, update: (id: string, sortOrder: number) => Promise<unknown>) {
    const ups = reorderUpdates(items, i, dir);
    if (!ups.length) return;
    await run(async () => {
      const results = await Promise.all(ups.map((u) => update(u.id, u.sortOrder)));
      return results.every((r) => r !== null && r !== false);
    }, "Order updated", "Could not reorder");
  }

  /* ── Types ── */
  async function addType(e: React.FormEvent) {
    e.preventDefault();
    const key = slugKey(typeLabel);
    if (!typeLabel.trim() || !KEY_RE.test(key)) { toast.error("Enter a name using letters or numbers"); return; }
    if (types.some((t) => t.key === key)) { toast.error("That type already exists"); return; }
    const ok = await run(() => createIncidentType(companyId, { key, label: typeLabel.trim(), color: typeColor, sortOrder: types.length }), "Type added", "Could not add type");
    if (ok) setTypeLabel("");
  }
  async function seedTypes() {
    await run(async () => {
      const ids = await Promise.all(DEFAULT_TYPE_OPTIONS.map((t, i) => createIncidentType(companyId, { key: t.key, label: t.label, sortOrder: i })));
      return ids.every(Boolean);
    }, "Built-in types added. Rename, reorder or disable them as you like.", "Could not add built-in types");
  }
  async function removeType(t: IncidentType) {
    const ok = await confirm({ title: `Delete "${t.label}"?`, description: "Existing incidents keep this type. It just won't be offered on new reports. Disabling is usually better.", confirmLabel: "Delete", variant: "destructive" });
    if (ok) await run(() => deleteIncidentType(t.id), "Type deleted", "Could not delete type");
  }

  /* ── Statuses ── */
  async function addStatus(e: React.FormEvent) {
    e.preventDefault();
    const key = slugKey(statusLabel);
    if (!statusLabel.trim() || !KEY_RE.test(key)) { toast.error("Enter a name using letters or numbers"); return; }
    if (statuses.some((s) => s.key === key)) { toast.error("That status already exists"); return; }
    const ok = await run(async () => {
      const id = await createIncidentStatus(companyId, { key, label: statusLabel.trim(), color: statusColor, sortOrder: statuses.length });
      if (id && statusTerminal) await updateIncidentStatus(id, { isTerminal: true });
      return id;
    }, "Status added", "Could not add status");
    if (ok) { setStatusLabel(""); setStatusTerminal(false); }
  }
  async function seedStatuses() {
    await run(async () => {
      const ids = await Promise.all(DEFAULT_STATUS_OPTIONS.map((s, i) => createIncidentStatus(companyId, { key: s.key, label: s.label, color: s.color, sortOrder: i })));
      await Promise.all(ids.map((id, i) => (id && DEFAULT_STATUS_OPTIONS[i].isTerminal ? updateIncidentStatus(id, { isTerminal: true }) : null)));
      return ids.every(Boolean);
    }, "Default statuses added", "Could not add default statuses");
  }
  async function removeStatus(s: IncidentStatus) {
    const ok = await confirm({ title: `Delete "${s.label}"?`, description: "Incidents already in this status keep it, but it won't be offered any more.", confirmLabel: "Delete", variant: "destructive" });
    if (ok) await run(() => deleteIncidentStatus(s.id), "Status deleted", "Could not delete status");
  }

  /* ── Fields ── */
  async function addField(e: React.FormEvent) {
    e.preventDefault();
    const key = slugKey(fieldLabel);
    if (!fieldLabel.trim() || !KEY_RE.test(key)) { toast.error("Enter a field name using letters or numbers"); return; }
    if (fields.some((f) => f.fieldKey === key && (f.incidentTypeKey ?? "") === fieldTypeKey)) { toast.error("A field with that name already exists for this type"); return; }
    const choices = hasChoices(fieldType) ? parseChoices(fieldChoices) : [];
    if (hasChoices(fieldType) && choices.length < 2) { toast.error("Add at least two choices, one per line"); return; }
    const ok = await run(() => createIncidentField(companyId, {
      incidentTypeKey: fieldTypeKey || undefined,
      fieldKey: key,
      label: fieldLabel.trim(),
      fieldType,
      required: fieldRequired,
      options: choices.length ? { choices } : {},
      sortOrder: fields.length,
    }), "Field added", "Could not add field");
    if (ok) { setFieldLabel(""); setFieldChoices(""); setFieldRequired(false); }
  }
  async function saveChoices(f: IncidentField, text: string) {
    const choices = parseChoices(text);
    if (choices.length < 2) { toast.error("Add at least two choices, one per line"); return; }
    const ok = await run(() => updateIncidentField(f.id, { options: { ...(f.options ?? {}), choices } }), "Choices saved", "Could not save choices");
    if (ok) setChoiceEdit(null);
  }
  async function removeField(f: IncidentField) {
    const ok = await confirm({ title: `Delete "${f.label}"?`, description: "Answers already saved on incidents are kept, but the field won't appear on new reports.", confirmLabel: "Delete", variant: "destructive" });
    if (ok) await run(() => deleteIncidentField(f.id), "Field deleted", "Could not delete field");
  }

  if (!canManage) return null;

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Incident Configuration</CardTitle>
          <CardDescription className="flex items-center gap-2"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading…</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  if (loadFailed) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Incident Configuration</CardTitle>
          <CardDescription role="alert">Couldn&apos;t load incident settings.</CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="outline" className="h-11 sm:h-8" onClick={() => { setLoading(true); void load(); }}>Try again</Button>
        </CardContent>
      </Card>
    );
  }

  const typeName = (key: string | null) => (key ? types.find((t) => t.key === key)?.label ?? key : "All types");
  const rowCls = "flex flex-wrap items-center gap-x-2 gap-y-1 rounded-lg border border-border/40 p-2";

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-semibold">Incident Configuration</h3>
        <p className="text-xs text-muted-foreground">Types and custom fields appear on the incident report form. Statuses drive the incident list and board.</p>
      </div>

      {/* ── Types ── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Incident types</CardTitle>
          <CardDescription>
            {types.length ? "Only enabled types are offered on new reports." : "None set up, so reports use the built-in list (General, Trespass, Theft…)."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {!types.length && (
            <Button variant="outline" className="h-11 w-full sm:h-8 sm:w-auto" onClick={seedTypes} disabled={busy}>
              Start from the built-in list
            </Button>
          )}
          <form onSubmit={addType} className="grid gap-2 sm:grid-cols-[1fr_auto_auto]">
            <Input aria-label="New type name" placeholder="New type (e.g. Noise complaint)" value={typeLabel} onChange={(e) => setTypeLabel(e.target.value)} className="h-11 sm:h-8" maxLength={60} />
            <Input aria-label="Type colour" type="color" value={typeColor} onChange={(e) => setTypeColor(e.target.value)} className="h-11 w-full p-1 sm:h-8 sm:w-12" />
            <Button type="submit" className="h-11 gap-1 sm:h-8" disabled={busy || !typeLabel.trim()}><Plus className="h-4 w-4" /> Add type</Button>
          </form>
          <div className="space-y-2">
            {types.map((t, i) => (
              <div key={t.id} className={`${rowCls} ${t.isActive ? "" : "opacity-60"}`}>
                <span className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: t.color }} />
                <div className="min-w-0 flex-1"><EditableLabel value={t.label} onSave={async (label) => { await run(() => updateIncidentType(t.id, { label }), "Type renamed", "Could not rename"); }} /></div>
                <span className="text-[11px] text-muted-foreground">{t.key}</span>
                <div className="ml-auto flex items-center">
                  <IconBtn label="Move up" onClick={() => move(types, i, -1, (id, sortOrder) => updateIncidentType(id, { sortOrder }))} disabled={busy || i === 0}><ArrowUp className="h-4 w-4" /></IconBtn>
                  <IconBtn label="Move down" onClick={() => move(types, i, 1, (id, sortOrder) => updateIncidentType(id, { sortOrder }))} disabled={busy || i === types.length - 1}><ArrowDown className="h-4 w-4" /></IconBtn>
                  <Button variant="ghost" size="sm" className="h-11 sm:h-8" disabled={busy} onClick={() => run(() => updateIncidentType(t.id, { isActive: !t.isActive }), t.isActive ? "Type disabled" : "Type enabled", "Could not update type")}>
                    {t.isActive ? "Disable" : "Enable"}
                  </Button>
                  <IconBtn label={`Delete ${t.label}`} danger onClick={() => removeType(t)} disabled={busy}><Trash2 className="h-4 w-4" /></IconBtn>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* ── Statuses ── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Incident statuses</CardTitle>
          <CardDescription>
            {statuses.length ? "Closed statuses count an incident as finished." : "None set up, so the default Open / Investigating / Resolved / Closed are used."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {!statuses.length && (
            <Button variant="outline" className="h-11 w-full sm:h-8 sm:w-auto" onClick={seedStatuses} disabled={busy}>
              Start from the defaults
            </Button>
          )}
          <form onSubmit={addStatus} className="grid gap-2 sm:grid-cols-[1fr_auto_auto_auto] sm:items-center">
            <Input aria-label="New status name" placeholder="New status (e.g. Awaiting police)" value={statusLabel} onChange={(e) => setStatusLabel(e.target.value)} className="h-11 sm:h-8" maxLength={60} />
            <Input aria-label="Status colour" type="color" value={statusColor} onChange={(e) => setStatusColor(e.target.value)} className="h-11 w-full p-1 sm:h-8 sm:w-12" />
            <label className="flex min-h-11 items-center gap-2 text-xs sm:min-h-0">
              <input type="checkbox" checked={statusTerminal} onChange={(e) => setStatusTerminal(e.target.checked)} className="rounded" /> Closes the incident
            </label>
            <Button type="submit" className="h-11 gap-1 sm:h-8" disabled={busy || !statusLabel.trim()}><Plus className="h-4 w-4" /> Add status</Button>
          </form>
          <div className="space-y-2">
            {statuses.map((s, i) => (
              <div key={s.id} className={rowCls}>
                <span className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: s.color }} />
                <div className="min-w-0 flex-1"><EditableLabel value={s.label} onSave={async (label) => { await run(() => updateIncidentStatus(s.id, { label }), "Status renamed", "Could not rename"); }} /></div>
                {s.isTerminal && <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">closes</span>}
                <div className="ml-auto flex items-center">
                  <IconBtn label="Move up" onClick={() => move(statuses, i, -1, (id, sortOrder) => updateIncidentStatus(id, { sortOrder }))} disabled={busy || i === 0}><ArrowUp className="h-4 w-4" /></IconBtn>
                  <IconBtn label="Move down" onClick={() => move(statuses, i, 1, (id, sortOrder) => updateIncidentStatus(id, { sortOrder }))} disabled={busy || i === statuses.length - 1}><ArrowDown className="h-4 w-4" /></IconBtn>
                  <Button variant="ghost" size="sm" className="h-11 sm:h-8" disabled={busy} onClick={() => run(() => updateIncidentStatus(s.id, { isTerminal: !s.isTerminal }), "Status updated", "Could not update status")}>
                    {s.isTerminal ? "Mark open" : "Mark closing"}
                  </Button>
                  <IconBtn label={`Delete ${s.label}`} danger onClick={() => removeStatus(s)} disabled={busy}><Trash2 className="h-4 w-4" /></IconBtn>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* ── Custom fields ── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Custom fields</CardTitle>
          <CardDescription>Extra questions on the report form. A field for one type only shows when that type is picked.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <form onSubmit={addField} className="space-y-2 rounded-lg border border-border/40 p-3">
            <div className="grid gap-2 sm:grid-cols-3">
              <Input aria-label="Field name" placeholder="Question (e.g. Weapon involved?)" value={fieldLabel} onChange={(e) => setFieldLabel(e.target.value)} className="h-11 sm:h-8" maxLength={80} />
              <select aria-label="Answer type" value={fieldType} onChange={(e) => setFieldType(e.target.value as FieldType)} className="h-11 rounded-md border border-input bg-background px-2 text-sm sm:h-8">
                {FIELD_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
              <select aria-label="Applies to" value={fieldTypeKey} onChange={(e) => setFieldTypeKey(e.target.value)} className="h-11 rounded-md border border-input bg-background px-2 text-sm sm:h-8">
                <option value="">All types</option>
                {(types.length ? types.map((t) => ({ key: t.key, label: t.label })) : DEFAULT_TYPE_OPTIONS).map((t) => (
                  <option key={t.key} value={t.key}>{t.label}</option>
                ))}
              </select>
            </div>
            {hasChoices(fieldType) && (
              <textarea
                aria-label="Choices, one per line"
                placeholder={"Choices, one per line\nYes\nNo\nUnknown"}
                value={fieldChoices}
                onChange={(e) => setFieldChoices(e.target.value)}
                className="min-h-24 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              />
            )}
            <div className="flex flex-wrap items-center justify-between gap-2">
              <label className="flex min-h-11 items-center gap-2 text-sm sm:min-h-0">
                <input type="checkbox" checked={fieldRequired} onChange={(e) => setFieldRequired(e.target.checked)} className="rounded" /> Required
              </label>
              <Button type="submit" className="h-11 gap-1 sm:h-8" disabled={busy || !fieldLabel.trim()}><Plus className="h-4 w-4" /> Add field</Button>
            </div>
          </form>

          {fields.length === 0 && <p className="text-xs text-muted-foreground">No custom fields yet.</p>}
          <div className="space-y-2">
            {fields.map((f, i) => {
              const choices = getChoices(f);
              const editing = choiceEdit?.id === f.id;
              return (
                <div key={f.id} className="space-y-2 rounded-lg border border-border/40 p-2">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <div className="min-w-0 flex-1"><EditableLabel value={f.label} onSave={async (label) => { await run(() => updateIncidentField(f.id, { label }), "Field renamed", "Could not rename"); }} /></div>
                    <span className="text-[11px] text-muted-foreground">{FIELD_TYPES.find((t) => t.value === f.fieldType)?.label ?? f.fieldType} · {typeName(f.incidentTypeKey)}</span>
                    <div className="ml-auto flex items-center">
                      <IconBtn label="Move up" onClick={() => move(fields, i, -1, (id, sortOrder) => updateIncidentField(id, { sortOrder }))} disabled={busy || i === 0}><ArrowUp className="h-4 w-4" /></IconBtn>
                      <IconBtn label="Move down" onClick={() => move(fields, i, 1, (id, sortOrder) => updateIncidentField(id, { sortOrder }))} disabled={busy || i === fields.length - 1}><ArrowDown className="h-4 w-4" /></IconBtn>
                      <Button variant="ghost" size="sm" className="h-11 sm:h-8" disabled={busy} onClick={() => run(() => updateIncidentField(f.id, { required: !f.required }), "Field updated", "Could not update field")}>
                        {f.required ? "Required" : "Optional"}
                      </Button>
                      <IconBtn label={`Delete ${f.label}`} danger onClick={() => removeField(f)} disabled={busy}><Trash2 className="h-4 w-4" /></IconBtn>
                    </div>
                  </div>
                  {hasChoices(f.fieldType) && (
                    editing ? (
                      <div className="space-y-2">
                        <textarea aria-label={`Choices for ${f.label}`} value={choiceEdit.text} onChange={(e) => setChoiceEdit({ id: f.id, text: e.target.value })} className="min-h-24 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
                        <div className="flex gap-2">
                          <Button size="sm" className="h-11 sm:h-8" disabled={busy} onClick={() => saveChoices(f, choiceEdit.text)}>Save choices</Button>
                          <Button size="sm" variant="ghost" className="h-11 sm:h-8" onClick={() => setChoiceEdit(null)}>Cancel</Button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-wrap items-center gap-1">
                        {choices.length === 0 && <span className="text-[11px] text-amber-500">No choices yet, so this field can&apos;t be answered.</span>}
                        {choices.map((c) => <span key={c.value} className="rounded bg-muted px-1.5 py-0.5 text-[11px]">{c.label}</span>)}
                        <Button size="sm" variant="ghost" className="h-11 sm:h-7" onClick={() => setChoiceEdit({ id: f.id, text: choicesToText(choices) })}>Edit choices</Button>
                      </div>
                    )
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
      <ConfirmDialog />
    </div>
  );
}
