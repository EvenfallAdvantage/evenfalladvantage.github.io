"use client";

import { useState, useEffect } from "react";
import {
  Flag, MapPin, Loader2, X, FileText,
  Check, Shield, Shirt, AlertTriangle, Building2, DollarSign,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PhoneInput } from "@/components/ui/phone-input";
import { Label } from "@/components/ui/label";
import {
  createEvent, createDocument,
} from "@/lib/supabase/db";
import { issueDocument } from "@/lib/supabase/db-documents";
import { linkAssessmentToEvent, type SiteAssessment } from "@/lib/supabase/db-assessments";
import { createClient } from "@/lib/supabase/client";
import type { IntakeData } from "@/types/operations";
import AddressAutocomplete from "@/components/address-autocomplete";
import type { AddressSelection } from "@/components/address-autocomplete";
import {
  type OpsGuide, EMPTY_GUIDE, SITE_TYPES, DRESS_CODES,
  ENGAGEMENT_TYPES, VENUE_TYPES, THREAT_TYPES, SERVICES_REQUESTED,
  CONSTRAINT_TYPES, MEDICAL_CAPABILITIES, COMMAND_MODELS, COMPANY_ROLES,
  SUCCESS_CRITERIA_OPTIONS, Textarea,
} from "./shared";

interface CreateWizardProps {
  activeCompanyId: string;
  companyName: string;
  initialAssessment?: SiteAssessment | null;
  onCreated: () => Promise<void>;
  onCancel: () => void;
}

const FACILITY_TO_SITE_TYPE: Record<string, string> = {
  "School": "Education",
  "Office Building": "Corporate",
  "Venue/Event Space": "Event/Festival",
  "Religious Facility": "Other",
  "Healthcare": "Healthcare",
  "Retail": "Retail",
  "Single-family Home": "Residential",
  "Multi-family Complex": "Residential",
  "Other": "Other",
};

const CREATE_STEPS = ["Basics", "Client & Site", "Scope & Orders", "Uniform & Comms", "Emergency & C2"];

