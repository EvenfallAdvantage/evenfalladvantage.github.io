/**
 * Typed declarations for custom properties attached to `window`.
 *
 * This eliminates the need for `(window as any).__prop` casts throughout the
 * codebase. Add new globals here instead of using `window as any`.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

// ─── Cesium (CDN-loaded at runtime) ─────────────────────────────────────────
// Cesium namespace itself is declared in cesium.d.ts

// ─── Tactical Map globals ───────────────────────────────────────────────────
// These are set by tactical-map.tsx and consumed by hooks / popups.

declare interface Window {
  /** CesiumJS Viewer instance, set by tactical-map.tsx */
  __tacticalMapViewer?: any;

  /** Delete an annotation by ID from the tactical map */
  __deleteAnnotation?: (annotationId: string) => void;

  /** Open an operation document panel from the tactical map */
  __openOpDoc?: (eventId: string, docType: string) => void;

  /** Open a direct-message panel for a staff member */
  __openStaffDM?: (userId: string, name: string) => void;

  /** Site-map aligner click handler for adding control points */
  __siteMapAlignerAddPoint?: (lat: number, lng: number) => void;

  /** Storyboard / scratchpad autosave debounce timer */
  __sbSaveTimer?: ReturnType<typeof setTimeout>;

  /** Minimal auth context exposed for error tracker (no PII) */
  __OVERWATCH_AUTH_STORE__?: {
    userId: string | null;
    activeCompanyId: string | null;
  };

  // ─── Third-party CDN libraries ──────────────────────────────────────────
  /** satellite.js (loaded from jsdelivr CDN) */
  satellite?: any;

  /** BarcodeDetector API (not yet in all TS DOM libs) */
  BarcodeDetector?: {
    new(opts?: { formats: string[] }): {
      detect(source: ImageBitmapSource): Promise<Array<{ rawValue: string }>>;
    };
    getSupportedFormats(): Promise<string[]>;
  };

  /** Web Speech API (webkit-prefixed variant) */
  SpeechRecognition?: any;
  webkitSpeechRecognition?: any;
}
