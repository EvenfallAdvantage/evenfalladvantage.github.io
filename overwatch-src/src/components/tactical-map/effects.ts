/**
 * Post-process effects ported from gods-eye-view (© 2026 Bilawal Sidhu, MIT —
 * see docs/THIRD-PARTY-NOTICES.md). GLSL is copied verbatim from
 * src/styles/surveillance.js (NVG), src/styles/noir.js and
 * src/ui/visualPresets.js (sharpen); uniform plumbing is Overwatch's own.
 * @module
 */
import { logger } from "@/lib/logger";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type CesiumNs = any;

export interface EffectSpec {
  name: string;
  fragmentShader: string;
  uniforms: Record<string, number>;
  /** True if the shader animates with a `time` uniform (needs a render pump). */
  animated: boolean;
}

/** PVS-14 style image-intensifier (NVG goggles). */
export const NVG_EFFECT: EffectSpec = {
  name: "ow_gev_nvg",
  animated: true,
  uniforms: { intensity: 1, gain: 0.35, bloom: 0.15, scanlineStr: 0.6, pixelation: 1.5, chroma: 0.75 },
  fragmentShader: `
    uniform sampler2D colorTexture;
    uniform vec2 colorTextureDimensions;
    uniform float intensity;
    uniform float time;
    uniform float gain;
    uniform float bloom;
    uniform float scanlineStr;
    uniform float pixelation;
    uniform float chroma;
    in vec2 v_textureCoordinates;

    // ── Noise functions ───────────────────────────────────
    float hash(vec2 p) {
      vec3 p3 = fract(vec3(p.xyx) * 0.1031);
      p3 += dot(p3, p3.yzx + 33.33);
      return fract((p3.x + p3.y) * p3.z);
    }

    float valueNoise(vec2 p) {
      vec2 i = floor(p);
      vec2 f = fract(p);
      f = f * f * (3.0 - 2.0 * f);
      float a = hash(i);
      float b = hash(i + vec2(1.0, 0.0));
      float c = hash(i + vec2(0.0, 1.0));
      float d = hash(i + vec2(1.0, 1.0));
      return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
    }

    // ── Barrel distortion (NVG lens) ──────────────────────
    vec2 barrelDistort(vec2 uv, float strength) {
      vec2 c = uv * 2.0 - 1.0;
      float r2 = dot(c, c);
      float distort = 1.0 + r2 * strength * 0.5 + r2 * r2 * strength * 0.15;
      c *= distort;
      return c * 0.5 + 0.5;
    }

    // ── Honeycomb pattern (fiber optic plate texture) ─────
    float honeycomb(vec2 uv) {
      vec2 dims = colorTextureDimensions;
      float scale = min(dims.x, dims.y) * 0.008;
      vec2 p = uv * dims * scale;
      // Hex grid
      vec2 r = vec2(1.0, 1.732);
      vec2 h = r * 0.5;
      vec2 a = mod(p, r) - h;
      vec2 b = mod(p - h, r) - h;
      vec2 gv = dot(a, a) < dot(b, b) ? a : b;
      float d = max(abs(gv.x), abs(gv.y * 0.577 + abs(gv.x) * 0.5));
      return smoothstep(0.4, 0.45, d);
    }

    // ── 7-segment digit renderer ──────────────────────────
    float segment(vec2 p, int seg) {
      float s = 0.0;
      if (seg == 0) s = step(0.2, p.x) * step(p.x, 0.8) * step(0.85, p.y) * step(p.y, 1.0);
      if (seg == 1) s = step(0.7, p.x) * step(p.x, 0.9) * step(0.5, p.y) * step(p.y, 0.95);
      if (seg == 2) s = step(0.7, p.x) * step(p.x, 0.9) * step(0.05, p.y) * step(p.y, 0.5);
      if (seg == 3) s = step(0.2, p.x) * step(p.x, 0.8) * step(0.0, p.y) * step(p.y, 0.15);
      if (seg == 4) s = step(0.1, p.x) * step(p.x, 0.3) * step(0.05, p.y) * step(p.y, 0.5);
      if (seg == 5) s = step(0.1, p.x) * step(p.x, 0.3) * step(0.5, p.y) * step(p.y, 0.95);
      if (seg == 6) s = step(0.2, p.x) * step(p.x, 0.8) * step(0.42, p.y) * step(p.y, 0.58);
      return s;
    }

    float digit(vec2 p, int d) {
      int masks[10] = int[10](0x7E, 0x30, 0x6D, 0x79, 0x33, 0x5B, 0x5F, 0x70, 0x7F, 0x7B);
      int m = masks[d];
      float s = 0.0;
      for (int i = 0; i < 7; i++) {
        if ((m >> (6 - i) & 1) == 1) s += segment(p, i);
      }
      return clamp(s, 0.0, 1.0);
    }

    // Render HH:MM:SS timestamp
    float renderTimestamp(vec2 uv) {
      vec2 tsOrigin = vec2(0.02, 0.03);
      vec2 tsSize = vec2(0.22, 0.035);
      vec2 p = (uv - tsOrigin) / tsSize;
      if (p.x < 0.0 || p.x > 1.0 || p.y < 0.0 || p.y > 1.0) return 0.0;

      int totalSec = int(mod(time, 86400.0));
      int hours = totalSec / 3600;
      int minutes = (totalSec % 3600) / 60;
      int seconds = totalSec % 60;

      float charWidth = 1.0 / 8.5;
      int charIdx = int(p.x / charWidth);
      float localX = mod(p.x, charWidth) / charWidth;
      vec2 localP = vec2(localX, p.y);

      int dv = -1;
      if (charIdx == 0) dv = hours / 10;
      else if (charIdx == 1) dv = hours % 10;
      else if (charIdx == 2) return (step(0.3, localP.x) * step(localP.x, 0.7)) *
                                    (step(0.2, localP.y) * step(localP.y, 0.4) + step(0.6, localP.y) * step(localP.y, 0.8));
      else if (charIdx == 3) dv = minutes / 10;
      else if (charIdx == 4) dv = minutes % 10;
      else if (charIdx == 5) return (step(0.3, localP.x) * step(localP.x, 0.7)) *
                                    (step(0.2, localP.y) * step(localP.y, 0.4) + step(0.6, localP.y) * step(localP.y, 0.8));
      else if (charIdx == 6) dv = seconds / 10;
      else if (charIdx == 7) dv = seconds % 10;

      if (dv < 0 || dv > 9) return 0.0;
      return digit(localP, dv);
    }

    // ── Crosshair (thin, subtle NVG reticle) ──────────────
    float crosshair(vec2 uv) {
      vec2 c = uv - 0.5;
      float h = smoothstep(0.001, 0.0004, abs(c.y)) *
                step(0.01, abs(c.x)) * step(abs(c.x), 0.025);
      float v = smoothstep(0.001, 0.0004, abs(c.x)) *
                step(0.01, abs(c.y)) * step(abs(c.y), 0.025);
      return clamp(h + v, 0.0, 1.0);
    }

    void main() {
      vec2 uv = v_textureCoordinates;
      vec2 dims = colorTextureDimensions;
      vec2 texel = 1.0 / dims;

      // ── Barrel distortion (NVG lens distortion) ─────────
      float dist = 0.5 * intensity;
      vec2 distUV = barrelDistort(uv, dist);

      // ── Circular vignette mask (NVG tube field of view) ──
      vec2 centered = uv * 2.0 - 1.0;
      float aspect = dims.x / dims.y;
      centered.x *= aspect;
      float radius = length(centered);
      float tubeMask = pow(1.0 - smoothstep(0.95, 1.35, radius), 0.7);
      // Tube brightness falloff (center brightest)
      float tubeShading = 1.0 - radius * radius * 0.15;
      tubeShading = max(tubeShading, 0.0);

      // If outside tube, render black
      if (tubeMask < 0.001) {
        out_FragColor = vec4(vec3(0.0), 1.0);
        return;
      }

      // Black outside distorted area
      if (distUV.x < 0.0 || distUV.x > 1.0 || distUV.y < 0.0 || distUV.y > 1.0) {
        out_FragColor = vec4(vec3(0.0), 1.0);
        return;
      }

      // ── Intensifier tube resolution pixelation ────────────
      float pixSize = mix(1.0, pixelation, intensity);
      vec2 snappedUV = floor(distUV * dims / pixSize) * pixSize / dims;
      distUV = mix(distUV, snappedUV, intensity);

      vec4 original = texture(colorTexture, distUV);

      // ── Luminance ───────────────────────────────────────
      float luma = dot(original.rgb, vec3(0.299, 0.587, 0.114));

      // ── Auto-gain response ──────────────────────────────
      // Moderate gain (old 0.8–2.5 range clipped most of the scene to white).
      float gainLevel = mix(0.8, 1.6, gain);

      // ── Intensifier tube bloom + local mean ─────────────
      // Bloom only from genuinely bright sources (>0.75) so the scene doesn't wash out.
      float bloomAccum = 0.0;
      float meanAccum = 0.0;
      float bloomW = 0.0;
      for (int y = -5; y <= 5; y++) {
        for (int x = -5; x <= 5; x++) {
          vec2 offset = vec2(float(x), float(y)) * texel * 4.0;
          float sLuma = dot(texture(colorTexture, distUV + offset).rgb, vec3(0.299, 0.587, 0.114));
          float bright = smoothstep(0.75, 1.0, sLuma * gainLevel);
          float w = exp(-float(x * x + y * y) / 18.0);
          bloomAccum += bright * w;
          meanAccum += sLuma * w;
          bloomW += w;
        }
      }
      bloomAccum /= bloomW;
      float localMean = meanAccum / bloomW;

      // Local contrast (unsharp) + S-curve so roads/edges separate from terrain.
      float detail = luma + (luma - localMean) * 1.2;
      float amplified = clamp(detail * gainLevel, 0.0, 1.0);
      amplified = mix(amplified, amplified * amplified * (3.0 - 2.0 * amplified), 0.6);

      // Edge glow / corona on bright objects
      float corona = bloomAccum * bloom;

      // ── P43 phosphor green (530nm) ──────────────────────
      vec3 phosphor = vec3(0.16, 1.0, 0.22);
      vec3 nvgColor = phosphor * (amplified + corona);

      // ── Scintillation (image intensifier sparkle noise) ──
      // Base tube grain (slow, coherent)
      vec2 grainCoord = uv * 120.0 + vec2(time * 0.5, time * 0.3);
      float tubeGrain = valueNoise(grainCoord);
      tubeGrain = (tubeGrain - 0.5) * mix(0.06, 0.2, gain) * intensity;
      nvgColor += phosphor * tubeGrain;

      // More noise in dark areas (real gain response)
      float darkNoise = (1.0 - amplified) * hash(uv * dims + vec2(time * 200.0, time * 300.0));
      nvgColor += phosphor * darkNoise * 0.08 * gain * intensity;

      // ── Honeycomb fiber optic plate ─────────────────────
      float hc = honeycomb(distUV);
      nvgColor *= 1.0 - hc * 0.04 * intensity; // very subtle

      // ── Scanlines (subtle, from the display) ────────────
      float scanline = sin(distUV.y * dims.y * 1.2 + time * 2.0) * 0.5 + 0.5;
      scanline = pow(scanline, 2.5);
      nvgColor *= 1.0 - scanline * scanlineStr * 0.15 * intensity;

      // ── Tube shading (brightness falloff from center) ───
      nvgColor *= tubeShading;

      // ── Circular vignette (dark edges, NVG tube shape) ──
      nvgColor *= tubeMask;

      // ── HUD Overlay ─────────────────────────────────────

      // Top-left: "NVG" / "I²" label marker
      vec2 labelArea = (uv - vec2(0.03, 0.92)) / vec2(0.06, 0.03);
      if (labelArea.x >= 0.0 && labelArea.x <= 1.0 && labelArea.y >= 0.0 && labelArea.y <= 1.0) {
        float lbl = step(0.1, labelArea.x) * step(labelArea.x, 0.9) *
                    step(0.2, labelArea.y) * step(labelArea.y, 0.8);
        nvgColor += phosphor * lbl * 0.3 * intensity;
      }

      // Gain indicator below label: "AUTO" marker (i18n-ignore: shader comment, not UI)
      vec2 gainArea = (uv - vec2(0.03, 0.88)) / vec2(0.05, 0.025);
      if (gainArea.x >= 0.0 && gainArea.x <= 1.0 && gainArea.y >= 0.0 && gainArea.y <= 1.0) {
        float gLbl = step(0.1, gainArea.x) * step(gainArea.x, 0.9) *
                     step(0.2, gainArea.y) * step(gainArea.y, 0.8);
        nvgColor += phosphor * gLbl * 0.2 * intensity;
      }

      // Center crosshair (thin, subtle)
      float ch = crosshair(uv);
      nvgColor += phosphor * ch * 0.4 * intensity;

      // Bottom-left: Timestamp (7-segment)
      float ts = renderTimestamp(uv);
      nvgColor += phosphor * ts * 0.6 * intensity;

      // REC indicator — top-right (blinking)
      vec2 recPos = uv - vec2(0.95, 0.94);
      float recDot = smoothstep(0.008, 0.004, length(recPos));
      float blink = step(0.5, fract(time * 0.8));
      // REC dot in slightly warmer green
      nvgColor += vec3(0.3, 1.0, 0.2) * recDot * blink * intensity;

      // ── Chroma preserve: strongly saturated pixels (entity category colours,
      // UI accents) keep their hue so aircraft/ship/satellite stay distinguishable.
      float sat = max(original.r, max(original.g, original.b)) - min(original.r, min(original.g, original.b));
      float keep = smoothstep(0.3, 0.6, sat) * chroma;
      vec3 boosted = original.rgb / max(max(original.r, max(original.g, original.b)), 0.001) * max(amplified, 0.7);
      nvgColor = mix(nvgColor, boosted, keep);

      // ── Final composite ─────────────────────────────────
      nvgColor = clamp(nvgColor, 0.0, 1.0);

      // Keep NVG output fully tube-masked at full intensity to avoid color bleed at the lens edge.
      vec3 finalColor = mix(original.rgb, nvgColor * tubeMask, intensity);

      out_FragColor = vec4(finalColor, 1.0);
    }
  `,
};

