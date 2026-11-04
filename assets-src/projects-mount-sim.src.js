// SynScope mount simulator (projects/synscope.html). Built with esbuild from three@0.170.0:
//   esbuild assets-src/projects-mount-sim.src.js --bundle --format=esm --minify --outfile=js/projects/mount-sim.js
// Same infrastructure as explode-viewer: Draco, render on demand, DPR cap 1.5, paused off-screen,
// poster crossfade, ?perf=1. Interaction: orbit around the pod, Mount toggle eases the pod pose,
// knob click cycles screen modes, hold or wheel-over-knob sets brightness.
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

const REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const BLOCKED = new THREE.Color('#e5484d'), CLEAR = new THREE.Color('#dd8c33');
const DETENT = THREE.MathUtils.degToRad(30), HOLD_MS = 350, POSE_MS = 500;
const ease = t => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

export async function mount(root) {
  const frame = root.querySelector('.mx-frame');
  const modeEl = root.querySelector('.mx-mode'), eyeBtn = root.querySelector('.mx-eye'), hint = root.querySelector('#mx-hint');
  const base = frame.dataset.screens;
  const parts = await fetch(frame.dataset.parts).then(r => r.json());

  const DPR = Math.min(window.devicePixelRatio || 1, 1.5);
  const renderer = new THREE.WebGLRenderer({ antialias: (window.devicePixelRatio || 1) < 1.5, alpha: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(DPR);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  const canvas = renderer.domElement;
  canvas.className = 'mx-canvas';
  canvas.setAttribute('role', 'img');
  canvas.setAttribute('aria-label', 'Interactive 3D model of the SynScope pod mounted on an M4 carbine');
  frame.appendChild(canvas);
  const PERF = /[?&]perf=1/.test(location.search) ? perfOverlay(frame) : null;

  const scene = new THREE.Scene();
  scene.add(new THREE.HemisphereLight(0xffffff, 0x445566, 2.0));
  const key = new THREE.DirectionalLight(0xffffff, 2.6); key.position.set(2, 4, 3); scene.add(key);
  const rim = new THREE.DirectionalLight(0xffd9b0, 1.2); rim.position.set(-3, 2, -3); scene.add(rim);
  const dc = parts.default_camera;
  const camera = new THREE.PerspectiveCamera(dc.fov_deg_vertical || 32, 16 / 9, dc.near || 0.01, dc.far || 10);

  // Wheel over the knob/pod adjusts brightness. Registered BEFORE OrbitControls so it can stop the zoom.
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
  let knobHit = () => false;
  canvas.addEventListener('wheel', ev => {
    if (!knobHit(ev)) return;
    ev.preventDefault(); ev.stopImmediatePropagation();
    setBright(bright - Math.sign(ev.deltaY) * 0.1); turnKnob(-Math.sign(ev.deltaY) * DETENT / 2);
  }, { passive: false });

  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = !REDUCED; controls.enablePan = false; controls.enableZoom = true;
  const off = new THREE.Vector3(...dc.offset_from_target);
  controls.minDistance = off.length() * 0.3; controls.maxDistance = off.length() * 2.5;

  const draco = new DRACOLoader().setDecoderPath('/js/vendor/draco/');
  const gltf = await new GLTFLoader().setDRACOLoader(draco).loadAsync(frame.dataset.model);
  const model = gltf.scene; scene.add(model);
  const N = n => model.getObjectByName(n);
  const pod = N(parts.mount_node || 'pod_mount'), arm = N('offset_arm'), knob = N('knob'), body = N('pod_body'), screen = N('screen'), sight = N('sightline'), orbitT = N('orbit_target');

  // Poses: use parts.json mount_poses (root-local == world).
  const poses = {};
  for (const k of ['toprail', 'offset45']) { const p = parts.mount_poses[k]; poses[k] = { t: new THREE.Vector3(...p.translation), q: new THREE.Quaternion(...p.rotation_quat) }; }

  // Screen material: own clone, emissive texture per mode, UV rotation per pose.
  let smat = null; screen.traverse(o => { if (o.isMesh) { o.material = o.material.clone(); smat = o.material; } });
  const baseEI = smat.emissiveIntensity || 1;
  const order = parts.screen_modes.order, modes = parts.screen_modes.modes, uvRot = parts.screen.uv_rotation_deg;
  const tl = new THREE.TextureLoader(), tex = {};
  await Promise.all(order.map(m => tl.loadAsync(base + modes[m].texture).then(t => { t.flipY = false; t.colorSpace = THREE.SRGBColorSpace; t.center.set(.5, .5); t.anisotropy = 4; tex[m] = t; })));
  let modeIdx = Math.max(0, order.indexOf(parts.screen_modes.default));
  function applyMode() {
    const t = tex[order[modeIdx]];
    smat.emissiveTexture = t; if (smat.map) smat.map = t;
    smat.needsUpdate = true;
    modeEl.hidden = false; modeEl.textContent = 'Screen: ' + modes[order[modeIdx]].label;
    kick();
  }
  function setUV(deg) { for (const m of order) tex[m].rotation = THREE.MathUtils.degToRad(deg); }

  let smatSL = null; sight.traverse(o => { if (o.isMesh) { o.material = o.material.clone(); smatSL = o.material; } });
  let kmats = []; knob.traverse(o => { if (o.isMesh) { o.material = o.material.clone(); kmats.push(o.material); } });

  let bright = 1; // multiplier on the authored emissive intensity
  function setBright(b) { bright = Math.min(2.2, Math.max(0.15, b)); smat.emissiveIntensity = baseEI * bright; root.dataset.bright = bright.toFixed(2); kick(); }
  let knobTarget = knob.rotation.x;
  function turnKnob(d) { knobTarget += d; kick(); }

  // Pose animation
  let poseName = null, anim = null;
  const tgt = new THREE.Vector3(), prevTgt = new THREE.Vector3();
  function podTarget(v) { model.updateMatrixWorld(true); return orbitT.getWorldPosition(v); }
  let raf = 0, visible = false, dirty = true, W = 1, H = 1, lastT = 0;
  function setPose(name, instant) {
    if (name === poseName) return;
    const from = { t: pod.position.clone(), q: pod.quaternion.clone(), uv: poseName ? uvRot[poseName] : uvRot[name] };
    poseName = name;
    arm.visible = name === 'offset45';
    const blocked = parts.sightline.blocked[name];
    anim = { from, to: poses[name], uv: uvRot[name], c0: smatSL.color.clone(), c1: blocked ? BLOCKED : CLEAR, t0: performance.now(), dur: instant || REDUCED ? 0 : POSE_MS };
    root.dataset.simPose = name;
    kick();
  }
  function stepPose(now) {
    if (!anim) return false;
    const k = anim.dur ? Math.min(1, (now - anim.t0) / anim.dur) : 1, e = ease(k);
    pod.position.lerpVectors(anim.from.t, anim.to.t, e);
    pod.quaternion.slerpQuaternions(anim.from.q, anim.to.q, e);
    setUV(anim.from.uv + (anim.uv - anim.from.uv) * e);
    smatSL.color.copy(anim.c0).lerp(anim.c1, e);
    if (k >= 1) anim = null;
    return true;
  }

  // Camera: initial offset from the pod target; the orbit target follows the pod (camera keeps its offset).
  const initPose = root.querySelector('input[name="mountpos"]:checked').value === 'top' ? 'toprail' : 'offset45';
  pod.position.copy(poses[initPose].t); pod.quaternion.copy(poses[initPose].q);
  setPose(initPose, true); stepPose(performance.now());
  podTarget(tgt); controls.target.copy(tgt); prevTgt.copy(tgt);
  camera.position.copy(tgt).add(off); controls.update();

  root.addEventListener('change', ev => { if (ev.target.name === 'mountpos') setPose(ev.target.value === 'top' ? 'toprail' : 'offset45'); });

  // Shooter's eye preset: behind the rear sight, on the sightline, looking at the pod.
  if (eyeBtn) {
    eyeBtn.hidden = false;
    eyeBtn.addEventListener('click', () => {
      const s = parts.sightline.from; podTarget(tgt);
      camAnim = { p0: camera.position.clone(), p1: new THREE.Vector3(s[0], s[1] + 0.012, s[2] + 0.22), t0: performance.now(), dur: REDUCED ? 0 : 600 };
      kick();
    });
  }
  let camAnim = null;

  // Knob interaction: hover highlight, click cycles mode, hold ramps brightness.
  const interactive = [knob, body];
  function pick(ev) {
    const r = canvas.getBoundingClientRect();
    ndc.set(((ev.clientX - r.left) / r.width) * 2 - 1, -((ev.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    const h = ray.intersectObject(model, true)[0];
    let o = h && h.object; while (o && !interactive.includes(o)) o = o.parent;
    return o || null;
  }
  knobHit = ev => !!pick(ev);
  let hover = false;
  function setHover(on) {
    if (on === hover) return; hover = on;
    canvas.classList.toggle('is-knob', on);
    for (const m of kmats) { if (m.emissive) m.emissive.setHex(on ? 0xdd8c33 : 0); m.emissiveIntensity = on ? 0.5 : (m.emissiveIntensity || 0); if (!on) m.emissiveIntensity = 0; }
    kick();
  }
  let hovEv = null, hovRaf = 0;
  canvas.addEventListener('pointermove', ev => {
    if (ev.pointerType !== 'mouse' || ev.buttons) return;
    hovEv = ev; if (hovRaf) return;
    hovRaf = requestAnimationFrame(() => { hovRaf = 0; setHover(!!pick(hovEv)); });
  });
  canvas.addEventListener('pointerleave', () => setHover(false));

  let press = null, ramp = null;
  canvas.addEventListener('pointerdown', ev => {
    if (!pick(ev)) return;
    controls.enabled = false; // don't orbit while operating the knob
    try { canvas.setPointerCapture(ev.pointerId); } catch (e) {}
    press = { id: ev.pointerId, timer: setTimeout(() => { ramp = { dir: bright >= 2.2 ? -1 : 1, last: performance.now() }; root.dataset.holding = '1'; kick(); }, HOLD_MS) };
  }, true);
  const release = ev => {
    if (!press || ev.pointerId !== press.id) return;
    clearTimeout(press.timer); press = null;
    if (ramp) { ramp = null; delete root.dataset.holding; }
    else if (ev.type === 'pointerup') { modeIdx = (modeIdx + 1) % order.length; root.dataset.mode = order[modeIdx]; turnKnob(DETENT); applyMode(); }
    controls.enabled = true;
  };
  canvas.addEventListener('pointerup', release); canvas.addEventListener('pointercancel', release);
  canvas.addEventListener('contextmenu', ev => { if (press) ev.preventDefault(); });

  // Render on demand.
  function live() { return visible && !document.hidden; }
  function kick() { dirty = true; if (!raf && live()) raf = requestAnimationFrame(tick); }
  controls.addEventListener('change', kick);
  const resize = () => { const w = frame.clientWidth, h = frame.clientHeight; if (!w || !h) return; W = w; H = h; renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); kick(); };
  new ResizeObserver(resize).observe(frame);
  new IntersectionObserver(es => { visible = es[0].isIntersecting; if (live()) kick(); else if (raf) { cancelAnimationFrame(raf); raf = 0; lastT = 0; } }).observe(frame);
  document.addEventListener('visibilitychange', () => { if (live()) kick(); });
  const lastCam = new THREE.Matrix4();
  function tick(t) {
    raf = 0;
    const dt = Math.min(0.1, lastT ? (t - lastT) / 1000 : 0.016); lastT = t;
    let moving = stepPose(t);
    // Orbit target follows the pod; shift the camera by the same delta to keep the view offset.
    podTarget(tgt);
    if (!tgt.equals(prevTgt)) { const d = tgt.clone().sub(prevTgt); camera.position.add(d); controls.target.copy(tgt); prevTgt.copy(tgt); moving = true; }
    if (camAnim) { const k = camAnim.dur ? Math.min(1, (t - camAnim.t0) / camAnim.dur) : 1; camera.position.lerpVectors(camAnim.p0, camAnim.p1, ease(k)); if (k >= 1) camAnim = null; moving = true; }
    if (Math.abs(knobTarget - knob.rotation.x) > 1e-3) { knob.rotation.x += (knobTarget - knob.rotation.x) * (1 - Math.exp(-dt * 18)); moving = true; } else knob.rotation.x = knobTarget;
    if (ramp) { let b = bright + ramp.dir * dt * 0.9; if (b >= 2.2 || b <= 0.15) ramp.dir *= -1; setBright(b); moving = true; }
    controls.update();
    camera.updateMatrixWorld();
    const camMoved = !lastCam.equals(camera.matrixWorld); if (camMoved) lastCam.copy(camera.matrixWorld);
    if (moving || camMoved || dirty) { const t0 = performance.now(); renderer.render(scene, camera); if (PERF) PERF.frame(performance.now() - t0); }
    dirty = false;
    if (live() && (moving || camMoved)) raf = requestAnimationFrame(tick); else lastT = 0;
  }

  // Staged startup: compile shaders off the main path, then crossfade from the poster.
  resize();
  setBright(1); applyMode(); modeEl.hidden = true;
  await (renderer.compileAsync ? renderer.compileAsync(scene, camera) : renderer.compile(scene, camera));
  renderer.render(scene, camera);
  root.classList.add('is-ready');
  modeEl.hidden = false; root.dataset.mode = order[modeIdx];
  if (hint) hint.textContent = matchMedia('(hover: hover)').matches
    ? 'Drag to orbit, scroll to zoom. Click the knob to change mode; hold it or scroll over it for brightness.'
    : 'Drag to orbit, pinch to zoom. Tap the pod to change mode; long-press for brightness.';
  window.__mx = { setPose, get pose() { return poseName; }, get mode() { return order[modeIdx]; }, get bright() { return bright; }, camera, controls, podTarget: () => podTarget(new THREE.Vector3()).toArray(), sightColor: () => '#' + smatSL.color.getHexString(), knob, info: renderer.info,
    project(name) { const o = N(name); const v = new THREE.Box3().setFromObject(o).getCenter(new THREE.Vector3()).project(camera); const r = canvas.getBoundingClientRect(); return [r.left + (v.x * .5 + .5) * r.width, r.top + (-v.y * .5 + .5) * r.height]; } };
}

function perfOverlay(stage) {
  const d = document.createElement('div');
  d.style.cssText = 'position:absolute;right:6px;top:6px;z-index:9;background:rgba(0,0,0,.75);color:#0f0;font:11px/1.3 monospace;padding:4px 6px;border-radius:4px;pointer-events:none;white-space:pre';
  stage.appendChild(d); let n = 0, t0 = performance.now(), max = 0;
  setInterval(() => { const t = performance.now(); d.textContent = `fps ${Math.round(n * 1000 / (t - t0))}  frame max ${max.toFixed(1)}ms\nDPR ${Math.min(devicePixelRatio, 1.5)}`; n = 0; t0 = t; max = 0; }, 1000);
  return { frame(ms) { n++; max = Math.max(max, ms); } };
}
