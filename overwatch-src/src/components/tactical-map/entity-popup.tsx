"use client";

import React from "react";
import { escapeHtml, sanitizeHtml } from "@/lib/security";

interface EntityPopupProps {
  entity: {
    id: string;
    name: string;
    description: string;
    screenX: number;
    screenY: number;
  };
  containerWidth: number;
  onClose: () => void;
}

export function EntityPopup({ entity, containerWidth, onClose }: EntityPopupProps) {
  return (
    <div
      className="absolute z-20 pointer-events-auto"
      style={{
        left: Math.min(Math.max(entity.screenX - 140, 8), containerWidth - 296),
        top: Math.max(entity.screenY - 10, 8),
        transform: "translateY(-100%)",
      }}
    >
      {/* Connector line */}
      <div
        className="absolute left-1/2 bottom-0 w-px h-2"
        style={{
          backgroundColor: "var(--brand-accent, #d59b3c)",
          transform: "translateX(-50%) translateY(100%)",
        }}
      />
      {/* Popup card */}
      <div
        className="w-72 rounded-xl backdrop-blur-md shadow-xl shadow-black/40 overflow-hidden"
        style={{
          backgroundColor: "color-mix(in srgb, var(--brand-primary, #0f1a2e) 95%, transparent)",
          borderWidth: 1,
          borderStyle: "solid",
          borderColor: "color-mix(in srgb, var(--brand-accent, #d59b3c) 30%, transparent)",
        }}
      >
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-1.5 right-2 text-white/30 hover:text-white text-xs z-10"
        >
          ✕
        </button>
        {/* Body */}
        <div
          className="px-3 py-2.5 text-[11px] text-white/80 font-mono leading-relaxed max-h-48 overflow-y-auto [&_strong]:text-accent [&_b]:text-accent"
          dangerouslySetInnerHTML={{
            __html: entity.description
              ? sanitizeHtml(entity.description)
              : `<b>${escapeHtml(entity.name)}</b>`,
          }}
        />
      </div>
    </div>
  );
}