/** Film noir: desaturate + S-curve contrast + grain + vignette. */
export const NOIR_EFFECT: EffectSpec = {
  name: "ow_gev_noir",
  animated: false,
  uniforms: { intensity: 1, contrastAmt: 1.2, grainAmt: 0.5, vignetteAmt: 0.5 },
  fragmentShader: `
    uniform sampler2D colorTexture;
    uniform vec2 colorTextureDimensions;
    uniform float intensity;
    uniform float contrastAmt;
    uniform float grainAmt;
    uniform float vignetteAmt;
    in vec2 v_textureCoordinates;

    void main() {
      vec2 uv = v_textureCoordinates;
      vec4 color = texture(colorTexture, uv);

      // Desaturate
      float luma = dot(color.rgb, vec3(0.299, 0.587, 0.114));
      vec3 gray = vec3(luma);
      vec3 desaturated = mix(color.rgb, gray, intensity);

      // High contrast with S-curve (driven by contrastAmt uniform)
      float contrast = 1.0 + contrastAmt * intensity;
      vec3 contrasted = (desaturated - 0.5) * contrast + 0.5;
      contrasted = clamp(contrasted, 0.0, 1.0);

      // Film grain (driven by grainAmt uniform)
      float grain = fract(sin(dot(uv * colorTextureDimensions, vec2(12.9898, 78.233))) * 43758.5453);
      grain = (grain - 0.5) * 0.08 * grainAmt * intensity;
      contrasted += grain;

      // Vignette (driven by vignetteAmt uniform)
      vec2 vigUV = uv * (1.0 - uv);
      float vig = vigUV.x * vigUV.y * 16.0;
      vig = pow(vig, 0.3 + 0.4 * vignetteAmt * intensity);

      // Slight sepia tint for warmth
      vec3 sepia = vec3(
        dot(contrasted, vec3(0.393, 0.769, 0.189)),
        dot(contrasted, vec3(0.349, 0.686, 0.168)),
        dot(contrasted, vec3(0.272, 0.534, 0.131))
      );
      vec3 tinted = mix(contrasted, sepia, 0.15 * intensity);

      vec3 result = tinted * vig;
      out_FragColor = vec4(mix(color.rgb, result, intensity), color.a);
    }
  `,
};

