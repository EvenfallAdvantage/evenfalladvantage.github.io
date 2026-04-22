/**
 * Post-process GLSL shaders for tactical map visual modes.
 *
 * FLIR Thermal: Simulates forward-looking infrared camera
 * CRT Mode: Retro surveillance monitor aesthetic
 * @module
 */

import { logger } from "@/lib/logger";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type CesiumRef = any;

/**
 * FLIR Thermal Shader — white-hot mode.
 * Converts scene to thermal-like visualization where bright = hot.
 */
export const FLIR_SHADER = `
  uniform sampler2D colorTexture;
  in vec2 v_textureCoordinates;

  vec3 thermalPalette(float t) {
    // Iron bow / white-hot thermal palette
    vec3 c;
    if (t < 0.25) {
      c = mix(vec3(0.0, 0.0, 0.1), vec3(0.3, 0.0, 0.5), t * 4.0);
    } else if (t < 0.5) {
      c = mix(vec3(0.3, 0.0, 0.5), vec3(0.8, 0.2, 0.0), (t - 0.25) * 4.0);
    } else if (t < 0.75) {
      c = mix(vec3(0.8, 0.2, 0.0), vec3(1.0, 0.8, 0.0), (t - 0.5) * 4.0);
    } else {
      c = mix(vec3(1.0, 0.8, 0.0), vec3(1.0, 1.0, 1.0), (t - 0.75) * 4.0);
    }
    return c;
  }

  void main() {
    vec4 color = texture(colorTexture, v_textureCoordinates);
    float luminance = dot(color.rgb, vec3(0.299, 0.587, 0.114));
    // Invert for white-hot (bright objects = hot)
    luminance = clamp(luminance * 1.3, 0.0, 1.0);
    vec3 thermal = thermalPalette(luminance);

    // Crosshair overlay
    vec2 center = vec2(0.5, 0.5);
    vec2 uv = v_textureCoordinates;
    float dist = length(uv - center);

    // Targeting reticle
    float ring = smoothstep(0.002, 0.0, abs(dist - 0.15));
    ring += smoothstep(0.001, 0.0, abs(uv.x - 0.5)) * step(abs(uv.y - 0.5), 0.18);
    ring += smoothstep(0.001, 0.0, abs(uv.y - 0.5)) * step(abs(uv.x - 0.5), 0.18);
    thermal = mix(thermal, vec3(0.0, 1.0, 0.0), ring * 0.3);

    out_FragColor = vec4(thermal, 1.0);
  }
`;

/**
 * CRT Scan Lines Shader — retro surveillance monitor.
 * Green phosphor tint, scan lines, vignette, subtle noise.
 */
export const CRT_SHADER = `
  uniform sampler2D colorTexture;
  in vec2 v_textureCoordinates;

  float random(vec2 st) {
    return fract(sin(dot(st.xy, vec2(12.9898, 78.233))) * 43758.5453123);
  }

  void main() {
    vec2 uv = v_textureCoordinates;
    vec4 color = texture(colorTexture, uv);

    // Convert to luminance
    float lum = dot(color.rgb, vec3(0.299, 0.587, 0.114));
    lum = clamp(lum * 1.2, 0.0, 1.0);

    // Green phosphor tint
    vec3 crt = vec3(lum * 0.15, lum * 0.9, lum * 0.2);

    // Scan lines (horizontal)
    float scanLine = sin(uv.y * 800.0) * 0.5 + 0.5;
    scanLine = mix(0.85, 1.0, scanLine);
    crt *= scanLine;

    // Subtle vertical bars (RGB subpixels)
    float subpixel = sin(uv.x * 1200.0) * 0.5 + 0.5;
    subpixel = mix(0.95, 1.0, subpixel);
    crt *= subpixel;

    // Film grain / noise (animated using Cesium frame number)
    float noise = random(uv + fract(float(czm_frameNumber) * 0.001)) * 0.06;
    crt += noise;

    // Vignette
    float vignette = smoothstep(0.8, 0.3, length(uv - 0.5));
    crt *= mix(0.4, 1.0, vignette);

    // Slight barrel distortion simulation via brightness falloff
    float cornerDist = length((uv - 0.5) * 2.0);
    crt *= 1.0 - cornerDist * 0.1;

    out_FragColor = vec4(crt, 1.0);
  }
`;

/**
 * Apply a post-process shader to the Cesium scene.
 * Returns the stage reference for later removal.
 */
export function applyShader(viewer: CesiumRef, Cesium: CesiumRef, fragmentShader: string): CesiumRef {
  const stage = new Cesium.PostProcessStage({ fragmentShader });
  viewer.scene.postProcessStages.add(stage);
  return stage;
}

/**
 * Remove a post-process shader from the Cesium scene.
 */
export function removeShader(viewer: CesiumRef, stage: CesiumRef): void {
  if (stage) {
    try { viewer.scene.postProcessStages.remove(stage); } catch (e) { logger.swallow("shaders:remove-stage", e); }
  }
}
