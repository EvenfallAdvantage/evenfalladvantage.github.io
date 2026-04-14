"use client";

import { X } from "lucide-react";
import { toast } from "sonner";
import StoryboardEditor from "@/components/storyboard-editor";
import type { StoryboardPin } from "@/components/storyboard-editor";
import { loadStoryboard, saveStoryboard } from "@/lib/supabase/db";
import type { Incident } from "./constants";

interface SiteMapViewModalProps {
  mapUrl: string;
  pins: StoryboardPin[];
  isAdmin: boolean;
  activeCompanyId: string;
  incidents: Incident[];
  viewMapIncidentId: string;
  onPinsChange: (pins: StoryboardPin[]) => void;
  onClose: () => void;
}

export function SiteMapViewModal({
  mapUrl,
  pins,
  isAdmin,
  activeCompanyId,
  incidents,
  viewMapIncidentId,
  onPinsChange,
  onClose,
}: SiteMapViewModalProps) {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-2xl border border-border/50 bg-card shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-border/30 px-5 py-3">
          <h3 className="text-sm font-bold">Incident Location on Site Map {isAdmin && <span className="text-[10px] text-muted-foreground font-normal ml-2">(click to edit)</span>}</h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="p-5">
          <StoryboardEditor
            imageUrl={mapUrl}
            pins={pins}
            readOnly={!isAdmin}
            onPinsChange={isAdmin ? async (newPins) => {
              onPinsChange(newPins);
              // Save the updated storyboard
              try {
                const sb = await loadStoryboard(incidents.find((i: Incident) => i.id === viewMapIncidentId)?.event_id ?? '');
                if (sb) {
                  await saveStoryboard(activeCompanyId, incidents.find((i: Incident) => i.id === viewMapIncidentId)?.event_id ?? '', newPins, sb.id);
                  toast.success('Storyboard updated');
                }
              } catch (e: unknown) {
                const msg = e instanceof Error ? e.message : 'unknown error';
                toast.error(`Save failed: ${msg}`);
              }
            } : undefined}
          />
        </div>
      </div>
    </div>
  );
}
