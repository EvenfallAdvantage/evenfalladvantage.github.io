"use client";

import { useState, useEffect } from "react";
import {
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Loader2,
  Flag,
  Map,
  Check,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import {
  createIncidentEnhanced,
  updateIncident,
  loadStoryboard,
  saveStoryboard,
  getEventSiteMapUrl,
  getIncidentFields,
} from "@/lib/supabase/db";
import type { StoryboardPin } from "@/components/storyboard-editor";
import { SiteMapMarkModal } from "./site-map-mark-modal";
import {
  TYPES,
  SEVERITY,
  WEATHER_OPTIONS,
  LIGHTING_OPTIONS,
  SERVICES_OPTIONS,
  EVIDENCE_OPTIONS,
  ACTIONS_OPTIONS,
  INJURY_TYPES,
  PROPERTY_DAMAGE,
} from "./constants";

interface IncidentField {
  id: string;
  companyId: string;
  incidentTypeKey: string | null;
  fieldKey: string;
  label: string;
  fieldType: "text" | "number" | "select" | "multiselect" | "date" | "checkbox" | "textarea";
  options: Record<string, unknown>;
  required: boolean;
  sortOrder: number;
  conditionalOn: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
}

interface IncidentCreateFormProps {
  activeCompanyId: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  activeTimesheet: any;
  onCreated: () => void;
  onCancel: () => void;
}

export function IncidentCreateForm({ activeCompanyId, activeTimesheet, onCreated, onCancel }: IncidentCreateFormProps) {
  // Create form — core
  const [newTitle, setNewTitle] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [newType, setNewType] = useState("general");
  const [newSeverity, setNewSeverity] = useState("low");
  const [newPriority, setNewPriority] = useState("medium");
  const [newLocation, setNewLocation] = useState("");
  const [creating, setCreating] = useState(false);

  // Create form — enhanced fields
  const [incidentDate, setIncidentDate] = useState("");
  const [incidentTime, setIncidentTime] = useState("");
  const [weather, setWeather] = useState("");
  const [lighting, setLighting] = useState("");
  const [witnesses, setWitnesses] = useState(false);
  const [witnessCount, setWitnessCount] = useState("");
  const [witnessDetails, setWitnessDetails] = useState("");
  const [injuryLevel, setInjuryLevel] = useState("None");
  const [injuryDetails, setInjuryDetails] = useState("");
  const [propertyDamage, setPropertyDamage] = useState("None");
  const [damageDetails, setDamageDetails] = useState("");
  const [servicesNotified, setServicesNotified] = useState<string[]>([]);
  const [evidenceCollected, setEvidenceCollected] = useState<string[]>([]);
  const [actionsTaken, setActionsTaken] = useState<string[]>([]);
  const [suspectDesc, setSuspectDesc] = useState("");
  const [followUp, setFollowUp] = useState(false);
  const [followUpNotes, setFollowUpNotes] = useState("");
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Custom fields
  const [customFields, setCustomFields] = useState<Record<string, unknown>>({});
  const [incidentFields, setIncidentFields] = useState<IncidentField[]>([]);
  const [loadingFields, setLoadingFields] = useState(false);

  // Storyboard — incident creation (location marking)
  const [showSiteMapModal, setShowSiteMapModal] = useState(false);
  const [incidentSiteMapUrl, setIncidentSiteMapUrl] = useState<string | null>(null);
  const [incidentStoryboardId, setIncidentStoryboardId] = useState<string | null>(null);
  const [incidentExistingPins, setIncidentExistingPins] = useState<StoryboardPin[]>([]);
  const [incidentLocationPin, setIncidentLocationPin] = useState<StoryboardPin | null>(null);
  const [siteMapLoading, setSiteMapLoading] = useState(false);

  // Load custom fields on mount
  useEffect(() => {
    const loadFields = async () => {
      setLoadingFields(true);
      try {
        const fields = await getIncidentFields(activeCompanyId);
        setIncidentFields(fields as IncidentField[]);
      } catch (e) { console.error("Failed to load incident fields:", e); }
      finally { setLoadingFields(false); }
    };
    void loadFields();
  }, [activeCompanyId]);

  function buildDescription() {
    const parts: string[] = [];
    if (newDesc.trim()) parts.push(newDesc.trim());
    if (incidentDate || incidentTime) parts.push(`\n--- When ---\nDate: ${incidentDate || "Not specified"}  Time: ${incidentTime || "Not specified"}`);
    if (weather) parts.push(`Weather: ${weather}`);
    if (lighting) parts.push(`Lighting: ${lighting}`);
    if (witnesses) parts.push(`\n--- Witnesses ---\nWitnesses Present: Yes${witnessCount ? ` (${witnessCount})` : ""}${witnessDetails ? `\nDetails: ${witnessDetails}` : ""}`);
    if (injuryLevel !== "None") parts.push(`\n--- Injuries ---\nLevel: ${injuryLevel}${injuryDetails ? `\nDetails: ${injuryDetails}` : ""}`);
    if (propertyDamage !== "None") parts.push(`\n--- Property Damage ---\nEstimate: ${propertyDamage}${damageDetails ? `\nDetails: ${damageDetails}` : ""}`);
    if (servicesNotified.length > 0) parts.push(`\n--- Services Notified ---\n${servicesNotified.join(", ")}`);
    if (actionsTaken.length > 0) parts.push(`\n--- Actions Taken ---\n${actionsTaken.join(", ")}`);
    if (evidenceCollected.length > 0) parts.push(`\n--- Evidence ---\n${evidenceCollected.join(", ")}`);
    if (suspectDesc.trim()) parts.push(`\n--- Suspect Description ---\n${suspectDesc.trim()}`);
    if (followUp) parts.push(`\n--- Follow-Up Required ---\n${followUpNotes.trim() || "Yes — details pending"}`);
    return parts.join("\n");
  }

  function handleCustomFieldChange(fieldKey: string, value: unknown) {
    setCustomFields(prev => ({ ...prev, [fieldKey]: value }));
  }

  async function handleCreate() {
    if (!newTitle.trim() || !activeCompanyId) return;
    setCreating(true);
    try {
      // If there's an incident location pin, save it to the operation's storyboard
      let savedStoryboardId: string | undefined;
      let savedPinId: string | undefined;
      if (incidentLocationPin && activeTimesheet?.event_id) {
        try {
          const allPins = [...incidentExistingPins, incidentLocationPin];
          const result = await saveStoryboard(
            activeCompanyId,
            activeTimesheet.event_id,
            allPins,
            incidentStoryboardId ?? undefined,
          );
          if (result) {
            savedStoryboardId = result.id;
            savedPinId = incidentLocationPin.id;
          }
        } catch (e) { console.error("Failed to save incident pin:", e); }
      }

      const inc = await createIncidentEnhanced(activeCompanyId, {
        title: newTitle,
        description: buildDescription(),
        type: newType,
        severity: newSeverity,
        priority: newPriority,
        location: newLocation,
        eventId: activeTimesheet?.event_id ?? undefined,
        customFields,
      });

      // Update incident with storyboard references if pin was saved
      if (inc?.id && savedStoryboardId && savedPinId) {
        try {
          await updateIncident(inc.id, {
            storyboard_id: savedStoryboardId,
            storyboard_pin_id: savedPinId,
          });
        } catch (e) { console.error("Failed to link storyboard to incident:", e); }
      }

      onCreated();
      toast.success("Incident reported");
    } catch { toast.error("Failed to create incident"); } finally { setCreating(false); }
  }

  return (
    <>
      <Card className="border-amber-500/30">
        <CardHeader><CardTitle className="text-base">New Incident Report</CardTitle></CardHeader>
        <CardContent className="space-y-5">
          {/* Operation context badge */}
          {activeTimesheet?.events?.name && (
            <div className="flex items-center gap-2 text-xs bg-green-500/5 border border-green-500/20 rounded-lg px-3 py-2">
              <Flag className="h-3.5 w-3.5 text-green-500 shrink-0" />
              <span className="text-muted-foreground">Reporting for:</span>
              <span className="font-semibold text-green-600">{activeTimesheet.events.name}</span>
            </div>
          )}
          {/* ── Section 1: Core Info ── */}
          <div className="space-y-3">
            <label htmlFor="incident-title" className="sr-only">Incident title / summary</label>
            <Input id="incident-title" placeholder="Incident title / summary *" value={newTitle} onChange={e => setNewTitle(e.target.value)} />
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div>
                <label htmlFor="incident-type" className="text-xs font-medium text-muted-foreground">Type *</label>
                <select id="incident-type" className="w-full mt-1 rounded-md border border-input bg-background px-2 py-1.5 text-sm" value={newType} onChange={e => setNewType(e.target.value)}>
                  {TYPES.map(t => <option key={t} value={t}>{t.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase())}</option>)}
                </select>
              </div>
              <div>
                <label htmlFor="incident-severity" className="text-xs font-medium text-muted-foreground">Severity</label>
                <select id="incident-severity" className="w-full mt-1 rounded-md border border-input bg-background px-2 py-1.5 text-sm" value={newSeverity} onChange={e => setNewSeverity(e.target.value)}>
                  {SEVERITY.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                </select>
              </div>
              <div>
                <label htmlFor="incident-priority" className="text-xs font-medium text-muted-foreground">Priority</label>
                <select id="incident-priority" className="w-full mt-1 rounded-md border border-input bg-background px-2 py-1.5 text-sm" value={newPriority} onChange={e => setNewPriority(e.target.value)}>
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="urgent">Urgent</option>
                </select>
              </div>
              <div>
                <label htmlFor="incident-location" className="text-xs font-medium text-muted-foreground">Location / Post</label>
                <Input id="incident-location" className="mt-1" placeholder="Building, floor, area..." value={newLocation} onChange={e => setNewLocation(e.target.value)} />
              </div>
            </div>
          </div>

          {/* ── Section 1.5: Custom Fields ── */}
          {!loadingFields && incidentFields.length > 0 && (
            <div className="space-y-3">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Additional Information</p>
              <div className="space-y-3">
                {incidentFields.map((field) => {
                  const value = customFields[field.fieldKey] ?? "";
                  const opts = Array.isArray(field.options?.choices)
                    ? (field.options.choices as Array<{ value: string; label: string }>)
                    : [];
                  return (
                    <div key={field.id} className="space-y-1">
                      <label htmlFor={`custom-${field.fieldKey}`} className="text-xs font-medium text-muted-foreground">
                        {field.label} {field.required && <span className="text-red-500">*</span>}
                      </label>
                      {field.fieldType === "textarea" ? (
                        <textarea
                          id={`custom-${field.fieldKey}`}
                          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm min-h-[60px]"
                          placeholder={field.label}
                          value={value as string}
                          onChange={e => handleCustomFieldChange(field.fieldKey, e.target.value)}
                        />
                      ) : field.fieldType === "checkbox" ? (
                        <label className="flex items-center gap-2 text-sm">
                          <input
                            type="checkbox"
                            checked={!!value}
                            onChange={e => handleCustomFieldChange(field.fieldKey, e.target.checked)}
                            className="rounded"
                          />
                          {field.label}
                        </label>
                      ) : field.fieldType === "select" || field.fieldType === "multiselect" ? (
                        <select
                          id={`custom-${field.fieldKey}`}
                          className="w-full mt-1 rounded-md border border-input bg-background px-2 py-1.5 text-sm"
                          value={value as string}
                          onChange={e => handleCustomFieldChange(field.fieldKey, e.target.value)}
                        >
                          <option value="">Select...</option>
                          {opts.map((opt) => (
                            <option key={opt.value} value={opt.value}>{opt.label}</option>
                          ))}
                        </select>
                      ) : field.fieldType === "date" ? (
                        <Input
                          id={`custom-${field.fieldKey}`}
                          type="date"
                          className="mt-1"
                          value={value as string}
                          onChange={e => handleCustomFieldChange(field.fieldKey, e.target.value)}
                        />
                      ) : (
                        <Input
                          id={`custom-${field.fieldKey}`}
                          className="mt-1"
                          placeholder={field.label}
                          value={value as string}
                          onChange={e => handleCustomFieldChange(field.fieldKey, e.target.value)}
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── Section 2: When & Conditions ── */}
          <div className="space-y-3">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">When &amp; Conditions</p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div>
                <label htmlFor="incident-date" className="text-xs font-medium text-muted-foreground">Date of Incident</label>
                <Input id="incident-date" type="date" className="mt-1" value={incidentDate} onChange={e => setIncidentDate(e.target.value)} />
              </div>
              <div>
                <label htmlFor="incident-time" className="text-xs font-medium text-muted-foreground">Time of Incident</label>
                <Input id="incident-time" type="time" className="mt-1" value={incidentTime} onChange={e => setIncidentTime(e.target.value)} />
              </div>
              <div>
                <label htmlFor="incident-weather" className="text-xs font-medium text-muted-foreground">Weather</label>
                <select id="incident-weather" className="w-full mt-1 rounded-md border border-input bg-background px-2 py-1.5 text-sm" value={weather} onChange={e => setWeather(e.target.value)}>
                  <option value="">Select...</option>
                  {WEATHER_OPTIONS.map(w => <option key={w} value={w}>{w}</option>)}
                </select>
              </div>
              <div>
                <label htmlFor="incident-lighting" className="text-xs font-medium text-muted-foreground">Lighting</label>
                <select id="incident-lighting" className="w-full mt-1 rounded-md border border-input bg-background px-2 py-1.5 text-sm" value={lighting} onChange={e => setLighting(e.target.value)}>
                  <option value="">Select...</option>
                  {LIGHTING_OPTIONS.map(l => <option key={l} value={l}>{l}</option>)}
                </select>
              </div>
            </div>
          </div>

          {/* ── Section 3: Narrative ── */}
          <div className="space-y-2">
            <label htmlFor="incident-narrative" className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Narrative</label>
            <textarea
              id="incident-narrative"
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm min-h-[100px]"
              placeholder="Describe what happened in detail — who, what, when, where, how. Be factual and objective."
              value={newDesc}
              onChange={e => setNewDesc(e.target.value)}
            />
          </div>

          {/* ── Section 4: Involved Parties (collapsible) ── */}
          <button
            type="button"
            className="flex items-center gap-2 text-xs font-semibold text-primary hover:underline"
            onClick={() => setShowAdvanced(!showAdvanced)}
          >
            {showAdvanced ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            {showAdvanced ? "Hide" : "Show"} Additional Details (injuries, evidence, follow-up...)
          </button>

          {showAdvanced && (
            <div className="space-y-5 rounded-lg border border-border/50 bg-muted/20 p-4">
              {/* Witnesses */}
              <div className="space-y-2">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Witnesses</p>
                <div className="flex items-center gap-4">
                  <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={witnesses} onChange={e => setWitnesses(e.target.checked)} className="rounded" />
                    Witnesses present
                  </label>
                  {witnesses && (
                    <Input className="w-20" type="number" min="1" placeholder="#" value={witnessCount} onChange={e => setWitnessCount(e.target.value)} />
                  )}
                </div>
                {witnesses && (
                  <Input placeholder="Witness names / contact info (if available)" value={witnessDetails} onChange={e => setWitnessDetails(e.target.value)} />
                )}
              </div>

              {/* Injuries & Property Damage */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label htmlFor="incident-injury-level" className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block">Injuries</label>
                  <select id="incident-injury-level" className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm" value={injuryLevel} onChange={e => setInjuryLevel(e.target.value)}>
                    {INJURY_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                  {injuryLevel !== "None" && (
                    <Input placeholder="Describe injuries, persons affected..." value={injuryDetails} onChange={e => setInjuryDetails(e.target.value)} />
                  )}
                </div>
                <div className="space-y-2">
                  <label htmlFor="incident-property-damage" className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block">Property Damage</label>
                  <select id="incident-property-damage" className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm" value={propertyDamage} onChange={e => setPropertyDamage(e.target.value)}>
                    {PROPERTY_DAMAGE.map(d => <option key={d} value={d}>{d}</option>)}
                  </select>
                  {propertyDamage !== "None" && (
                    <Input placeholder="Describe damage..." value={damageDetails} onChange={e => setDamageDetails(e.target.value)} />
                  )}
                </div>
              </div>

              {/* Services Notified */}
              <div className="space-y-2">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Services Notified</p>
                <div className="flex flex-wrap gap-2">
                  {SERVICES_OPTIONS.map(s => (
                    <label key={s} className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium border cursor-pointer transition-all ${
                      servicesNotified.includes(s) ? "border-blue-500 bg-blue-500/15 text-blue-700" : "border-border hover:border-primary/30"
                    }`}>
                      <input type="checkbox" className="sr-only" checked={servicesNotified.includes(s)}
                        onChange={e => setServicesNotified(prev => e.target.checked ? [...prev, s] : prev.filter(x => x !== s))} />
                      {s}
                    </label>
                  ))}
                </div>
              </div>

              {/* Actions Taken */}
              <div className="space-y-2">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Actions Taken</p>
                <div className="flex flex-wrap gap-2">
                  {ACTIONS_OPTIONS.map(a => (
                    <label key={a} className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium border cursor-pointer transition-all ${
                      actionsTaken.includes(a) ? "border-emerald-500 bg-emerald-500/15 text-emerald-700" : "border-border hover:border-primary/30"
                    }`}>
                      <input type="checkbox" className="sr-only" checked={actionsTaken.includes(a)}
                        onChange={e => setActionsTaken(prev => e.target.checked ? [...prev, a] : prev.filter(x => x !== a))} />
                      {a}
                    </label>
                  ))}
                </div>
              </div>

              {/* Evidence */}
              <div className="space-y-2">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Evidence Collected</p>
                <div className="flex flex-wrap gap-2">
                  {EVIDENCE_OPTIONS.map(e => (
                    <label key={e} className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium border cursor-pointer transition-all ${
                      evidenceCollected.includes(e) ? "border-violet-500 bg-violet-500/15 text-violet-700" : "border-border hover:border-primary/30"
                    }`}>
                      <input type="checkbox" className="sr-only" checked={evidenceCollected.includes(e)}
                        onChange={ev => setEvidenceCollected(prev => ev.target.checked ? [...prev, e] : prev.filter(x => x !== e))} />
                      {e}
                    </label>
                  ))}
                </div>
              </div>

              {/* Suspect Description */}
              <div className="space-y-2">
                <label htmlFor="incident-suspect-description" className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block">Suspect / Person of Interest</label>
                <textarea
                  id="incident-suspect-description"
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm min-h-[60px]"
                  placeholder="Physical description, clothing, direction of travel, vehicle info... (leave blank if N/A)"
                  value={suspectDesc}
                  onChange={e => setSuspectDesc(e.target.value)}
                />
              </div>

              {/* Follow-up */}
              <div className="space-y-2">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Follow-Up</p>
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={followUp} onChange={e => setFollowUp(e.target.checked)} className="rounded" />
                  Follow-up action required
                </label>
                {followUp && (
                  <Input placeholder="Describe required follow-up actions..." value={followUpNotes} onChange={e => setFollowUpNotes(e.target.value)} />
                )}
              </div>

              {/* Location on Site Map */}
              <div className="space-y-2">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Location on Site Map</p>
                {activeTimesheet?.event_id ? (
                  <>
                    {incidentLocationPin ? (
                      <div className="flex items-center gap-2">
                        <span className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium bg-green-500/15 text-green-700 border border-green-500/30">
                          <Check className="h-3 w-3" /> Location marked
                        </span>
                        <Button size="sm" variant="ghost" className="h-7 text-xs text-muted-foreground" onClick={() => setIncidentLocationPin(null)}>
                          Clear
                        </Button>
                        <Button size="sm" variant="outline" className="h-7 text-xs gap-1.5" onClick={async () => {
                          setSiteMapLoading(true);
                          try {
                            if (!incidentSiteMapUrl) {
                              const url = await getEventSiteMapUrl(activeTimesheet.event_id);
                              setIncidentSiteMapUrl(url);
                              if (!url) return;
                            }
                            setShowSiteMapModal(true);
                          } catch { /* */ }
                          finally { setSiteMapLoading(false); }
                        }}>
                          <Map className="h-3 w-3" /> Re-mark
                        </Button>
                      </div>
                    ) : (
                      <Button size="sm" variant="outline" className="gap-1.5 text-xs" onClick={async () => {
                        setSiteMapLoading(true);
                        try {
                          const url = await getEventSiteMapUrl(activeTimesheet.event_id);
                          setIncidentSiteMapUrl(url);
                          if (!url) {
                            toast.error("No site map available for this operation");
                            return;
                          }
                          // Load existing storyboard pins
                          const sb = await loadStoryboard(activeTimesheet.event_id);
                          if (sb) {
                            setIncidentStoryboardId(sb.id);
                            setIncidentExistingPins((sb.pins as StoryboardPin[]) ?? []);
                          }
                          setShowSiteMapModal(true);
                        } catch { toast.error("Failed to load site map"); }
                        finally { setSiteMapLoading(false); }
                      }} disabled={siteMapLoading}>
                        {siteMapLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Map className="h-3 w-3" />}
                        Mark on Site Map
                      </Button>
                    )}
                  </>
                ) : (
                  <p className="text-xs text-muted-foreground/60 italic">(No site map available for the current operation)</p>
                )}
              </div>
            </div>
          )}

          <div className="flex gap-2">
            <Button onClick={handleCreate} disabled={creating || !newTitle.trim()} className="gap-2">
              {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <AlertTriangle className="h-4 w-4" />}
              Submit Report
            </Button>
            <Button variant="outline" onClick={onCancel}>Cancel</Button>
          </div>
        </CardContent>
      </Card>

      {/* Site Map Modal for marking location */}
      {showSiteMapModal && incidentSiteMapUrl && (
        <SiteMapMarkModal
          siteMapUrl={incidentSiteMapUrl}
          existingPins={incidentExistingPins}
          locationPin={incidentLocationPin}
          title={newTitle}
          description={newDesc}
          onPinChange={setIncidentLocationPin}
          onClose={() => setShowSiteMapModal(false)}
        />
      )}
    </>
  );
}