/** 3x3 unsharp mask. */
export const SHARPEN_EFFECT: EffectSpec = {
  name: "ow_gev_sharpen",
  animated: false,
  uniforms: { amount: 1.3 },
  fragmentShader: `
  uniform sampler2D colorTexture;
  uniform vec2 colorTextureDimensions;
  uniform float amount;
  in vec2 v_textureCoordinates;

  void main() {
    vec2 uv = v_textureCoordinates;
    vec2 texel = 1.0 / colorTextureDimensions;
    vec4 center = texture(colorTexture, uv);
    vec4 blur = (
      texture(colorTexture, uv + vec2(-texel.x, -texel.y)) +
      texture(colorTexture, uv + vec2( 0.0,     -texel.y)) +
      texture(colorTexture, uv + vec2( texel.x, -texel.y)) +
      texture(colorTexture, uv + vec2(-texel.x,  0.0))     +
      center +
      texture(colorTexture, uv + vec2( texel.x,  0.0))     +
      texture(colorTexture, uv + vec2(-texel.x,  texel.y)) +
      texture(colorTexture, uv + vec2( 0.0,      texel.y)) +
      texture(colorTexture, uv + vec2( texel.x,  texel.y))
    ) / 9.0;
    vec4 sharpened = center + (center - blur) * amount;
    out_FragColor = vec4(clamp(sharpened.rgb, 0.0, 1.0), center.a);
  }
`,
};

