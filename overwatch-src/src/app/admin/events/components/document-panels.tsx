"use client";

import { toast } from "sonner";
import { updateDocument as updateDocumentById, createDocument as createDocumentById, getLatestDocument as getLatestDocById } from "@/lib/supabase/db-documents";
import { IntakePanel } from "@/components/ops/intake-panel";
import type { IntakeChange } from "@/components/ops/intake-panel";
import WarnoPanel from "@/components/ops/warno-panel";
import OpordPanel from "@/components/ops/opord-panel";
import FragoPanel from "@/components/ops/frago-panel";
import GotwaPanel from "@/components/ops/gotwa-panel";
import DocHub from "@/components/ops/doc-hub";

export type DocPanelType = "warno" | "opord" | "frago" | "gotwa" | "intake" | "dochub" | null;

interface DocumentPanelsProps {
  eventId: string;
  activeCompanyId: string;
  eventName: string;
  eventStart: string;
  eventEnd: string;
  eventLocation: string;
  companyName: string;
  companyLogo?: string;
  brandColor: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  mergedIntake: Record<string, any> | null;
  activePanel: DocPanelType;
  onPanelChange: (panel: DocPanelType) => void;
  onReload: () => Promise<void>;
}

export function DocumentPanels({
  eventId,
  activeCompanyId,
  eventName,
  eventStart,
  eventEnd,
  eventLocation,
  companyName,
  companyLogo,
  brandColor,
  mergedIntake,
  activePanel,
  onPanelChange,
  onReload,
}: DocumentPanelsProps) {
  const close = () => onPanelChange(null);

  return (
    <>
      {activePanel === "warno" && (
        <WarnoPanel
          eventId={eventId}
          companyId={activeCompanyId}
          eventName={eventName}
          companyName={companyName}
          intakeData={mergedIntake}
          onClose={close}
          onIssued={() => onReload()}
        />
      )}

      {activePanel === "frago" && (
        <FragoPanel
          eventId={eventId}
          companyId={activeCompanyId}
          eventName={eventName}
          onClose={close}
          onIssued={() => onReload()}
        />
      )}

      {activePanel === "gotwa" && (
        <GotwaPanel
          eventId={eventId}
          companyId={activeCompanyId}
          eventName={eventName}
          eventLocation={eventLocation}
          intakeData={mergedIntake}
          onClose={close}
          onIssued={() => onReload()}
        />
      )}

      {activePanel === "intake" && (
        <IntakePanel
          eventId={eventId}
          companyId={activeCompanyId}
          eventName={eventName}
          eventLocation={eventLocation}
          companyName={companyName}
          onClose={close}
          onSaved={async (changes: IntakeChange[]) => {
            if (changes.length === 0) return;
            try {
              // 1. Load latest OPORD (if exists)
              const opord = await getLatestDocById(eventId, "opord");
              if (opord) {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const opordData = (opord.data || {}) as Record<string, any>;
                const intakeToOpord: Record<string, string> = {
                  venueType: "venueType",
                  environment: "environment",
                  estimatedAttendance: "estimatedAttendance",
                  missionStatement: "missionStatement",
                  threatTypes: "threatTypes",
                  riskLevel: "riskLevel",
                  constraints: "knownConstraints",
                  medicalCapability: "medicalCapability",
                  commandModel: "commandModel",
                  escalationFlow: "escalationFlow",
                  successCriteria: "successCriteria",
                  additionalSuccessMeasures: "additionalSuccessMeasures",
                };
                let opordUpdated = false;
                const updatedOpordData = { ...opordData };
                for (const change of changes) {
                  const opordField = intakeToOpord[change.field];
                  if (opordField) {
                    updatedOpordData[opordField] = JSON.parse(change.to);
                    opordUpdated = true;
                  }
                }
                if (opordUpdated) {
                  updatedOpordData._intakeUpdated = true;
                  updatedOpordData._intakeUpdateDate = new Date().toISOString();
                  await updateDocumentById(opord.id, { data: updatedOpordData });
                }
              }

              // 2. Load latest GOTWA (if exists)
              const gotwa = await getLatestDocById(eventId, "gotwa");
              if (gotwa) {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const gotwaData = (gotwa.data || {}) as Record<string, any>;
                const intakeToGotwa: Record<string, string> = {
                  missionStatement: "objective",
                  riskLevel: "status",
                };
                let gotwaUpdated = false;
                const updatedGotwaData = { ...gotwaData };
                for (const change of changes) {
                  const gotwaField = intakeToGotwa[change.field];
                  if (gotwaField) {
                    const parsed = JSON.parse(change.to);
                    updatedGotwaData[gotwaField] = typeof parsed === 'string' ? parsed : change.to;
                    gotwaUpdated = true;
                  }
                }
                if (gotwaUpdated) {
                  updatedGotwaData._intakeUpdated = true;
                  updatedGotwaData._intakeUpdateDate = new Date().toISOString();
                  await updateDocumentById(gotwa.id, { data: updatedGotwaData });
                }
              }

              // 3. Auto-create draft FRAGO
              const changeSummary = changes.map(c => `\u2022 ${c.label}: ${c.from || '(empty)'} \u2192 ${c.to || '(empty)'}`).join('\n');
              await createDocumentById({
                eventId,
                companyId: activeCompanyId,
                docType: "frago",
                data: {
                  reason: "Intake document updated",
                  changes: changeSummary,
                  changesDetail: changes,
                  effectiveDateTime: new Date().toISOString(),
                  affectedElements: changes.map(c => c.label),
                  newTasking: "",
                  newCoordination: "",
                  supplyChanges: "",
                  commandChanges: "",
                  safetyUpdates: "",
                  issuerNotes: `Auto-generated from Intake update on ${new Date().toLocaleDateString()}`,
                },
              });

              toast.success(`Intake saved. ${opord ? 'OPORD updated. ' : ''}${gotwa ? 'GOTWA updated. ' : ''}Draft FRAGO created.`);
              await onReload();
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            } catch (e: any) {
              console.error("Cascade failed:", e);
              toast.error(`Cascade update failed: ${e?.message || 'unknown error'}`);
            }
          }}
        />
      )}

      {activePanel === "dochub" && (
        <DocHub
          eventId={eventId}
          onClose={close}
          onOpenDoc={async (type) => {
            if (type === "intake") onPanelChange("intake");
            else if (type === "warno") onPanelChange("warno");
            else if (type === "opord") onPanelChange("opord");
            else if (type === "frago") onPanelChange("frago");
            else if (type === "gotwa") onPanelChange("gotwa");
          }}
        />
      )}

      {activePanel === "opord" && (
        <OpordPanel
          eventId={eventId}
          companyId={activeCompanyId}
          eventName={eventName}
          eventStart={eventStart}
          eventEnd={eventEnd}
          eventLocation={eventLocation}
          companyName={companyName}
          companyLogo={companyLogo}
          brandColor={brandColor}
          intakeData={mergedIntake}
          onClose={close}
          onIssued={() => onReload()}
        />
      )}
    </>
  );
}
