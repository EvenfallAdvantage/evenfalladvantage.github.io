"use client";

import { ExternalLink, Hash, Mail, Radar, Radio } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { SubTab, SubTabLink, SubTabList } from "@/components/ui/sub-tabs";

export type CommsTab = "briefings" | "channels" | "messages" | "external" | "scanner";

export const COMMS_TITLE = "COMMS";
export const COMMS_SUBTITLE = "Briefings, team channels, direct messages, radio scanner, and external groups";

const TABS: { id: CommsTab; label: string; icon: typeof Hash; href: string }[] = [
  { id: "briefings", label: "Briefings", icon: Radar, href: "/updates" },
  { id: "channels", label: "Channels", icon: Hash, href: "/chat" },
  { id: "messages", label: "Messages", icon: Mail, href: "/chat?tab=messages" },
  { id: "external", label: "External Groups", icon: ExternalLink, href: "/chat?tab=external" },
  { id: "scanner", label: "Scanner", icon: Radio, href: "/chat?tab=scanner" },
];

/**
 * The one Comms tab row, shared by /chat and /updates (Briefings) so every tab,
 * Scanner included, is always present and looks the same. Tabs handled on the
 * current page switch in place via onSelect; the rest navigate.
 */
export function CommsTabs({ active, onSelect, counts = {} }: {
  active: CommsTab;
  onSelect?: Partial<Record<CommsTab, () => void>>;
  counts?: Partial<Record<CommsTab, number>>;
}) {
  return (
    <SubTabList>
      {TABS.map((t) => {
        const n = counts[t.id] ?? 0;
        const badge = n > 0 && <Badge className="ml-1 h-4 min-w-4 px-1 text-[10px] bg-primary/20 text-primary">{n}</Badge>;
        const select = onSelect?.[t.id];
        return select ? (
          <SubTab key={t.id} active={active === t.id} onClick={select} icon={t.icon}>{t.label}{badge}</SubTab>
        ) : (
          <SubTabLink key={t.id} active={active === t.id} href={t.href} icon={t.icon}>{t.label}{badge}</SubTabLink>
        );
      })}
    </SubTabList>
  );
}