/** UTC seconds-of-day (drives NVG noise animation and its HH:MM:SS readout). */
function nowSeconds(): number {
  return (Date.now() / 1000) % 86400;
}

/** Add an effect stage; returns it for removal (null if the GPU can't run it). */
export function addEffect(viewer: CesiumNs, Cesium: CesiumNs, spec: EffectSpec): CesiumNs {
  // GEV's GLSL uses GLSL ES 3.00 features (int arrays, bit shifts): WebGL2 only.
  // A failed post-process compile would stop the whole globe rendering.
  if (viewer?.scene?.context && viewer.scene.context.webgl2 === false) {
    logger.swallow("effects:webgl1", new Error(`${spec.name} needs WebGL2`), "warn");
    return null;
  }
  const uniforms: Record<string, unknown> = { ...spec.uniforms };
  if (spec.animated) uniforms.time = nowSeconds;
  const stage = new Cesium.PostProcessStage({ name: `${spec.name}_${Math.random().toString(36).slice(2, 8)}`, fragmentShader: spec.fragmentShader, uniforms });
  viewer.scene.postProcessStages.add(stage);
  viewer.scene.requestRender();
  return stage;
}

export function removeEffect(viewer: CesiumNs, stage: CesiumNs): void {
  if (!stage) return;
  try { viewer.scene.postProcessStages.remove(stage); viewer.scene.requestRender(); }
  catch (e) { logger.swallow("effects:remove", e); }
}

