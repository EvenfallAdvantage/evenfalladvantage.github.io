/**
 * Loads @huggingface/transformers (Whisper / pyannote via ONNX Runtime Web)
 * from a pinned CDN build at the moment speech-to-text is first used.
 *
 * Why not `import("@huggingface/transformers")`? Even as a dynamic import,
 * bundling it makes the build emit onnxruntime-web's ~26 MB
 * `ort-wasm-simd-threaded.asyncify.wasm` plus a ~530 KB JS chunk into
 * `out/_next/static`. That bloats every deploy and the PWA cache. The
 * self-contained CDN build (`dist/transformers.min.js`) fetches its WASM
 * from jsDelivr on demand, and the models already come from the Hugging
 * Face Hub, so dictation already needs the network the first time.
 *
 * Keep TRANSFORMERS_VERSION in sync with package-lock.json (the npm package
 * stays installed for its TypeScript types).
 */
export const TRANSFORMERS_VERSION = "4.3.0";
export const TRANSFORMERS_CDN_URL = `https://cdn.jsdelivr.net/npm/@huggingface/transformers@${TRANSFORMERS_VERSION}/dist/transformers.min.js`;

type TransformersModule = typeof import("@huggingface/transformers");

let modulePromise: Promise<TransformersModule> | null = null;

export function loadTransformers(): Promise<TransformersModule> {
  if (!modulePromise) {
    modulePromise = (
      import(/* webpackIgnore: true */ /* turbopackIgnore: true */ TRANSFORMERS_CDN_URL) as Promise<TransformersModule>
    ).catch((err) => {
      modulePromise = null; // allow retry (e.g. came back online)
      throw err;
    });
  }
  return modulePromise;
}
