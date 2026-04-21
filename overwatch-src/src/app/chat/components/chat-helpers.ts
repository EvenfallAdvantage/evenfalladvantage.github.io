import { logger } from "@/lib/logger";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Channel = any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Message = any;

export const QUICK_EMOJIS = ["👍", "❤️", "😂", "🔥", "👀", "✅"];

export const ALL_ROLES = ["owner", "admin", "instructor", "manager", "lead", "breaker", "staff"] as const;

export type ChannelPermissions = { can_post: string[]; can_react: string[]; can_pin: string[] };

export const DEFAULT_PERMS: ChannelPermissions = {
  can_post: ["owner", "admin", "instructor", "manager", "lead", "breaker", "staff"],
  can_react: ["owner", "admin", "instructor", "manager", "lead", "breaker", "staff"],
  can_pin: ["owner", "admin", "manager"],
};

export function getChannelPerms(channel: Channel): ChannelPermissions {
  if (channel?.permissions && typeof channel.permissions === "object") return { ...DEFAULT_PERMS, ...channel.permissions };
  return DEFAULT_PERMS;
}

export function timeAgo(iso: string) {
  const ms = Date.now() - new Date(iso).getTime();
  const s = Math.floor(ms / 1000);
  if (s < 60) return "now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}

export type ExtMeta = { external: true; platform: string; url: string };

export function parseExt(desc: string | null): ExtMeta | null {
  if (!desc) return null;
  try { const m = JSON.parse(desc); if (m?.external && m?.url) return m; } catch (e) { logger.swallow("chat:parse-ext-meta", e, "debug"); }
  return null;
}

export const PLAT: Record<string, { color: string; bg: string; label: string; logo: string }> = {
  whatsapp: { color: "text-green-500", bg: "bg-green-500/10", label: "WhatsApp", logo: "/overwatch/images/integrations/whatsapp.svg" },
  signal: { color: "text-blue-400", bg: "bg-blue-400/10", label: "Signal", logo: "/overwatch/images/integrations/signal.svg" },
  discord: { color: "text-indigo-400", bg: "bg-indigo-400/10", label: "Discord", logo: "/overwatch/images/integrations/discord.svg" },
  telegram: { color: "text-sky-400", bg: "bg-sky-400/10", label: "Telegram", logo: "/overwatch/images/integrations/telegram.svg" },
  slack: { color: "text-purple-500", bg: "bg-purple-500/10", label: "Slack", logo: "/overwatch/images/integrations/slack.svg" },
  other: { color: "text-muted-foreground", bg: "bg-muted/50", label: "Other", logo: "" },
};

export const EXT_PLATFORM_OPTIONS = ["whatsapp", "signal", "discord", "telegram", "slack", "other"] as const;