/** Cesium's built-in bloom, tuned like gods-eye-view's default. */
export function setBloom(viewer: CesiumNs, on: boolean): void {
  const bloom = viewer?.scene?.postProcessStages?.bloom;
  if (!bloom) return;
  bloom.enabled = on;
  if (on) {
    Object.assign(bloom.uniforms, { glowOnly: false, contrast: 128.0, brightness: -0.3, delta: 1.0, sigma: 2.0, stepSize: 1.0 });
  }
  viewer.scene.requestRender();
}

// ─── Screen overlays (sonar sweep, scope mask) ─────────────────────
// Overwatch's own GLSL, modelled on gods-eye-view's cyber-sonar sweep
// (src/cyberSonar.js: 5.2 s period, 24° sector, feathered trailing edge,
// contacts dimmed between passes) and its circular scope mask
// (src/scopeMask.js, ui/styles/foundation.css #scope-mask). MIT, see
// docs/THIRD-PARTY-NOTICES.md. Both are drawn last, after the look stages.

/** Rotating sonar sector with range rings, centred on the screen (the tracked target when tracking). */
export const SONAR_EFFECT: EffectSpec = {
  name: "ow_gev_sonar",
  animated: true,
  uniforms: { periodSec: 5.2, sectorDeg: 24, rings: 6, dim: 0.84 },
  fragmentShader: `
    uniform sampler2D colorTexture;
    uniform vec2 colorTextureDimensions;
    uniform float time;
    uniform float periodSec;
    uniform float sectorDeg;
    uniform float rings;
    uniform float dim;
    in vec2 v_textureCoordinates;

    void main() {
      vec2 uv = v_textureCoordinates;
      vec4 color = texture(colorTexture, uv);
      vec2 px = (uv - 0.5) * colorTextureDimensions;
      float r = length(px) / (0.5 * min(colorTextureDimensions.x, colorTextureDimensions.y));
      float ang = atan(px.x, px.y);                      // 0 = up, clockwise
      float sweep = fract(time / periodSec) * 6.2831853;
      float behind = mod(sweep - ang + 6.2831853, 6.2831853);
      float sector = radians(sectorDeg);
      float trail = 1.0 - smoothstep(0.0, sector, behind);
      float edge = 1.0 - smoothstep(0.0, 0.012, behind);
      float inside = 1.0 - smoothstep(0.98, 1.0, r);
      float ring = (1.0 - smoothstep(0.0, 0.006, abs(fract(r * rings + 0.5) - 0.5) / rings)) * inside * 0.35;
      vec3 base = color.rgb * mix(dim, 1.0, trail * inside);
      vec3 tint = vec3(0.35, 1.0, 0.75);
      base += tint * (trail * 0.3 + edge * 0.55) * inside;
      base = mix(base, tint, ring);
      out_FragColor = vec4(base, color.a);
    }
  `,
};

