"use client";

/**
 * Geofences admin tab (Phase 7).
 *
 * Lists existing geofences with name, team, status. Admins can create new
 * ones by pasting GeoJSON Polygon or by entering a sequence of lat/lng
 * pairs. Edit/delete via the row actions.
 *
 * In-map polygon drawing (click-to-place vertices on Cesium) is a follow-up
 * task tracked in docs/MAP_TOOLS_ROADMAP.md.
 */

import { useCallback, useEffect, useState } from "react";
import {
  Target, Plus, Trash2, Edit2, Loader2, MapPinned, Eye, EyeOff, Save, X,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { logger } from "@/lib/logger";
import { useConfirmDialog } from "@/hooks/use-confirm-dialog";
import {
  getGeofences,
  createGeofence,
  updateGeofence,
  deleteGeofence,
  validateAndCloseGeometry,
  getTeams,
  type Geofence,
  type GeofenceGeometry,
} from "@/lib/supabase/db";
import type { Team } from "@/lib/supabase/db-teams";

interface GeofencesTabProps {
  activeCompanyId: string;
  canManage: boolean;
}

const SAMPLE_POLYGON: GeofenceGeometry = {
  type: "Polygon",
  coordinates: [
    [
      [-74.001, 40.7128],
      [-74.0, 40.7128],
      [-74.0, 40.7138],
      [-74.001, 40.7138],
      [-74.001, 40.7128],
    ],
  ],
};

export function GeofencesTab({ activeCompanyId, canManage }: GeofencesTabProps) {
  const { confirm, ConfirmDialog } = useConfirmDialog();
  const [fences, setFences] = useState<Geofence[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);

  const [showCreate, setShowCreate] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Form state (shared between create + edit).
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [teamId, setTeamId] = useState("");
  const [color, setColor] = useState("#6366f1");
  const [fillOpacity, setFillOpacity] = useState("0.20");
  const [strokeWidth, setStrokeWidth] = useState("2");
  const [isActive, setIsActive] = useState(true);
  const [geometryText, setGeometryText] = useState<string>(
    JSON.stringify(SAMPLE_POLYGON, null, 2),
  );
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [f, t] = await Promise.all([
        getGeofences(activeCompanyId),
        getTeams(activeCompanyId),
      ]);
      setFences(f);
      setTeams(t);
    } catch (e) {
      logger.swallow("geofences-tab:load", e, "warn");
      toast.error("Failed to load");
    } finally {
      setLoading(false);
    }
  }, [activeCompanyId]);

  useEffect(() => {
    void load();
  }, [load]);

  function resetForm() {
    setName("");
    setDescription("");
    setTeamId("");
    setColor("#6366f1");
    setFillOpacity("0.20");
    setStrokeWidth("2");
    setIsActive(true);
    setGeometryText(JSON.stringify(SAMPLE_POLYGON, null, 2));
    setEditingId(null);
  }

  function openCreate() {
    resetForm();
    setShowCreate(true);
  }

  function openEdit(f: Geofence) {
    setEditingId(f.id);
    setShowCreate(true);
    setName(f.name);
    setDescription(f.description ?? "");
    setTeamId(f.teamId ?? "");
    setColor(f.color);
    setFillOpacity(String(f.fillOpacity));
    setStrokeWidth(String(f.strokeWidth));
    setIsActive(f.isActive);
    setGeometryText(JSON.stringify(f.geometry, null, 2));
  }

  function parseGeometryOrToast(): GeofenceGeometry | null {
    let parsed: unknown;
    try {
      parsed = JSON.parse(geometryText);
    } catch (err) {
      toast.error(`Geometry is not valid JSON: ${err instanceof Error ? err.message : "?"}`);
      return null;
    }
    try {
      return validateAndCloseGeometry(parsed);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Invalid geometry");
      return null;
    }
  }

  async function handleSave() {
    if (!name.trim()) {
      toast.error("Name required");
      return;
    }
    const geometry = parseGeometryOrToast();
    if (!geometry) return;
    const fillOpacityNum = parseFloat(fillOpacity);
    const strokeWidthNum = parseInt(strokeWidth, 10);
    if (!Number.isFinite(fillOpacityNum) || fillOpacityNum < 0 || fillOpacityNum > 1) {
      toast.error("Fill opacity must be between 0 and 1");
      return;
    }
    if (!Number.isFinite(strokeWidthNum) || strokeWidthNum < 0 || strokeWidthNum > 20) {
      toast.error("Stroke width must be between 0 and 20");
      return;
    }
    setSaving(true);
    try {
      if (editingId) {
        await updateGeofence(editingId, {
          name: name.trim(),
          description: description.trim() || null,
          teamId: teamId || null,
          color,
          fillOpacity: fillOpacityNum,
          strokeWidth: strokeWidthNum,
          isActive,
          geometry,
        });
        toast.success("Geofence updated");
      } else {
        await createGeofence(activeCompanyId, {
          name: name.trim(),
          description: description.trim() || undefined,
          teamId: teamId || null,
          color,
          fillOpacity: fillOpacityNum,
          strokeWidth: strokeWidthNum,
          isActive,
          geometry,
        });
        toast.success("Geofence created");
      }
      setShowCreate(false);
      resetForm();
      await load();
    } catch (e) {
      logger.swallow("geofences-tab:save", e, "warn");
      toast.error(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(f: Geofence) {
    const ok = await confirm({
      description: `Delete geofence "${f.name}"?`,
      variant: "destructive",
      confirmLabel: "Delete",
    });
    if (!ok) return;
    try {
      await deleteGeofence(f.id);
      toast.success("Deleted");
      await load();
    } catch (e) {
      logger.swallow("geofences-tab:delete", e, "warn");
      toast.error("Delete failed");
    }
  }

  async function handleToggleActive(f: Geofence) {
    try {
      await updateGeofence(f.id, { isActive: !f.isActive });
      await load();
    } catch (e) {
      logger.swallow("geofences-tab:toggle", e, "warn");
      toast.error("Update failed");
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <Target className="h-4 w-4" /> Geofences
              <Badge variant="outline" className="ml-2">{fences.length}</Badge>
            </CardTitle>
            {canManage && (
              <Button size="sm" variant="outline" onClick={openCreate} className="gap-1.5">
                <Plus className="h-3.5 w-3.5" /> New geofence
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {fences.length === 0 ? (
            <p className="text-xs text-muted-foreground italic py-4 text-center">
              No geofences defined yet.
            </p>
          ) : (
            <div className="space-y-2">
              {fences.map((f) => {
                const teamName = f.teamId ? teams.find((t) => t.id === f.teamId)?.name : null;
                return (
                  <div key={f.id} className="flex items-center gap-3 rounded-md border bg-card p-3">
                    <span
                      className="inline-block h-3 w-3 rounded-sm shrink-0"
                      style={{ backgroundColor: f.color }}
                      aria-hidden="true"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-sm">{f.name}</span>
                        {!f.isActive && (
                          <Badge variant="outline" className="text-[10px] bg-muted text-muted-foreground">
                            Inactive
                          </Badge>
                        )}
                        {teamName && (
                          <Badge variant="outline" className="text-[10px]">
                            Team: {teamName}
                          </Badge>
                        )}
                      </div>
                      {f.description && (
                        <p className="text-[11px] text-muted-foreground truncate">{f.description}</p>
                      )}
                      <p className="text-[10px] text-muted-foreground font-mono">
                        {f.geometry.type} · fill {Math.round(f.fillOpacity * 100)}% · stroke {f.strokeWidth}px
                      </p>
                    </div>
                    {canManage && (
                      <div className="flex items-center gap-1 shrink-0">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 px-2"
                          onClick={() => handleToggleActive(f)}
                          title={f.isActive ? "Disable" : "Enable"}
                        >
                          {f.isActive ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 px-2"
                          onClick={() => openEdit(f)}
                          title="Edit"
                        >
                          <Edit2 className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 px-2 text-red-500"
                          onClick={() => handleDelete(f)}
                          title="Delete"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
          <p className="text-[10px] text-muted-foreground italic pt-3 flex items-center gap-1">
            <MapPinned className="h-3 w-3" />
            Geofences are visible on the tactical map when the Geofences layer (under OPERATIONS) is enabled.
          </p>
        </CardContent>
      </Card>

      {showCreate && canManage && (
        <Card className="border-primary/30">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">
                {editingId ? "Edit geofence" : "New geofence"}
              </CardTitle>
              <Button variant="ghost" size="sm" onClick={() => { setShowCreate(false); resetForm(); }}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <Label htmlFor="gf-name" className="text-xs">Name</Label>
              <Input
                id="gf-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Stadium perimeter"
              />
            </div>
            <div>
              <Label htmlFor="gf-desc" className="text-xs">Description (optional)</Label>
              <Input
                id="gf-desc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Outer fence including parking lots"
              />
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div>
                <Label htmlFor="gf-team" className="text-xs">Team</Label>
                <select
                  id="gf-team"
                  value={teamId}
                  onChange={(e) => setTeamId(e.target.value)}
                  className="w-full h-9 rounded-md border border-input bg-background px-2 text-sm"
                >
                  <option value="">No team</option>
                  {teams.map((t) => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <Label htmlFor="gf-color" className="text-xs">Color</Label>
                <Input
                  id="gf-color"
                  type="color"
                  value={color}
                  onChange={(e) => setColor(e.target.value)}
                  className="h-9 p-1"
                />
              </div>
              <div>
                <Label htmlFor="gf-fill" className="text-xs">Fill opacity (0-1)</Label>
                <Input
                  id="gf-fill"
                  type="number"
                  min="0"
                  max="1"
                  step="0.05"
                  value={fillOpacity}
                  onChange={(e) => setFillOpacity(e.target.value)}
                  className="h-9"
                />
              </div>
              <div>
                <Label htmlFor="gf-stroke" className="text-xs">Stroke width</Label>
                <Input
                  id="gf-stroke"
                  type="number"
                  min="0"
                  max="20"
                  value={strokeWidth}
                  onChange={(e) => setStrokeWidth(e.target.value)}
                  className="h-9"
                />
              </div>
            </div>
            <div>
              <Label htmlFor="gf-geometry" className="text-xs">
                Geometry (GeoJSON Polygon - [lng, lat] pairs)
              </Label>
              <textarea
                id="gf-geometry"
                value={geometryText}
                onChange={(e) => setGeometryText(e.target.value)}
                rows={10}
                className="w-full rounded-md border border-input bg-background px-2 py-1 text-xs font-mono"
              />
              <p className="text-[10px] text-muted-foreground mt-1">
                Use{" "}
                <a
                  href="https://geojson.io"
                  target="_blank"
                  rel="noreferrer"
                  className="underline text-primary"
                >
                  geojson.io
                </a>{" "}
                to draw a polygon and copy the geometry object here. Coordinates are [lng, lat] per RFC 7946.
              </p>
            </div>
            <div className="flex items-center justify-between pt-1">
              <label className="flex items-center gap-2 text-xs">
                <input
                  type="checkbox"
                  checked={isActive}
                  onChange={(e) => setIsActive(e.target.checked)}
                  className="rounded"
                />
                Active (visible on map)
              </label>
              <div className="flex justify-end gap-2">
                <Button variant="outline" size="sm" onClick={() => { setShowCreate(false); resetForm(); }}>
                  Cancel
                </Button>
                <Button size="sm" onClick={handleSave} disabled={saving} className="gap-2">
                  {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                  Save
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <ConfirmDialog />
    </div>
  );
}
