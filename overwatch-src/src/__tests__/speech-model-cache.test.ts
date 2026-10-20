import { describe, it, expect } from "vitest";
import { cacheStateFromUrls, WHISPER_MODEL_ID, DIARIZATION_MODEL_ID } from "@/lib/speech/model-cache";
const hf = (id: string, f: string) => `https://huggingface.co/${id}/resolve/main/${f}`;
describe("cacheStateFromUrls", () => {
  it("needs ONNX weights, not just config", () => {
    expect(cacheStateFromUrls([])).toBe("missing");
    expect(cacheStateFromUrls([hf(WHISPER_MODEL_ID, "config.json")])).toBe("missing");
    expect(cacheStateFromUrls([hf(WHISPER_MODEL_ID, "onnx/encoder_model_quantized.onnx")])).toBe("partial");
    expect(cacheStateFromUrls([hf(WHISPER_MODEL_ID, "onnx/encoder_model_quantized.onnx"), hf(DIARIZATION_MODEL_ID, "onnx/model.onnx")])).toBe("ready");
  });
});