export function CreateWizard({ activeCompanyId, companyName, initialAssessment, onCreated, onCancel }: CreateWizardProps) {
  const [createStep, setCreateStep] = useState(0);
  const [name, setName] = useState("");
  const [location, setLocation] = useState("");
  const [locationLat, setLocationLat] = useState<number | null>(null);
  const [locationLng, setLocationLng] = useState<number | null>(null);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [guide, setGuide] = useState<OpsGuide>({ ...EMPTY_GUIDE });
  const [creating, setCreating] = useState(false);

  // Site map upload (wizard step 1)
  const [siteMapFile, setSiteMapFile] = useState<File | null>(null);
  const [siteMapPreview, setSiteMapPreview] = useState<string | null>(null);

  // Pay rate
  const [payRate, setPayRate] = useState("");

  // SOP intake fields
  const [intakeEngagement, setIntakeEngagement] = useState<string[]>([]);
  const [intakeMission, setIntakeMission] = useState("");
  const [intakeTimeSensitivity, setIntakeTimeSensitivity] = useState("Medium");
  const [intakeVenueType, setIntakeVenueType] = useState<string[]>([]);
  const [intakeAttendance, setIntakeAttendance] = useState("");
  const [intakeEnvironment, setIntakeEnvironment] = useState("");
  const [intakeEnvNotes, setIntakeEnvNotes] = useState("");
  const [intakeClientRequest, setIntakeClientRequest] = useState("");
  const [intakeServices, setIntakeServices] = useState<string[]>([]);
  const [intakeDeliverables, setIntakeDeliverables] = useState("");
  const [intakeOutOfScope, setIntakeOutOfScope] = useState("");
  const [intakeMedical, setIntakeMedical] = useState("");
  const [intakeEquipment, setIntakeEquipment] = useState("");
  const [intakeRadioChannels, setIntakeRadioChannels] = useState("");
  const [intakeRiskLevel, setIntakeRiskLevel] = useState("");
  const [intakeThreats, setIntakeThreats] = useState<string[]>([]);
  const [intakeClientRisks, setIntakeClientRisks] = useState("");
  const [intakeConstraints, setIntakeConstraints] = useState<string[]>([]);
  const [intakeCommandModel, setIntakeCommandModel] = useState("");
  const [intakeEaRole, setIntakeEaRole] = useState<string[]>([]);
  const [intakeEscalation, setIntakeEscalation] = useState("");
  const [intakeSuccessCriteria, setIntakeSuccessCriteria] = useState<string[]>([]);
  const [intakeSuccessNotes, _setIntakeSuccessNotes] = useState("");

  function updateGuide(field: keyof OpsGuide, value: string) {
    setGuide(prev => ({ ...prev, [field]: value }));
  }

  function toggleArr(arr: string[], set: (v: string[]) => void, val: string) {
    set(arr.includes(val) ? arr.filter(v => v !== val) : [...arr, val]);
  }

  // Pre-fill from linked assessment
  useEffect(() => {
    if (!initialAssessment) return;
    const d = (initialAssessment.data || {}) as Record<string, string>;
    setName(`${initialAssessment.client_name || "Site"} Security Op`);
    setLocation(initialAssessment.address || "");
    setLocationLat(initialAssessment.lat || null);
    setLocationLng(initialAssessment.lng || null);
    setGuide(prev => ({
      ...prev,
      clientName: initialAssessment.client_name || "",
      siteAddress: initialAssessment.address || "",
      siteType: FACILITY_TO_SITE_TYPE[d.facilityType || ""] || "Other",
    }));
    if (initialAssessment.risk_level) {
      setIntakeRiskLevel(initialAssessment.risk_level);
    }
  }, [initialAssessment]);

  async function handleCreate() {
    if (!name.trim() || !startDate || !endDate || !activeCompanyId || activeCompanyId === "pending") return;
    setCreating(true);
    try {
      const eventId = crypto.randomUUID();

      // Upload site map if provided
      let siteMapUrl: string | undefined;
      if (siteMapFile) {
        const supabase = createClient();
        const filePath = `${activeCompanyId}/${eventId}/${siteMapFile.name}`;
        const { error: uploadErr } = await supabase.storage
          .from("operation-maps")
          .upload(filePath, siteMapFile, { upsert: true });
        if (!uploadErr) {
          const { data: urlData } = supabase.storage
            .from("operation-maps")
            .getPublicUrl(filePath);
          siteMapUrl = urlData?.publicUrl;
        } else {
          console.error("Site map upload failed:", uploadErr);
        }
      }

      const ev = await createEvent({
        id: eventId,
        companyId: activeCompanyId,
        name: name.trim(),
        location: location || guide.siteAddress || undefined,
        locationLat: locationLat ?? undefined,
        locationLng: locationLng ?? undefined,
        startDate, endDate,
        opsGuide: guide,
        engagementType: intakeEngagement.join(", ") || undefined,
        venueType: intakeVenueType.join(", ") || undefined,
        estimatedAttendance: intakeAttendance || undefined,
        riskLevel: intakeRiskLevel || undefined,
        tlpStep: "receive_mission",
        siteMapUrl,
        payRate: payRate.trim() ? parseFloat(payRate) : null,
      });
      // Create intake document for SOP tracking
      if (ev?.id) {
        const intakeData: IntakeData = {
          engagementType: intakeEngagement, clientRequest: intakeClientRequest,
          missionStatement: intakeMission, timeSensitivity: intakeTimeSensitivity,
          venueType: intakeVenueType, estimatedAttendance: intakeAttendance,
          environment: intakeEnvironment, environmentNotes: intakeEnvNotes,
          servicesRequested: intakeServices, deliverables: intakeDeliverables, outOfScope: intakeOutOfScope,
          clientPersonnelCount: "", clientLeadershipStructure: "", clientExistingSops: false,
          clientIncidentReporting: "", clientTrainingLevel: "", equipmentAvailable: intakeEquipment,
          medicalCapability: intakeMedical, technologyAvailable: "",
          clientIdentifiedRisks: intakeClientRisks, eaRiskAssessment: "", riskLevel: intakeRiskLevel,
          threatTypes: intakeThreats, constraints: intakeConstraints,
          commandModel: intakeCommandModel, onSiteAuthority: "", eaRole: intakeEaRole,
          escalationFlow: intakeEscalation, chainOfCommand: "",
          successCriteria: intakeSuccessCriteria, additionalSuccessMeasures: intakeSuccessNotes,
        };
        try {
          const intakeDoc = await createDocument({
            eventId: ev.id, companyId: activeCompanyId, docType: "intake",
            data: intakeData as unknown as Record<string, unknown>,
          });
          if (intakeDoc?.id) {
            await issueDocument(intakeDoc.id);
          }
        } catch (docErr) { console.error("Intake doc creation failed:", docErr); }
      }
      // Link assessment to the newly created event
      if (initialAssessment?.id && ev?.id) {
        try {
          await linkAssessmentToEvent(initialAssessment.id, ev.id);
        } catch (linkErr) { console.error("Assessment linking failed:", linkErr); }
      }
      await onCreated();
    } catch (err) { console.error(err); } finally { setCreating(false); }
  }

  return (
    <div className="rounded-xl border border-primary/30 bg-card overflow-hidden">
      {/* Step indicator */}
      <div className="flex border-b border-border/30 bg-muted/30 overflow-x-auto">
        {CREATE_STEPS.map((step, i) => (
          <button key={step} onClick={() => { if (i === 0 || name.trim()) setCreateStep(i); }}
            className={`flex-1 shrink-0 whitespace-nowrap px-3 py-2.5 text-[10px] font-medium uppercase tracking-wider transition-colors border-b-2 ${
              createStep === i ? "border-primary text-primary bg-primary/5" : i < createStep ? "border-green-500/50 text-green-600" : "border-transparent text-muted-foreground"
            }`}>
            {i < createStep ? <Check className="h-3 w-3 inline mr-1" /> : null}{step}
          </button>
        ))}
      </div>

      <div className="p-4 space-y-3">
        {/* Step 0: Basics */}
        {createStep === 0 && (
          <>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="sm:col-span-2"><Label className="text-xs">Operation Name *</Label><Input placeholder="e.g. Spring Festival Security" value={name} onChange={(e) => setName(e.target.value)} className="mt-1" /></div>
              <div className="sm:col-span-2"><Label className="text-xs">Location</Label><AddressAutocomplete value={location} onChange={setLocation} onSelect={(s: AddressSelection) => { setLocation(s.displayName); setLocationLat(s.lat); setLocationLng(s.lon); if (s.street && !guide.siteAddress) setGuide(g => ({ ...g, siteAddress: `${s.street}, ${s.city}, ${s.state} ${s.postcode}`.trim() })); }} onClear={() => { setLocationLat(null); setLocationLng(null); }} placeholder="e.g. 123 Main St, Los Angeles, CA" className="mt-1" /></div>
              <div><Label className="text-xs">Start Date & Time *</Label><Input type="datetime-local" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="mt-1" /></div>
              <div><Label className="text-xs">End Date & Time *</Label><Input type="datetime-local" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="mt-1" /></div>
            </div>
            <div className="pt-2 border-t border-border/20">
              <Label className="text-xs">Type of Engagement</Label>
              <div className="flex flex-wrap gap-1.5 mt-1">
                {ENGAGEMENT_TYPES.map(t => (
                  <button key={t} type="button" onClick={() => toggleArr(intakeEngagement, setIntakeEngagement, t)}
                    className={`px-2 py-1 rounded-md text-[10px] font-medium border transition-colors ${intakeEngagement.includes(t) ? "border-primary bg-primary/10 text-primary" : "border-border/40 text-muted-foreground hover:border-border"}`}>
                    {intakeEngagement.includes(t) && <Check className="h-2.5 w-2.5 inline mr-0.5" />}{t}
                  </button>
                ))}
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <div>
                <Label className="text-xs">Time Sensitivity</Label>
                <select value={intakeTimeSensitivity} onChange={(e) => setIntakeTimeSensitivity(e.target.value)} className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm">
                  {["Low", "Medium", "High", "Immediate"].map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <Label className="text-xs flex items-center gap-1"><DollarSign className="h-3 w-3 text-green-500" /> Pay Rate ($/hr)</Label>
                <Input type="number" step="0.01" min="0" placeholder="e.g. 25.00" value={payRate} onChange={(e) => setPayRate(e.target.value)} className="mt-1" />
              </div>
              <div>
                <Label className="text-xs">Mission Statement</Label>
                <Input placeholder={`${companyName || "Company"} will [do what] for [client] at [location] in order to [purpose]`} value={intakeMission} onChange={(e) => setIntakeMission(e.target.value)} className="mt-1" />
              </div>
            </div>
          </>
        )}

        {/* Step 1: Client & Site */}
        {createStep === 1 && (
          <>
            <p className="text-xs text-muted-foreground flex items-center gap-1.5"><Building2 className="h-3.5 w-3.5" /> Client & site details appear on the OPs Guide shared with your team.</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <div><Label className="text-xs">Client Name</Label><Input placeholder="e.g. Acme Corp" value={guide.clientName} onChange={(e) => updateGuide("clientName", e.target.value)} className="mt-1" /></div>
              <div><Label className="text-xs">Client Contact Person</Label><Input placeholder="e.g. Jane Smith" value={guide.clientContact} onChange={(e) => updateGuide("clientContact", e.target.value)} className="mt-1" /></div>
              <div><Label className="text-xs">Client Phone</Label><PhoneInput value={guide.clientPhone} onChange={(v) => updateGuide("clientPhone", v)} className="mt-1" /></div>
              <div><Label className="text-xs">Client Email</Label><Input placeholder="jane@acme.com" type="email" value={guide.clientEmail} onChange={(e) => updateGuide("clientEmail", e.target.value)} className="mt-1" /></div>
              <div className="sm:col-span-2"><Label className="text-xs">Site Address</Label><AddressAutocomplete value={guide.siteAddress} onChange={(v) => updateGuide("siteAddress", v)} onSelect={(s: AddressSelection) => { updateGuide("siteAddress", `${s.street}, ${s.city}, ${s.state} ${s.postcode}`.trim()); if (!locationLat) { setLocationLat(s.lat); setLocationLng(s.lon); } }} placeholder="Full site address if different from operation location" className="mt-1" /></div>
              <div><Label className="text-xs">Site Type</Label>
                <select value={guide.siteType} onChange={(e) => updateGuide("siteType", e.target.value)} className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm">
                  <option value="">Select...</option>
                  {SITE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div><Label className="text-xs">Parking Info</Label><Input placeholder="e.g. Lot B, permit required" value={guide.parkingInfo} onChange={(e) => updateGuide("parkingInfo", e.target.value)} className="mt-1" /></div>
              <div className="sm:col-span-2"><Label className="text-xs">Check-In Procedure</Label><Input placeholder="e.g. Report to lobby, sign in at front desk" value={guide.checkInProcedure} onChange={(e) => updateGuide("checkInProcedure", e.target.value)} className="mt-1" /></div>
            </div>
            <div className="pt-2 border-t border-border/20 space-y-3">
              <div>
                <Label className="text-xs">Venue Type</Label>
                <div className="flex flex-wrap gap-1.5 mt-1">
                  {VENUE_TYPES.map(t => (
                    <button key={t} type="button" onClick={() => toggleArr(intakeVenueType, setIntakeVenueType, t)}
                      className={`px-2 py-1 rounded-md text-[10px] font-medium border transition-colors ${intakeVenueType.includes(t) ? "border-primary bg-primary/10 text-primary" : "border-border/40 text-muted-foreground hover:border-border"}`}>
                      {intakeVenueType.includes(t) && <Check className="h-2.5 w-2.5 inline mr-0.5" />}{t}
                    </button>
                  ))}
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                <div><Label className="text-xs">Estimated Attendance</Label><Input placeholder="e.g. 500" value={intakeAttendance} onChange={(e) => setIntakeAttendance(e.target.value)} className="mt-1" /></div>
                <div><Label className="text-xs">Environment</Label>
                  <select value={intakeEnvironment} onChange={(e) => setIntakeEnvironment(e.target.value)} className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm">
                    <option value="">Select...</option>
                    <option value="Indoor">Indoor</option>
                    <option value="Outdoor">Outdoor</option>
                    <option value="Hybrid">Hybrid</option>
                  </select>
                </div>
                <div className="sm:col-span-1"><Label className="text-xs">Environment Notes</Label><Input placeholder="e.g. Urban, multi-level" value={intakeEnvNotes} onChange={(e) => setIntakeEnvNotes(e.target.value)} className="mt-1" /></div>
              </div>
            </div>
            {/* Site Map Upload */}
            <div className="pt-2 border-t border-border/20 space-y-2">
              <Label className="text-xs">Site Map / Floor Plan <span className="text-muted-foreground font-normal">(optional)</span></Label>
              {siteMapPreview ? (
                <div className="relative rounded-lg border border-border/40 bg-muted/20 p-3">
                  <div className="flex items-center gap-3">
                    {siteMapFile?.type === "application/pdf" ? (
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <FileText className="h-8 w-8" />
                        <span className="text-sm font-medium truncate">{siteMapFile.name}</span>
                      </div>
                    ) : (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={siteMapPreview} alt="Site map preview" className="max-h-32 rounded-md border border-border/30 object-contain" />
                    )}
                    <Button size="sm" variant="ghost" className="text-red-500 hover:text-red-600 ml-auto" onClick={() => { setSiteMapFile(null); setSiteMapPreview(null); }}>
                      <X className="h-3.5 w-3.5 mr-1" /> Remove
                    </Button>
                  </div>
                </div>
              ) : (
                <label className="flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-border/50 bg-muted/10 p-6 cursor-pointer hover:border-primary/40 hover:bg-primary/5 transition-colors">
                  <MapPin className="h-6 w-6 text-muted-foreground/50" />
                  <span className="text-xs text-muted-foreground">Drop or click to upload a site map</span>
                  <span className="text-[10px] text-muted-foreground/60">Supported: JPEG, PNG, SVG, PDF</span>
                  <input
                    type="file"
                    accept="image/*,application/pdf"
                    className="sr-only"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      setSiteMapFile(file);
                      if (file.type === "application/pdf") {
                        setSiteMapPreview("pdf");
                      } else {
                        const url = URL.createObjectURL(file);
                        setSiteMapPreview(url);
                      }
                    }}
                  />
                </label>
              )}
            </div>
          </>
        )}

        {/* Step 2: Scope & Post Orders */}
        {createStep === 2 && (
          <>
            <p className="text-xs text-muted-foreground flex items-center gap-1.5"><Shield className="h-3.5 w-3.5" /> Define what your team is responsible for at this operation.</p>
            <div>
              <Label className="text-xs">Services Requested</Label>
              <div className="flex flex-wrap gap-1.5 mt-1">
                {SERVICES_REQUESTED.map(t => (
                  <button key={t} type="button" onClick={() => toggleArr(intakeServices, setIntakeServices, t)}
                    className={`px-2 py-1 rounded-md text-[10px] font-medium border transition-colors ${intakeServices.includes(t) ? "border-primary bg-primary/10 text-primary" : "border-border/40 text-muted-foreground hover:border-border"}`}>
                    {intakeServices.includes(t) && <Check className="h-2.5 w-2.5 inline mr-0.5" />}{t}
                  </button>
                ))}
              </div>
            </div>
            <div><Label className="text-xs">Client Request (in their words)</Label><Textarea value={intakeClientRequest} onChange={(v) => setIntakeClientRequest(v)} placeholder="What the client asked for verbatim — helps align expectations" rows={2} /></div>
            <div><Label className="text-xs">Scope of Work</Label><Textarea value={guide.scope} onChange={(v) => updateGuide("scope", v)} placeholder="Describe the overall scope: access control, patrol routes, crowd management, etc." rows={3} /></div>
            <div><Label className="text-xs">Post Orders / Standing Instructions</Label><Textarea value={guide.postOrders} onChange={(v) => updateGuide("postOrders", v)} placeholder="Detailed instructions for each post position, duties, and responsibilities" rows={3} /></div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div><Label className="text-xs">Deliverables</Label><Textarea value={intakeDeliverables} onChange={(v) => setIntakeDeliverables(v)} placeholder="e.g. Security plan, post-event report, incident logs" rows={2} /></div>
              <div><Label className="text-xs">Out of Scope</Label><Textarea value={intakeOutOfScope} onChange={(v) => setIntakeOutOfScope(v)} placeholder={`What ${companyName || "the company"} is NOT responsible for`} rows={2} /></div>
            </div>
          </>
        )}

        {/* Step 3: Uniform & Comms */}
        {createStep === 3 && (
          <>
            <p className="text-xs text-muted-foreground flex items-center gap-1.5"><Shirt className="h-3.5 w-3.5" /> Dress code, equipment, and communication details.</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <div><Label className="text-xs">Dress Code</Label>
                <select value={guide.dressCode} onChange={(e) => updateGuide("dressCode", e.target.value)} className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm">
                  <option value="">Select...</option>
                  {DRESS_CODES.map(d => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>
              <div><Label className="text-xs">Required Gear</Label><Input placeholder="e.g. Flashlight, radio, body cam" value={guide.requiredGear} onChange={(e) => updateGuide("requiredGear", e.target.value)} className="mt-1" /></div>
              <div><Label className="text-xs">Communication Channel</Label><Input placeholder="e.g. WhatsApp Ops Chat, Radio Ch. 5" value={guide.communicationChannel} onChange={(e) => updateGuide("communicationChannel", e.target.value)} className="mt-1" /></div>
              <div><Label className="text-xs">Radio Channels / Plan</Label><Input placeholder="e.g. Ch 1: Command, Ch 2: Security, Ch 3: Medical" value={intakeRadioChannels} onChange={(e) => setIntakeRadioChannels(e.target.value)} className="mt-1" /></div>
              <div className="sm:col-span-2"><Label className="text-xs">Reporting Instructions</Label><Textarea value={guide.reportingInstructions} onChange={(v) => updateGuide("reportingInstructions", v)} placeholder="How and when to submit reports (e.g. Overwatch incident form, end-of-shift DAR)" rows={2} /></div>
            </div>
            <div className="pt-2 border-t border-border/20 grid gap-3 sm:grid-cols-2">
              <div><Label className="text-xs">Medical Capability</Label>
                <select value={intakeMedical} onChange={(e) => setIntakeMedical(e.target.value)} className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm">
                  <option value="">Select...</option>
                  {MEDICAL_CAPABILITIES.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>
              <div><Label className="text-xs">Additional Equipment</Label><Input placeholder="e.g. Barriers, lighting, PPE, first aid kits" value={intakeEquipment} onChange={(e) => setIntakeEquipment(e.target.value)} className="mt-1" /></div>
            </div>
          </>
        )}

        {/* Step 4: Emergency, Risk & C2 */}
        {createStep === 4 && (
          <>
            <p className="text-xs text-muted-foreground flex items-center gap-1.5"><AlertTriangle className="h-3.5 w-3.5" /> Emergency, risk assessment, command structure, and success criteria.</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <div><Label className="text-xs">Emergency Contact Name</Label><Input placeholder="e.g. Operations Manager" value={guide.emergencyContact} onChange={(e) => updateGuide("emergencyContact", e.target.value)} className="mt-1" /></div>
              <div><Label className="text-xs">Emergency Phone</Label><PhoneInput value={guide.emergencyPhone} onChange={(v) => updateGuide("emergencyPhone", v)} className="mt-1" /></div>
              <div className="sm:col-span-2"><Label className="text-xs">Emergency Procedure</Label><Textarea value={guide.emergencyProcedure} onChange={(v) => updateGuide("emergencyProcedure", v)} placeholder="Evacuation routes, rally points, chain of command" rows={2} /></div>
            </div>
            {/* Risk Assessment */}
            <div className="pt-2 border-t border-border/20 space-y-3">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Risk Assessment</p>
              <div className="grid gap-3 sm:grid-cols-2">
                <div><Label className="text-xs">Risk Level</Label>
                  <select value={intakeRiskLevel} onChange={(e) => setIntakeRiskLevel(e.target.value)} className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm">
                    <option value="">Select...</option>
                    {["Low", "Moderate", "High", "Critical"].map(r => <option key={r} value={r}>{r}</option>)}
                  </select>
                </div>
                <div><Label className="text-xs">Client-Identified Risks</Label><Input placeholder="e.g. Previous incidents, known bad actors" value={intakeClientRisks} onChange={(e) => setIntakeClientRisks(e.target.value)} className="mt-1" /></div>
              </div>
              <div>
                <Label className="text-xs">Threat Types</Label>
                <div className="flex flex-wrap gap-1.5 mt-1">
                  {THREAT_TYPES.map(t => (
                    <button key={t} type="button" onClick={() => toggleArr(intakeThreats, setIntakeThreats, t)}
                      className={`px-2 py-1 rounded-md text-[10px] font-medium border transition-colors ${intakeThreats.includes(t) ? "border-red-500/60 bg-red-500/10 text-red-500" : "border-border/40 text-muted-foreground hover:border-border"}`}>
                      {intakeThreats.includes(t) && <Check className="h-2.5 w-2.5 inline mr-0.5" />}{t}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <Label className="text-xs">Constraints</Label>
                <div className="flex flex-wrap gap-1.5 mt-1">
                  {CONSTRAINT_TYPES.map(t => (
                    <button key={t} type="button" onClick={() => toggleArr(intakeConstraints, setIntakeConstraints, t)}
                      className={`px-2 py-1 rounded-md text-[10px] font-medium border transition-colors ${intakeConstraints.includes(t) ? "border-amber-500/60 bg-amber-500/10 text-amber-600" : "border-border/40 text-muted-foreground hover:border-border"}`}>
                      {intakeConstraints.includes(t) && <Check className="h-2.5 w-2.5 inline mr-0.5" />}{t}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            {/* Command & Control */}
            <div className="pt-2 border-t border-border/20 space-y-3">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Command & Control</p>
              <div className="grid gap-3 sm:grid-cols-3">
                <div><Label className="text-xs">Command Model</Label>
                  <select value={intakeCommandModel} onChange={(e) => setIntakeCommandModel(e.target.value)} className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm">
                    <option value="">Select...</option>
                    {COMMAND_MODELS.map(m => <option key={m} value={m}>{m}</option>)}
                  </select>
                </div>
                <div><Label className="text-xs">Escalation Flow</Label>
                  <select value={intakeEscalation} onChange={(e) => setIntakeEscalation(e.target.value)} className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm">
                    <option value="">Select...</option>
                    <option value="Staff → Supervisor → Command">Staff → Supervisor → Command</option>
                    <option value="Direct to Command">Direct to Command</option>
                  </select>
                </div>
                <div>
                  <Label className="text-xs">{companyName || "Company"} Role</Label>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {COMPANY_ROLES.map(r => (
                      <button key={r} type="button" onClick={() => toggleArr(intakeEaRole, setIntakeEaRole, r)}
                        className={`px-1.5 py-0.5 rounded text-[9px] font-medium border transition-colors ${intakeEaRole.includes(r) ? "border-primary bg-primary/10 text-primary" : "border-border/40 text-muted-foreground hover:border-border"}`}>
                        {intakeEaRole.includes(r) && <Check className="h-2 w-2 inline mr-0.5" />}{r}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
            {/* Success Criteria */}
            <div className="pt-2 border-t border-border/20 space-y-2">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Success Criteria</p>
              <div className="flex flex-wrap gap-1.5">
                {SUCCESS_CRITERIA_OPTIONS.map(c => (
                  <button key={c} type="button" onClick={() => toggleArr(intakeSuccessCriteria, setIntakeSuccessCriteria, c)}
                    className={`px-2 py-1 rounded-md text-[10px] font-medium border transition-colors ${intakeSuccessCriteria.includes(c) ? "border-green-500/60 bg-green-500/10 text-green-600" : "border-border/40 text-muted-foreground hover:border-border"}`}>
                    {intakeSuccessCriteria.includes(c) && <Check className="h-2.5 w-2.5 inline mr-0.5" />}{c}
                  </button>
                ))}
              </div>
              <div><Label className="text-xs">Special Instructions / Additional Notes</Label><Textarea value={guide.specialInstructions} onChange={(v) => updateGuide("specialInstructions", v)} placeholder="VIP details, restricted areas, weather contingencies, additional success measures" rows={2} /></div>
            </div>
          </>
        )}

        {/* Navigation */}
        <div className="flex items-center justify-between pt-2 border-t border-border/30">
          <div className="flex gap-2">
            {createStep > 0 && <Button size="sm" variant="outline" onClick={() => setCreateStep(createStep - 1)}>Back</Button>}
            <Button size="sm" variant="ghost" onClick={onCancel}>Cancel</Button>
          </div>
          {createStep < CREATE_STEPS.length - 1 ? (
            <Button size="sm" onClick={() => setCreateStep(createStep + 1)} disabled={createStep === 0 && (!name.trim() || !startDate || !endDate)}>
              Next
            </Button>
          ) : (
            <Button size="sm" className="gap-1.5" onClick={handleCreate} disabled={!name.trim() || !startDate || !endDate || creating}>
              {creating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Flag className="h-3.5 w-3.5" />}
              Create Operation
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
