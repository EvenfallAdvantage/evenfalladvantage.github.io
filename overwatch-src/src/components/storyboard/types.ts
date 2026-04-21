import type { LucideIcon } from "lucide-react";

/* ── Types ── */

export type StoryboardPin = {
  id: string;
  x: number;
  y: number;
  label: string;
  description: string;
  icon: string;
  color: string;
  timestamp?: string;
  createdBy?: string;
};

export type StoryboardEditorProps = {
  imageUrl: string;
  pins: StoryboardPin[];
  onPinsChange?: (pins: StoryboardPin[]) => void;
  readOnly?: boolean;
  singlePinMode?: boolean;
  /** Pre-fill label, description, icon, and color for new pins */
  defaultPinValues?: { label?: string; description?: string; icon?: string; color?: string };
  className?: string;
};

export type PinFormData = {
  label: string;
  description: string;
  icon: string;
  color: string;
};

export type IconEntry = { value: string; label: string; icon: LucideIcon; tags: string[] };
