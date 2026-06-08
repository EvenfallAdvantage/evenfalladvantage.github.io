"use client";

import { useState, useCallback, useEffect } from "react";
import { CheckCircle2, Plus, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { hasMinRole } from "@/lib/permissions";
import { useAuthStore } from "@/stores/auth-store";
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
import type { IncidentType as IncidentTypeDef, IncidentStatus as IncidentStatusDef, IncidentField as IncidentFieldDef } from "@/lib/supabase/db-incident-config";

type IncidentType = IncidentTypeDef;
type IncidentStatus = IncidentStatusDef;
type IncidentField = IncidentFieldDef;

export default function IncidentConfigSection({ companyId }: { companyId: string }) {
  const activeCompany = useAuthStore((s) => s.getActiveCompany());
  const canManage = activeCompany && hasMinRole(activeCompany.role, "manager");

  const [types, setTypes] = useState<IncidentType[]>([]);
  const [statuses, setStatuses] = useState<IncidentStatus[]>([]);
  const [fields, setFields] = useState<IncidentField[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!canManage) return;
    try {
      const [typesData, statusesData, fieldsData] = await Promise.all([
        getIncidentTypes(companyId),
        getIncidentStatuses(companyId),
        getIncidentFields(companyId),
      ]);
      setTypes(typesData as IncidentType[]);
      setStatuses(statusesData as IncidentStatus[]);
      setFields(fieldsData as IncidentField[]);
    } catch (e) {
      logger.swallow("incident-config:load", e, "warn");
      setError("Failed to load configuration");
    } finally {
      setLoading(false);
    }
  }, [companyId, canManage]);

  useEffect(() => { void load(); }, [load]);

  const showSuccess = (msg: string) => {
    setSuccess(msg);
    setTimeout(() => setSuccess(null), 3000);
  };

  const showError = (msg: string) => {
    setError(msg);
    setTimeout(() => setError(null), 3000);
  };

  // ─── Types ─────────────────────────────────────────────────

  const handleCreateType = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const key = formData.get("key") as string;
    const label = formData.get("label") as string;
    const color = (formData.get("color") as string) || "#6366f1";
    const icon = formData.get("icon") as string | null;

    if (!key || !label) {
      showError("Key and label are required");
      return;
    }

    try {
      const id = await createIncidentType(companyId, { key, label, color, icon: icon ?? undefined });
      if (id) {
        showSuccess("Type created");
        await load();
      } else {
        showError("Failed to create type");
      }
    } catch (err) {
      logger.swallow("incident-config:create-type", err, "warn");
      showError("Failed to create type");
    }
  };

  const handleUpdateType = async (id: string, updates: Partial<{ label: string; color: string; icon: string; sortOrder: number; isActive: boolean }>) => {
    try {
      const result = await updateIncidentType(id, updates);
      if (result) {
        showSuccess("Type updated");
        await load();
      } else {
        showError("Failed to update type");
      }
    } catch (err) {
      logger.swallow("incident-config:update-type", err, "warn");
      showError("Failed to update type");
    }
  };

  const handleDeleteType = async (id: string) => {
    if (!confirm("Delete this type?")) return;
    try {
      const result = await deleteIncidentType(id);
      if (result) {
        showSuccess("Type deleted");
        await load();
      } else {
        showError("Failed to delete type");
      }
    } catch (err) {
      logger.swallow("incident-config:delete-type", err, "warn");
      showError("Failed to delete type");
    }
  };

  // ─── Statuses ──────────────────────────────────────────────

  const handleCreateStatus = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const key = formData.get("key") as string;
    const label = formData.get("label") as string;
    const color = (formData.get("color") as string) || "#6366f1";

    if (!key || !label) {
      showError("Key and label are required");
      return;
    }

    try {
      const id = await createIncidentStatus(companyId, { key, label, color });
      if (id) {
        showSuccess("Status created");
        await load();
      } else {
        showError("Failed to create status");
      }
    } catch (err) {
      logger.swallow("incident-config:create-status", err, "warn");
      showError("Failed to create status");
    }
  };

  const handleUpdateStatus = async (id: string, updates: Partial<{ label: string; color: string; sortOrder: number; isTerminal: boolean }>) => {
    try {
      const result = await updateIncidentStatus(id, updates);
      if (result) {
        showSuccess("Status updated");
        await load();
      } else {
        showError("Failed to update status");
      }
    } catch (err) {
      logger.swallow("incident-config:update-status", err, "warn");
      showError("Failed to update status");
    }
  };

  const handleDeleteStatus = async (id: string) => {
    if (!confirm("Delete this status?")) return;
    try {
      const result = await deleteIncidentStatus(id);
      if (result) {
        showSuccess("Status deleted");
        await load();
      } else {
        showError("Failed to delete status");
      }
    } catch (err) {
      logger.swallow("incident-config:delete-status", err, "warn");
      showError("Failed to delete status");
    }
  };

  // ─── Fields ────────────────────────────────────────────────

  const handleCreateField = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const incidentTypeKey = formData.get("incidentTypeKey") as string | null;
    const fieldKey = formData.get("fieldKey") as string;
    const label = formData.get("label") as string;
    const fieldType = formData.get("fieldType") as string;
    const required = formData.get("required") === "on";

    if (!fieldKey || !label || !fieldType) {
      showError("Field key, label, and type are required");
      return;
    }

    try {
      const id = await createIncidentField(companyId, {
        incidentTypeKey: incidentTypeKey || undefined,
        fieldKey,
        label,
        fieldType: fieldType as "text" | "number" | "select" | "multiselect" | "date" | "checkbox" | "textarea",
        required,
      });
      if (id) {
        showSuccess("Field created");
        await load();
      } else {
        showError("Failed to create field");
      }
    } catch (err) {
      logger.swallow("incident-config:create-field", err, "warn");
      showError("Failed to create field");
    }
  };

  const _handleUpdateField = async (id: string, updates: Partial<{ incidentTypeKey: string | null; label: string; fieldType: "text" | "number" | "select" | "multiselect" | "date" | "checkbox" | "textarea"; options: Record<string, unknown>; required: boolean; sortOrder: number; conditionalOn: Record<string, unknown> | null }>) => {
    try {
      const result = await updateIncidentField(id, updates);
      if (result) {
        showSuccess("Field updated");
        await load();
      } else {
        showError("Failed to update field");
      }
    } catch (err) {
      logger.swallow("incident-config:update-field", err, "warn");
      showError("Failed to update field");
    }
  };

  const handleDeleteField = async (id: string) => {
    if (!confirm("Delete this field?")) return;
    try {
      const result = await deleteIncidentField(id);
      if (result) {
        showSuccess("Field deleted");
        await load();
      } else {
        showError("Failed to delete field");
      }
    } catch (err) {
      logger.swallow("incident-config:delete-field", err, "warn");
      showError("Failed to delete field");
    }
  };

  if (!canManage) return null;

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Incident Configuration</CardTitle>
          <CardDescription>Loading...</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold">Incident Configuration</h2>
        <p className="text-sm text-muted-foreground">Customize incident types, statuses, and fields for your company.</p>
      </div>
      <div className="space-y-6">
        {success && (
          <div className="rounded border border-green-200 bg-green-50 p-3 text-sm text-green-800">
            <div className="flex items-center gap-2 font-medium">
              <CheckCircle2 className="h-4 w-4" />
              Success
            </div>
            <p className="mt-1">{success}</p>
          </div>
        )}
        {error && (
          <div className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-800">
            <div className="flex items-center gap-2 font-medium">
              <X className="h-4 w-4" />
              Error
            </div>
            <p className="mt-1">{error}</p>
          </div>
        )}

        {/* Incident Types */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <span className="h-5 w-5 rounded bg-indigo-100 text-indigo-600 flex items-center justify-center text-xs font-bold">T</span>
              Incident Types
            </CardTitle>
            <CardDescription>Define incident categories (e.g., Security Breach, Medical Emergency)</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleCreateType} className="mb-4 flex gap-2">
              <Input name="key" placeholder="Key (e.g., security-breach)" className="w-32" required />
              <Input name="label" placeholder="Label" className="w-48" required />
              <Input name="color" type="color" className="h-9 w-16 p-1" defaultValue="#6366f1" />
              <Input name="icon" placeholder="Icon (optional)" className="w-32" />
              <Button type="submit">
                <Plus className="h-4 w-4 mr-1" />
                Add Type
              </Button>
            </form>
            <div className="space-y-2">
              {types.map((t) => (
                <div key={t.id} className="flex items-center gap-2 rounded border p-2">
                  <div className="h-4 w-4 rounded-full" style={{ backgroundColor: t.color }} />
                  <span className="font-medium">{t.label}</span>
                  <span className="text-xs text-muted-foreground">({t.key})</span>
                  <div className="ml-auto flex gap-2">
                    <Button variant="ghost" size="sm" onClick={() => handleUpdateType(t.id, { isActive: !t.isActive })}>
                      {t.isActive ? "Disable" : "Enable"}
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => handleDeleteType(t.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Incident Statuses */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <span className="h-5 w-5 rounded bg-blue-100 text-blue-600 flex items-center justify-center text-xs font-bold">S</span>
              Incident Statuses
            </CardTitle>
            <CardDescription>Define incident lifecycle states (e.g., Active, Resolved)</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleCreateStatus} className="mb-4 flex gap-2">
              <Input name="key" placeholder="Key (e.g., active)" className="w-32" required />
              <Input name="label" placeholder="Label" className="w-48" required />
              <Input name="color" type="color" className="h-9 w-16 p-1" defaultValue="#6366f1" />
              <Button type="submit">
                <Plus className="h-4 w-4 mr-1" />
                Add Status
              </Button>
            </form>
            <div className="space-y-2">
              {statuses.map((s) => (
                <div key={s.id} className="flex items-center gap-2 rounded border p-2">
                  <div className="h-4 w-4 rounded-full" style={{ backgroundColor: s.color }} />
                  <span className="font-medium">{s.label}</span>
                  <span className="text-xs text-muted-foreground">({s.key})</span>
                  <div className="ml-auto flex gap-2">
                    <Button variant="ghost" size="sm" onClick={() => handleUpdateStatus(s.id, { isTerminal: !s.isTerminal })}>
                      {s.isTerminal ? "Mark Active" : "Mark Terminal"}
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => handleDeleteStatus(s.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Incident Fields */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <span className="h-5 w-5 rounded bg-emerald-100 text-emerald-600 flex items-center justify-center text-xs font-bold">F</span>
              Custom Fields
            </CardTitle>
            <CardDescription>Add dynamic fields to incident forms</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleCreateField} className="mb-4 flex flex-wrap gap-2">
              <select name="incidentTypeKey" className="rounded border px-2 py-1">
                <option value="">All Types</option>
                {types.map((t) => (
                  <option key={t.id} value={t.key}>{t.label}</option>
                ))}
              </select>
              <Input name="fieldKey" placeholder="Field Key (e.g., weapon_type)" className="w-48" required />
              <Input name="label" placeholder="Label" className="w-48" required />
              <select name="fieldType" className="rounded border px-2 py-1">
                <option value="text">Text</option>
                <option value="number">Number</option>
                <option value="select">Select</option>
                <option value="multiselect">Multi-select</option>
                <option value="date">Date</option>
                <option value="checkbox">Checkbox</option>
                <option value="textarea">Textarea</option>
              </select>
              <label className="flex items-center gap-1 text-sm">
                <input type="checkbox" name="required" className="rounded" />
                Required
              </label>
              <Button type="submit">
                <Plus className="h-4 w-4 mr-1" />
                Add Field
              </Button>
            </form>
            <div className="space-y-2">
              {fields.map((f) => (
                <div key={f.id} className="flex items-center gap-2 rounded border p-2">
                  <span className="font-medium">{f.label}</span>
                  <span className="text-xs text-muted-foreground">({f.fieldKey})</span>
                  <span className="text-xs text-muted-foreground">[{f.fieldType}]</span>
                  {f.incidentTypeKey && (
                    <span className="text-xs text-muted-foreground">for {f.incidentTypeKey}</span>
                  )}
                  {f.required && <span className="text-xs text-red-500 font-medium">required</span>}
                  <div className="ml-auto flex gap-2">
                    <Button variant="ghost" size="sm" onClick={() => handleDeleteField(f.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
