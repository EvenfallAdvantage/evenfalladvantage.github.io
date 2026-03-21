/* ── Operation Document Types ─────────────────────────── */

export type DocType = "intake" | "warno" | "opord" | "frago" | "gotwa";
export type DocStatus = "draft" | "issued" | "superseded";
export type TlpStep =
  | "receive_mission"
  | "issue_warno"
  | "make_assessment"
  | "complete_plan"
  | "prepare"
  | "brief"
  | "execute"
  | "adjust";

export const TLP_STEPS: { key: TlpStep; label: string; short: string }[] = [
  { key: "receive_mission", label: "Receive Mission", short: "① Receive" },
  { key: "issue_warno", label: "Issue WARNO", short: "② WARNO" },
  { key: "make_assessment", label: "Make Assessment", short: "③ Assess" },
  { key: "complete_plan", label: "Complete Plan (OPORD)", short: "④ OPORD" },
  { key: "prepare", label: "Prepare & Coordinate", short: "⑤ Prepare" },
  { key: "brief", label: "Brief", short: "⑥ Brief" },
  { key: "execute", label: "Execute", short: "⑦ Execute" },
  { key: "adjust", label: "Supervise & Adjust (FRAGO)", short: "⑧ Adjust" },
];

export interface OperationDocument {
  id: string;
  event_id: string;
  company_id: string;
  doc_type: DocType;
  version: number;
  status: DocStatus;
  data: Record<string, unknown>;
  parent_doc_id: string | null;
  created_by: string | null;
  issued_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface DocumentAck {
  id: string;
  document_id: string;
  user_id: string;
  acknowledged_at: string;
  users?: { id: string; first_name: string; last_name: string; avatar_url?: string };
}

/* ── Intake (EA-MIF-01) ──────────────────────────────── */

export interface IntakeData {
  // Mission overview
  engagementType: string[];       // e.g. ["Event Security", "Consulting"]
  clientRequest: string;          // client's words
  missionStatement: string;       // EA mission statement
  timeSensitivity: string;        // "Low" | "Medium" | "High" | "Immediate"

  // Location & environment
  venueType: string[];            // checkboxes
  estimatedAttendance: string;
  environment: string;            // "Indoor" | "Outdoor" | "Hybrid"
  environmentNotes: string;

  // Scope
  servicesRequested: string[];
  deliverables: string;
  outOfScope: string;

  // Client capability & resources
  clientPersonnelCount: string;
  clientLeadershipStructure: string;
  clientExistingSops: boolean;
  clientIncidentReporting: string;
  clientTrainingLevel: string;
  equipmentAvailable: string;
  medicalCapability: string;      // "None" | "Basic First Aid" | "STOP THE BLEED" | "EMS On-site"
  technologyAvailable: string;

  // Risks & constraints
  clientIdentifiedRisks: string;
  eaRiskAssessment: string;
  riskLevel: string;              // "Low" | "Moderate" | "High" | "Critical"
  threatTypes: string[];          // checkboxes
  constraints: string[];          // e.g. ["Budget", "Staffing", "Legal", "Venue", "Time"]

  // Command & control
  commandModel: string;           // "Single Supervisor" | "Tiered Leadership" | "ICS-Aligned"
  onSiteAuthority: string;
  eaRole: string[];               // e.g. ["Advisory", "Planning", "Operational Support"]
  escalationFlow: string;         // "Staff → Supervisor → Command" | "Direct to Command"
  chainOfCommand: string;

  // Success criteria
  successCriteria: string[];      // checkboxes
  additionalSuccessMeasures: string;
}

/* ── WARNO (EA-WARNO-01) ─────────────────────────────── */

export interface WarnoData {
  // Header
  preparedBy: string;
  dateIssued: string;

  // 1. Situation
  operationalOverview: string;
  crowdSizeDensity: string;
  environment: string;
  knownConcerns: string;

  // 2. Mission
  missionStatement: string;

  // 3. Initial tasks
  initialTasks: { text: string; checked: boolean }[];

