"use client";

import { TLP_STEPS, type TlpStep } from "@/types/operations";
import { Check } from "lucide-react";

interface TlpTrackerProps {
  currentStep: TlpStep;
  onStepClick?: (step: TlpStep) => void;
  compact?: boolean;
}

const STEP_IDX = Object.fromEntries(TLP_STEPS.map((s, i) => [s.key, i])) as Record<TlpStep, number>;

export default function TlpTracker({ currentStep, onStepClick, compact }: TlpTrackerProps) {
  const currentIdx = STEP_IDX[currentStep] ?? 0;

  return (
    <div className={`flex items-center gap-0.5 ${compact ? "overflow-x-auto" : "flex-wrap gap-y-1"}`}>
      {TLP_STEPS.map((step, i) => {
        const isComplete = i < currentIdx;
        const isCurrent = i === currentIdx;
        const isFuture = i > currentIdx;

        return (
          <div key={step.key} className="flex items-center gap-0.5 shrink-0">
            <button
              type="button"
              onClick={() => onStepClick?.(step.key)}
              disabled={!onStepClick}
              className={`
                flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[9px] font-mono font-medium transition-all
                ${isComplete
                  ? "bg-green-500/15 text-green-600 border border-green-500/30"
                  : isCurrent
                    ? "bg-primary/15 text-primary border border-primary/40 ring-1 ring-primary/20"
                    : "bg-muted/30 text-muted-foreground/50 border border-border/20"
                }
                ${onStepClick && !isFuture ? "cursor-pointer hover:opacity-80" : "cursor-default"}
              `}
              title={step.label}
            >
              {isComplete && <Check className="h-2.5 w-2.5" />}
              {isCurrent && <span className="relative flex h-1.5 w-1.5"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" /><span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-primary" /></span>}
              <span>{step.short}</span>
            </button>
            {i < TLP_STEPS.length - 1 && (
              <span className={`text-[8px] ${isComplete ? "text-green-500/40" : "text-muted-foreground/20"}`}>›</span>
            )}
          </div>
        );
      })}
    </div>
  );
}
