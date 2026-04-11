/**
 * Whisper WASM Engine — client-side speech-to-text via @huggingface/transformers
 *
 * Uses the Whisper "tiny.en" model (~75MB) running in WebAssembly/WebGPU.
 * The model is downloaded once and cached in the browser's Cache API.
 *
 * This module is loaded lazily — it is NOT included in the main bundle.
 * Import it dynamically: `const { transcribe } = await import("@/lib/speech/whisper-engine")`
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let pipelineInstance: any = null;
let loadingPromise: Promise<void> | null = null;

export type WhisperProgress = {
  status: "loading" | "downloading" | "ready" | "transcribing";
  progress?: number; // 0-100 for download progress
  message?: string;
};

type ProgressCallback = (p: WhisperProgress) => void;

// Use the ONNX-optimized Whisper tiny.en model from HuggingFace
// fp32 is used because q8 quantization requires DequantizeLinear ops
// that the WASM ONNX runtime doesn't support for all model architectures.
const MODEL_ID = "onnx-community/whisper-tiny.en";

/**
 * Warm up the pipeline (download model + initialize ONNX runtime).
 * Safe to call multiple times — only loads once.
 */
export async function loadModel(onProgress?: ProgressCallback): Promise<void> {
  if (pipelineInstance) return;
  if (loadingPromise) return loadingPromise;

  loadingPromise = (async () => {
    onProgress?.({ status: "loading", message: "Initializing speech engine..." });

    // Dynamic import to keep the main bundle small
    const { pipeline, env } = await import("@huggingface/transformers");

    // Use remote models from HuggingFace Hub (cached by the browser)
    env.allowLocalModels = false;

    onProgress?.({ status: "downloading", message: "Downloading speech model (~75 MB, one-time)...", progress: 0 });

    pipelineInstance = await pipeline("automatic-speech-recognition", MODEL_ID, {
      dtype: "fp32",          // fp32 — q8 quantization not supported by WASM ONNX runtime
      device: "wasm",         // explicit WASM — WebGPU is flaky in some browsers
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      progress_callback: (p: any) => {
        if (p.status === "progress" && p.total) {
          const pct = Math.round((p.loaded / p.total) * 100);
          onProgress?.({ status: "downloading", progress: pct, message: `Downloading speech model... ${pct}%` });
        }
        if (p.status === "done") {
          onProgress?.({ status: "ready", message: "Speech model ready" });
        }
      },
    });

    onProgress?.({ status: "ready", message: "Speech model ready" });
  })();

  try {
    await loadingPromise;
  } catch (err) {
    loadingPromise = null; // Allow retry on failure
    throw err;
  }
}

/**
 * Check if the model is already loaded and ready.
 */
export function isModelLoaded(): boolean {
  return pipelineInstance !== null;
}

/**
 * Transcribe a Float32Array of audio samples (16kHz mono) to text.
 */
export async function transcribe(
  audioData: Float32Array,
  onProgress?: ProgressCallback,
): Promise<string> {
  if (!pipelineInstance) {
    await loadModel(onProgress);
  }

  onProgress?.({ status: "transcribing", message: "Transcribing audio..." });

  // Note: whisper-tiny.en is English-only — do NOT pass language or task
  // (those params are only for multilingual models like whisper-tiny)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const result: any = await pipelineInstance(audioData, {
    chunk_length_s: 30,
    stride_length_s: 5,
    return_timestamps: false,
  });

  // Result is { text: string } or an array
  const text = Array.isArray(result)
    ? result.map((r: { text: string }) => r.text).join(" ")
    : result.text ?? "";

  return text.trim();
}

/**
 * Convert an AudioBuffer (from Web Audio API) to 16kHz mono Float32Array
 * suitable for Whisper input.
 */
export function audioBufferToFloat32(buffer: AudioBuffer): Float32Array {
  const sampleRate = buffer.sampleRate;
  const targetRate = 16000;

  // Mix to mono
  let mono: Float32Array;
  if (buffer.numberOfChannels === 1) {
    mono = buffer.getChannelData(0);
  } else {
    mono = new Float32Array(buffer.length);
    for (let ch = 0; ch < buffer.numberOfChannels; ch++) {
      const channelData = buffer.getChannelData(ch);
      for (let i = 0; i < buffer.length; i++) {
        mono[i] += channelData[i] / buffer.numberOfChannels;
      }
    }
  }

  // Resample to 16kHz if needed
  if (sampleRate === targetRate) return mono;

  const ratio = sampleRate / targetRate;
  const newLength = Math.round(mono.length / ratio);
  const resampled = new Float32Array(newLength);
  for (let i = 0; i < newLength; i++) {
    const srcIndex = i * ratio;
    const low = Math.floor(srcIndex);
    const high = Math.min(low + 1, mono.length - 1);
    const frac = srcIndex - low;
    resampled[i] = mono[low] * (1 - frac) + mono[high] * frac;
  }
  return resampled;
}
