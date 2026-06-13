export type Platform = "windows" | "mac" | "linux" | "ios" | "android" | "other";

export function getPlatform(): Platform {
  const ua = navigator.userAgent.toLowerCase();
  if (ua.includes("windows")) return "windows";
  if (ua.includes("macintosh") || ua.includes("mac os x")) return "mac";
  if (ua.includes("linux")) return "linux";
  if (ua.includes("iphone") || ua.includes("ipad")) return "ios";
  if (ua.includes("android")) return "android";
  return "other";
}

export function isDesktop(): boolean {
  const platform = getPlatform();
  return platform === "windows" || platform === "mac" || platform === "linux";
}

export function isMobile(): boolean {
  const platform = getPlatform();
  return platform === "ios" || platform === "android";
}
