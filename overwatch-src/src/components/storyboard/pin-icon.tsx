"use client";

import { MapPin } from "lucide-react";
import { ICON_MAP } from "./icon-catalog";

export function PinIcon({
  icon,
  size = 16,
}: {
  icon: string;
  size?: number;
}) {
  const Comp = ICON_MAP[icon] ?? MapPin;
  return <Comp size={size} strokeWidth={2.5} />;
}