/** Circular scope aperture: feathered black mask, mil-dot crosshair and a range ring. */
export const SCOPE_EFFECT: EffectSpec = {
  name: "ow_gev_scope",
  animated: false,
  uniforms: { radius: 0.92, feather: 0.06 },
  fragmentShader: `
    uniform sampler2D colorTexture;
    uniform vec2 colorTextureDimensions;
    uniform float radius;
    uniform float feather;
    in vec2 v_textureCoordinates;

    void main() {
      vec2 uv = v_textureCoordinates;
      vec4 color = texture(colorTexture, uv);
      float half_ = 0.5 * min(colorTextureDimensions.x, colorTextureDimensions.y);
      vec2 px = (uv - 0.5) * colorTextureDimensions;
      float r = length(px) / half_;
      float aperture = 1.0 - smoothstep(radius - feather, radius, r);
      // Lens falloff toward the rim
      vec3 c = color.rgb * mix(0.72, 1.0, 1.0 - smoothstep(0.35, radius, r));
      float w = 1.2 / half_;
      float cross_ = (1.0 - smoothstep(0.0, w, abs(px.x) / half_)) + (1.0 - smoothstep(0.0, w, abs(px.y) / half_));
      float gap = smoothstep(0.05, 0.07, r);              // open centre
      cross_ *= gap * step(r, radius - feather);
      float dots = 0.0;
      for (int i = 1; i <= 8; i++) {
        float d = float(i) * 0.1;
        dots += (1.0 - smoothstep(0.0, 3.0 * w, length(vec2(abs(px.x) / half_ - d, px.y / half_))));
        dots += (1.0 - smoothstep(0.0, 3.0 * w, length(vec2(px.x / half_, abs(px.y) / half_ - d))));
      }
      float ring = 1.0 - smoothstep(0.0, w, abs(r - (radius - feather - 0.01)));
      vec3 ink = vec3(0.02);
      c = mix(c, ink, clamp(cross_ + dots, 0.0, 1.0) * 0.85);
      c = mix(c, vec3(0.6, 0.9, 0.8), ring * 0.5);
      out_FragColor = vec4(c * aperture, color.a);
    }
  `,
};
