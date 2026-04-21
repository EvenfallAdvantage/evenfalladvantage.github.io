/**
 * CesiumJS CDN loader — loads Cesium from CDN to avoid Turbopack bundling issues.
 *
 * CesiumJS has heavy Node.js/Worker dependencies that Turbopack cannot
 * statically analyze (dynamic require(), Web Workers, WASM). Loading from
 * CDN avoids all bundler compatibility issues.
 */

const CESIUM_VERSION = "1.128";
const CESIUM_CDN = `https://cesium.com/downloads/cesiumjs/releases/${CESIUM_VERSION}/Build/Cesium`;

const CESIUM_TOKEN = process.env.NEXT_PUBLIC_CESIUM_TOKEN ?? "";

let loadPromise: Promise<typeof globalThis.Cesium> | null = null;

/**
 * Load CesiumJS from CDN. Returns the global Cesium object.
 * Safe to call multiple times — only loads once.
 */
export function loadCesium(): Promise<typeof globalThis.Cesium> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("CesiumJS requires a browser environment"));
  }

  // Already loaded
  if (window.Cesium) {
    return Promise.resolve(window.Cesium);
  }

  if (loadPromise) return loadPromise;

  loadPromise = new Promise((resolve, reject) => {
    // Set base URL before the script loads
    window.CESIUM_BASE_URL = CESIUM_CDN;

    // Load CSS
    if (!document.querySelector('link[href*="cesium"]')) {
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = `${CESIUM_CDN}/Widgets/widgets.css`;
      document.head.appendChild(link);
    }

    // Load JS
    const script = document.createElement("script");
    script.src = `${CESIUM_CDN}/Cesium.js`;
    script.async = true;
    script.onload = () => {
      if (window.Cesium) {
        window.Cesium.Ion.defaultAccessToken = CESIUM_TOKEN;
        resolve(window.Cesium);
      } else {
        reject(new Error("CesiumJS failed to initialize"));
      }
    };
    script.onerror = () => {
      loadPromise = null;
      reject(new Error("Failed to load CesiumJS from CDN"));
    };
    document.head.appendChild(script);
  });

  return loadPromise;
}
