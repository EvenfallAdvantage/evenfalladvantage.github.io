"use client";

import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import StoryboardEditor from "@/components/storyboard-editor";
import type { StoryboardPin } from "@/components/storyboard-editor";

interface SiteMapMarkModalProps {
  siteMapUrl: string;
  existingPins: StoryboardPin[];
  locationPin: StoryboardPin | null;
  title: string;
  description: string;
  onPinChange: (pin: StoryboardPin | null) => void;
  onClose: () => void;
}

export function SiteMapMarkModal({
  siteMapUrl,
  existingPins,
  locationPin,
  title,
  description,
  onPinChange,
  onClose,
}: SiteMapMarkModalProps) {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-2xl border border-border/50 bg-card shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-border/30 px-5 py-3">
          <div>
            <h3 className="text-sm font-bold">Mark Incident Location</h3>
            <p className="text-[10px] text-muted-foreground mt-0.5">Click &quot;Add Pin&quot; then click on the map to place the incident marker. Existing operation pins are shown for reference.</p>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="p-5">
          <StoryboardEditor
            imageUrl={siteMapUrl}
            pins={locationPin ? [...existingPins, locationPin] : existingPins}
            singlePinMode={false}
            readOnly={false}
            defaultPinValues={{
              label: title || "Incident Location",
              description: description || undefined,
              icon: "incident",
              color: "#ef4444",
            }}
            onPinsChange={(newPins) => {
              // The last pin added (beyond existing pins) is the incident pin
              if (newPins.length > existingPins.length) {
                const newPin = newPins[newPins.length - 1];
                onPinChange({
                  ...newPin,
                  label: newPin.label || title || "Incident Location",
                  icon: "incident",
                  color: "#ef4444",
                });
              } else if (newPins.length <= existingPins.length) {
                // User deleted the incident pin or only existing pins remain
                onPinChange(null);
              }
            }}
          />
        </div>
        <div className="flex items-center justify-end gap-2 border-t border-border/30 px-5 py-3">
          <Button size="sm" variant="outline" onClick={onClose}>Cancel</Button>
          <Button size="sm" onClick={() => {
            onClose();
            if (locationPin) {
              toast.success("Incident location marked on site map");
            }
          }}>
            {locationPin ? "Confirm Location" : "Close"}
          </Button>
        </div>
      </div>
    </div>
  );
}
