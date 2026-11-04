// SynScope mount simulator (projects/synscope.html). Built with esbuild from three@0.170.0:
//   esbuild assets-src/projects-mount-sim.src.js --bundle --format=esm --minify --outfile=js/projects/mount-sim.js
// Same infrastructure as explode-viewer: Draco, render on demand, DPR cap 1.5, paused off-screen,
// poster crossfade, ?perf=1. Interaction: orbit around the pod, Mount toggle eases the pod pose,
// knob or pod click/tap (or the Mode button) cycles screen modes; wheel over the knob/pod sets brightness.
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

const REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const BLOCKED = new THREE.Color('#e5484d'), CLEAR = new THREE.Color('#dd8c33');
const DETENT = THREE.MathUtils.degToRad(30), POSE_MS = 500, TAP_PX = 6;
const ease = t => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

export async function mount(root) {
  const frame = root.querySelector('.mx-frame');
  const modeEl = root.querySelector('.mx-mode'), eyeBtn = root.querySelector('.mx-eye'), hint = root.querySelector('#mx-hint');
  const base = frame.dataset.screens;
  const parts = await fetch(frame.dataset.parts).then(r => r.json());

  const DPR = Math.min(window.devicePixelRatio || 1, 1.5);
  const renderer = new THREE.WebGLRenderer({ antialias: (window.devicePixelRatio || 1) < 1.5, alpha: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(DPR);
  const VL = parts.viewer_lighting || {}, VR = VL.renderer || {};
  renderer.outputColorSpace = THREE[VR.outputColorSpace] || THREE.SRGBColorSpace;
  renderer.toneMapping = THREE[VR.toneMapping] ?? THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = VR.toneMappingExposure ?? 1.15;
  const canvas = renderer.domElement;
  canvas.className = 'mx-canvas';
  canvas.setAttribute('role', 'img');
  canvas.setAttribute('aria-label', 'Interactive 3D model of the SynScope pod mounted on an M4 carbine');
  frame.appendChild(canvas);
  const PERF = /[?&]perf=1/.test(location.search) ? perfOverlay(frame) : null;

  const scene = new THREE.Scene();
  // Lighting from parts.json viewer_lighting (Metalika), with matching defaults.
  const hs = VL.hemisphere || {};
  scene.add(new THREE.HemisphereLight(hs.skyColor || '#dfe8ff', hs.groundColor || '#3a3226', hs.intensity ?? 1.4));
  const dl = (o, d) => { o = { ...d, ...o }; const l = new THREE.DirectionalLight(o.color, o.intensity); l.position.fromArray(o.position); l.castShadow = false; scene.add(l); scene.add(l.target); return l; };
  const key = dl(VL.key, { color: '#fff4e6', intensity: 3.0, position: [0.8, 1.2, 0.6] });
  if (VL.fill !== null) dl(VL.fill, { color: '#cfdcff', intensity: 1.0, position: [-0.8, 0.4, -0.6] });
  const env = VL.environment || {};
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture; pmrem.dispose();
  scene.environmentIntensity = env['scene.environmentIntensity'] ?? env.intensity ?? 0.6;
  scene.background = new THREE.Color(((env.background || '').match(/#[0-9a-f]{6}/i) || ['#1d3451'])[0]);
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
  if (orbitT) key.target = orbitT; // key light aims at the pod in both poses

  // Poses: use parts.json mount_poses (root-local == world).
  const poses = {};
  for (const k of ['toprail', 'offset45']) { const p = parts.mount_poses[k]; poses[k] = { t: new THREE.Vector3(...p.translation), q: new THREE.Quaternion(...p.rotation_quat) }; }

  // Screen material: own clone, emissive texture per mode, UV rotation per pose.
  let smat = null; screen.traverse(o => { if (o.isMesh) { o.material = o.material.clone(); smat = o.material; } });
  const baseEI = smat.emissiveIntensity || 1;
  const order = parts.screen_modes.order, modes = parts.screen_modes.modes, uvRot = parts.screen.uv_rotation_deg;
  const tl = new THREE.TextureLoader(), tex = {};
  await Promise.all(order.map(m => tl.loadAsync(base + modes[m].texture).then(t => { t.flipY = false; t.colorSpace = THREE.SRGBColorSpace; t.center.set(.5, .5); t.anisotropy = 4; tex[m] = t; })));
  const modeBtn = root.querySelector('.mx-modebtn');
  let modeIdx = Math.max(0, order.indexOf(parts.screen_modes.default));
  function applyMode() {
    const t = tex[order[modeIdx]];
    // The screen is emissive: emissiveMap carries the picture (map too, if the GLB authored one).
    smat.emissiveMap = t; if (smat.map) smat.map = t;
    smat.needsUpdate = true;
    const label = 'Screen: ' + modes[order[modeIdx]].label;
    modeEl.hidden = false; modeEl.textContent = label;
    if (modeBtn) modeBtn.querySelector('span').textContent = modes[order[modeIdx]].label;
    root.dataset.mode = order[modeIdx];
    kick();
  }
  // Self-levelling horizon: every mode texture carries the rotation, so swaps keep it (map and emissiveMap
  // share the same texture objects). Rotation is about the UV centre, applied live from the pod's roll.
  let uvDeg = 0;
  function setUV(deg) { uvDeg = deg; for (const m of order) { tex[m].center.set(.5, .5); tex[m].rotation = THREE.MathUtils.degToRad(deg); tex[m].updateMatrix(); } }

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
    smatSL.color.copy(anim.c0).lerp(anim.c1, e);
    if (k >= 1) anim = null;
    return true;
  }

  // Live levelling. The screen's UV frame is measured once (largest triangle, in screen-local space); each
  // frame we solve for the texture rotation that makes the displayed image's left-to-right axis horizontal
  // in world space, so the horizon stays level in both poses, during the ease and after any orbit.
  let sMesh = null; screen.traverse(o => { if (o.isMesh && !sMesh) sMesh = o; });
  const sFrame = (() => {
    const g = sMesh.geometry, P = g.attributes.position, U = g.attributes.uv, I = g.index, n = I ? I.count : P.count;
    const ix = j => I ? I.getX(j) : j, p = [0, 1, 2].map(() => new THREE.Vector3());
    let best = null, bestA = 0;
    for (let j = 0; j + 2 < n; j += 3) {
      const a = ix(j), b = ix(j + 1), c = ix(j + 2);
      p[0].fromBufferAttribute(P, a); p[1].fromBufferAttribute(P, b); p[2].fromBufferAttribute(P, c);
      const e1 = p[1].clone().sub(p[0]), e2 = p[2].clone().sub(p[0]), area = e1.clone().cross(e2).length();
      const du1 = U.getX(b) - U.getX(a), dv1 = U.getY(b) - U.getY(a), du2 = U.getX(c) - U.getX(a), dv2 = U.getY(c) - U.getY(a), det = du1 * dv2 - du2 * dv1;
      if (area <= bestA || Math.abs(det) < 1e-9) continue;
      bestA = area;
      best = { du: e1.clone().multiplyScalar(dv2).addScaledVector(e2, -dv1).divideScalar(det), dv: e2.clone().multiplyScalar(du1).addScaledVector(e1, -du2).divideScalar(det) };
    }
    return best;
  })();
  const _du = new THREE.Vector3(), _dv = new THREE.Vector3(), _n = new THREE.Vector3(), _h = new THREE.Vector3(), _vu = new THREE.Vector3(), _r = new THREE.Vector3(), _M = new THREE.Matrix3(), _UP = new THREE.Vector3(0, 1, 0);
  function tiltFor(deg) {
    sMesh.updateWorldMatrix(true, false);
    _du.copy(sFrame.du).applyMatrix3(new THREE.Matrix3().setFromMatrix4(sMesh.matrixWorld)); _dv.copy(sFrame.dv).applyMatrix3(new THREE.Matrix3().setFromMatrix4(sMesh.matrixWorld));
    const t = tex[order[0]];
    const m = _M.setUvTransform(t.offset.x, t.offset.y, t.repeat.x, t.repeat.y, THREE.MathUtils.degToRad(deg), .5, .5).invert().elements;
    _r.copy(_du).multiplyScalar(m[0]).addScaledVector(_dv, m[1]).normalize();
    _n.copy(_du).cross(_dv).normalize(); _h.copy(_UP).cross(_n).normalize(); _vu.copy(_n).cross(_h);
    let a = THREE.MathUtils.radToDeg(Math.atan2(_r.dot(_vu), _r.dot(_h)));
    if (a > 90) a -= 180; if (a < -90) a += 180;
    // image "up" (towards texel row 0, flipY=false) must point up, else the content is upside down
    tiltFor.upY = -(_du.y * m[3] + _dv.y * m[4]);
    return a;
  }
  let levelQ = null;
  function levelScreen() {
    pod.updateWorldMatrix(true, false); pod.getWorldQuaternion(_q);
    if (levelQ && levelQ.equals(_q)) return false;
    levelQ = _q.clone();
    let d = uvDeg; // Newton/secant from the current angle (2-4 steps)
    for (let k = 0; k < 6; k++) { const f = tiltFor(d); if (Math.abs(f) < 0.05) break; const g = (tiltFor(d + 1) - f) || -1; d -= f / g; }
    tiltFor(d); if (tiltFor.upY < 0) d += 180;
    d = ((d + 180) % 360 + 360) % 360 - 180;
    if (Math.abs(d - uvDeg) > 1e-4) { setUV(d); return true; }
    return false;
  }
  const _q = new THREE.Quaternion();

  // Camera: initial offset from the pod target; the orbit target follows the pod (camera keeps its offset).
  const initPose = root.querySelector('input[name="mountpos"]:checked').value === 'top' ? 'toprail' : 'offset45';
  pod.position.copy(poses[initPose].t); pod.quaternion.copy(poses[initPose].q);
  setPose(initPose, true); stepPose(performance.now()); levelScreen();
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

  // Knob interaction: hover highlight, click/tap cycles mode, wheel over it sets brightness.
  const interactive = [knob, body, screen].filter(Boolean);
  function pick(ev) {
    const r = canvas.getBoundingClientRect();
    ndc.set(((ev.clientX - r.left) / r.width) * 2 - 1, -((ev.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    // Whole pod counts (knob, body, screen), plus a padded box so a small on-screen knob is easy to hit.
    for (const h of ray.intersectObjects(interactive, true)) if (h.object.visible) return h.object;
    podBox.setFromObject(pod).expandByScalar(0.006);
    return ray.ray.intersectsBox(podBox) ? pod : null;
  }
  const podBox = new THREE.Box3();
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

  // Tap/click on the pod cycles the mode. Orbit still works from the pod: a press only counts as a
  // tap if the pointer moves less than TAP_PX, so jitter during a real click never becomes a drag.
  function cycleMode() { modeIdx = (modeIdx + 1) % order.length; turnKnob(DETENT); applyMode(); }
  let press = null;
  window.addEventListener('pointerdown', ev => {
    if (ev.target !== canvas || !ev.isPrimary || ev.button > 0) { press = null; return; }
    press = pick(ev) ? { id: ev.pointerId, x: ev.clientX, y: ev.clientY } : null;
  }, true);
  window.addEventListener('pointermove', ev => {
    if (press && ev.pointerId === press.id && Math.hypot(ev.clientX - press.x, ev.clientY - press.y) > TAP_PX) press = null;
  }, true);
  window.addEventListener('pointerup', ev => {
    if (!press || ev.pointerId !== press.id) return;
    const moved = Math.hypot(ev.clientX - press.x, ev.clientY - press.y); press = null;
    if (moved <= TAP_PX) cycleMode();
  }, true);
  window.addEventListener('pointercancel', () => { press = null; }, true);
  if (modeBtn) { modeBtn.hidden = false; modeBtn.addEventListener('click', cycleMode); }

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
    if (levelScreen()) moving = true;
    // Orbit target follows the pod; shift the camera by the same delta to keep the view offset.
    podTarget(tgt);
    if (!tgt.equals(prevTgt)) { const d = tgt.clone().sub(prevTgt); camera.position.add(d); controls.target.copy(tgt); prevTgt.copy(tgt); moving = true; }
    if (camAnim) { const k = camAnim.dur ? Math.min(1, (t - camAnim.t0) / camAnim.dur) : 1; camera.position.lerpVectors(camAnim.p0, camAnim.p1, ease(k)); if (k >= 1) camAnim = null; moving = true; }
    if (Math.abs(knobTarget - knob.rotation.x) > 1e-3) { knob.rotation.x += (knobTarget - knob.rotation.x) * (1 - Math.exp(-dt * 18)); moving = true; } else knob.rotation.x = knobTarget;
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
  root.dataset.simReady = '1';
  if (hint) hint.textContent = matchMedia('(hover: hover)').matches
    ? 'Drag to orbit, scroll to zoom. Click the pod or Mode to change the screen; scroll over the pod for brightness.'
    : 'Drag to orbit, pinch to zoom. Tap the pod or Mode to change the screen.';
  window.__mx = { setPose, get pose() { return poseName; }, get mode() { return order[modeIdx]; }, get bright() { return bright; }, camera, controls, podTarget: () => podTarget(new THREE.Vector3()).toArray(), sightColor: () => '#' + smatSL.color.getHexString(), knob, info: renderer.info,
    get uvDeg() { return uvDeg; },
    horizon(deg) { const tl = tiltFor(deg === undefined ? uvDeg : deg); return { tilt: +tl.toFixed(2), upright: tiltFor.upY > 0, parts: uvRot[poseName], uvDeg: +uvDeg.toFixed(2), map: smat.emissiveMap.uuid.slice(0, 6), same: smat.emissiveMap === tex[order[modeIdx]] }; },
    project(name) { const o = N(name); const v = new THREE.Box3().setFromObject(o).getCenter(new THREE.Vector3()).project(camera); const r = canvas.getBoundingClientRect(); return [r.left + (v.x * .5 + .5) * r.width, r.top + (-v.y * .5 + .5) * r.height]; } };
}

function perfOverlay(stage) {
  const d = document.createElement('div');
  d.style.cssText = 'position:absolute;right:6px;top:6px;z-index:9;background:rgba(0,0,0,.75);color:#0f0;font:11px/1.3 monospace;padding:4px 6px;border-radius:4px;pointer-events:none;white-space:pre';
  stage.appendChild(d); let n = 0, t0 = performance.now(), max = 0;
  setInterval(() => { const t = performance.now(); d.textContent = `fps ${Math.round(n * 1000 / (t - t0))}  frame max ${max.toFixed(1)}ms\nDPR ${Math.min(devicePixelRatio, 1.5)}`; n = 0; t0 = t; max = 0; }, 1000);
  return { frame(ms) { n++; max = Math.max(max, ms); } };
}
