/**
 * CesiumJS global configuration — must run before any Cesium import.
 */

export function configureCesium() {
  if (typeof window === "undefined") return;

  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const Cesium = require("cesium");

  // Static assets are copied to public/cesium/ by the copy-cesium script
  (window as unknown as Record<string, unknown>).CESIUM_BASE_URL = "/overwatch/cesium/";

  // Ion access token
  Cesium.Ion.defaultAccessToken =
    process.env.NEXT_PUBLIC_CESIUM_TOKEN ??
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqdGkiOiIxNDNmNTU5YS00ZjdmLTQzMzYtOWVhZS1hOGI5NzNhMmY2YzEiLCJpZCI6NDE1OTU4LCJpYXQiOjE3NzU3NDI4MDl9.T-wJKrOTvF7bn9A8Js7b19dAB4Q2GaCrF50nN0egTQ0";
}