  // 4. Timeline
  assessmentStart: string;
  keyMilestones: string;
  finalDeliverablesDate: string;

  // 5. Coordination
  clientPoc: string;
  eaPoc: string;
  communicationMethod: string[];  // ["Phone", "Email", "In-person", "Other"]

  // 6. Command & Control
  eaRole: string[];               // ["Advisory", "Planning", "Operational Support"]
  clientAuthority: string;
}

/* ── OPORD (EA-OPORD-01) ─────────────────────────────── */

export interface OpordData {
  // Header
  preparedBy: string;
  version: string;

  // 1. Situation
  venueType: string[];
  environment: string;
  estimatedAttendance: string;
  threatTypes: string[];
  riskLevel: string;
  knownConstraints: string[];

  // 2. Mission
  missionStatement: string;

  // 3. Execution
  securityPosture: string;        // "Low Visibility" | "High Visibility" | "Mixed"
  operationalApproach: string[];  // checkboxes
  primaryFocusAreas: string[];    // checkboxes
  entryPoints: string;
  highRiskZones: string;
  restrictedAreas: string;
  supervisorTasks: string[];
  staffTasks: string[];

  // 4. Support
  medicalCapability: string;
  communicationMethod: string;
  radioChannels: string;
  equipment: string[];

  // 5. Command & Control
  commandModel: string;
  icsEstablished: boolean;
  overallLead: string;
  supervisors: string;
  clientRepresentative: string;
  escalationFlow: string;

  // 6. Contingency (5-point)
  primaryPlan: string;
  alternatePlan: string;
  contingencyPlan: string;
  emergencyPlan: string;
  recoveryPlan: string;

  // 7. Timeline
  operationalStart: string;
  peakPeriods: string;
  operationalEnd: string;

  // 8. Success criteria
  successCriteria: string[];
  additionalSuccessMeasures: string;

  // 9. Notes
  specialInstructions: string;
}

/* ── FRAGO (EA-FRAGO-01) ─────────────────────────────── */

export interface FragoData {
  // Header
  preparedBy: string;
  dateIssued: string;
  timeIssued: string;
  fragoNumber: number;
  relatedOpordId: string;

  // 1. Situation update
  whatChanged: string[];           // checkboxes
  changeDescription: string;
  updatedRiskLevel: string;

  // 2. Mission
  missionChanged: boolean;
  updatedMission: string;

  // 3. Execution changes
  updatedTasks: string[];          // checkboxes
  specificInstructions: string;
  areasAffected: string[];         // checkboxes

  // 4. Support changes
  medicalChange: string;
  commsChange: string;
  equipmentChange: string;

  // 5. Command & Control
  structureChange: string;
  updatedCommandLead: string;
  updatedSupervisors: string;
  escalationChange: string;

  // 6. Contingency status
  currentLevel: string;            // "Primary" | "Alternate" | "Contingency" | "Emergency" | "Recovery"
  actionBeingTaken: string;

  // 7. Timeline update
  effectiveImmediately: boolean;
  effectiveTime: string;
  duration: string;                // "Temporary" | "Until Further Notice" | "Permanent"
}

/* ── GOTWA (EA-GOTWA-01) ─────────────────────────────── */

export interface GotwaData {
  // Header
  preparedBy: string;
  dateTime: string;

  // 1. Going
  area: string;
  objective: string;

  // 2. Others
  personnelAssigned: string;
  supervisor: string;
  supportElements: string;

  // 3. Time
  startTime: string;
  expectedDuration: string;       // "< 30 min" | "30–60 min" | "1–2 hours" | "Event duration"
  returnCheckInTime: string;

  // 4. What if
  primaryConcern: string[];       // checkboxes
  immediateAction: string;
  escalationTrigger: string;

  // 5. Actions
  ifNoIssue: string;
  whoToNotify: string;
  followOnActions: string;

  // Status & Comms
  status: string;                  // "Normal" | "Elevated Awareness" | "Active Issue" | "Escalated"
  communicationMethod: string[];   // ["Radio", "Phone", "Hybrid"]
  channel: string;
  notes: string;
}
