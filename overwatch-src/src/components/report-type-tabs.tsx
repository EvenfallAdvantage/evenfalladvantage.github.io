"use client";

import { AlertTriangle, ClipboardList, Mic } from "lucide-react";
import { SubTabLink, SubTabList } from "@/components/ui/sub-tabs";

/** Dictate / Field Reports / Incidents switcher shared by the three report pages. */
export function ReportTypeTabs({ active }: { active: "dictate" | "forms" | "incidents" }) {
  return (
    <SubTabList>
      <SubTabLink href="/dictate" active={active === "dictate"} icon={Mic}>Dictate</SubTabLink>
      <SubTabLink href="/forms" active={active === "forms"} icon={ClipboardList}>Field Reports</SubTabLink>
      <SubTabLink href="/incidents" active={active === "incidents"} icon={AlertTriangle}>Incidents</SubTabLink>
    </SubTabList>
  );
}
