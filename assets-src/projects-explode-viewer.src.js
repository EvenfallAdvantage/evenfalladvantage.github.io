// Exploded 3D model viewer for Evenfall Projects pages. Built with esbuild from three@0.170.0.
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

const REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export async function mount(root) {
  const stage = root.querySelector('.xv-stage');
  const toggle = root.querySelector('.xv-toggle');
  const list = root.querySelector('.xv-parts');
  const info = root.querySelector('.xv-info');
  const status = root.querySelector('.xv-status');
  const [parts] = await Promise.all([fetch(root.dataset.parts).then(r => r.json())]);

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  const canvas = renderer.domElement;
  canvas.className = 'xv-canvas';
  canvas.setAttribute('aria-label', root.dataset.label || '3D model');
  canvas.setAttribute('role', 'img');
  stage.appendChild(canvas);

  const scene = new THREE.Scene();
  scene.add(new THREE.HemisphereLight(0xffffff, 0x8899aa, 2.2));
  const key = new THREE.DirectionalLight(0xffffff, 2.4); key.position.set(3, 5, 4); scene.add(key);
  const rim = new THREE.DirectionalLight(0xffd9b0, 1.2); rim.position.set(-4, 2, -3); scene.add(rim);
  const camera = new THREE.PerspectiveCamera(35, 1, 0.01, 100);
  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = !REDUCED; controls.enablePan = false;
  controls.autoRotate = !REDUCED; controls.autoRotateSpeed = 0.8;

  const draco = new DRACOLoader().setDecoderPath('/js/vendor/draco/');
  const loader = new GLTFLoader().setDRACOLoader(draco);
  const gltf = await loader.loadAsync(root.dataset.model);
  const model = gltf.scene; scene.add(model);

  const entries = [];
  for (const p of parts.parts) {
    const node = model.getObjectByName(p.node);
    if (!node) continue;
    const mats = [];
    node.traverse(o => { if (o.isMesh) { o.material = o.material.clone(); mats.push(o.material); o.userData.part = p.node; } });
    entries.push({ p, node, rest: node.position.clone(), dir: new THREE.Vector3(...p.explode), mats });
  }

  // Frame using the exploded bounds so nothing clips at factor 1.
  const fit = () => {
    const box = new THREE.Box3();
    applyFactor(1); box.setFromObject(model); applyFactor(factor);
    const size = box.getSize(new THREE.Vector3()).length();
    const c = box.getCenter(new THREE.Vector3());
    controls.target.copy(c);
    camera.position.copy(c).add(new THREE.Vector3(0.9, 0.55, 1.2).normalize().multiplyScalar(size * 1.15));
    camera.near = size / 100; camera.far = size * 20; camera.updateProjectionMatrix();
    controls.minDistance = size * 0.4; controls.maxDistance = size * 3;
  };

  let lastT = 0, factor = 0, target = 0, selected = null, raf = 0, idleUntil = 0;
  function applyFactor(f) { for (const e of entries) e.node.position.copy(e.rest).addScaledVector(e.dir, f); }
  function setTarget(t, instant) {
    target = Math.max(0, Math.min(1, t));
    if (instant || REDUCED) { factor = target; applyFactor(factor); }
    toggle.setAttribute('aria-pressed', String(target > 0.5));
    toggle.querySelector('span').textContent = target > 0.5 ? 'Assemble' : 'Explode';
    kick();
  }

  function select(id) {
    selected = selected === id ? null : id;
    for (const e of entries) {
      const on = e.p.node === selected;
      for (const m of e.mats) {
        if (m.emissive) m.emissive.setHex(on ? 0xdd8c33 : 0x000000);
        if ('emissiveIntensity' in m) m.emissiveIntensity = on ? 0.45 : 0;
        m.transparent = !!selected && !on; m.opacity = selected && !on ? 0.35 : 1;
      }
    }
    list.querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.node === selected)));
    const e = entries.find(x => x.p.node === selected);
    info.innerHTML = '';
    if (e) { const h = document.createElement('h3'); h.textContent = e.p.name; const d = document.createElement('p'); d.textContent = e.p.description; info.append(h, d); }
    else { const d = document.createElement('p'); d.className = 'xv-hint'; d.textContent = (matchMedia('(hover: hover)').matches ? 'Hover the model to explode it, then point at a label.' : 'Tap the model to explode it, then tap a label.'); info.append(d); }
    kick();
  }

  list.innerHTML = '';
  entries.forEach((e, i) => {
    const li = document.createElement('li');
    const b = document.createElement('button');
    b.type = 'button'; b.dataset.node = e.p.node; b.setAttribute('aria-pressed', 'false');
    b.innerHTML = '<span class="xv-num"></span><span class="xv-name"></span>';
    b.querySelector('.xv-num').textContent = String(i + 1).padStart(2, '0');
    b.querySelector('.xv-name').textContent = e.p.name;
    b.title = e.p.description;
    b.addEventListener('click', () => select(e.p.node));
    li.appendChild(b); list.appendChild(li);
  });
  select(null);

  toggle.addEventListener('click', () => { pinned = target <= 0.5; setTarget(pinned ? 1 : 0); });
  // Desktop: hover explodes, leave reassembles. Touch: tap toggles.
  let pinned = false;
  stage.addEventListener('pointerenter', ev => { if (ev.pointerType === 'mouse') setTarget(1); });
  stage.addEventListener('pointerleave', ev => { if (ev.pointerType === 'mouse' && !pinned) setTarget(0); });
  // Floating labels anchored to each part.
  const labelLayer = document.createElement('div'); labelLayer.className = 'xv-labels'; stage.appendChild(labelLayer);
  for (const e of entries) {
    const el = document.createElement('button'); el.type = 'button'; el.className = 'xv-tag';
    el.innerHTML = '<b></b><span></span>'; el.querySelector('b').textContent = e.p.name; el.querySelector('span').textContent = e.p.description;
    el.addEventListener('click', ev => { ev.stopPropagation(); select(e.p.node); });
    el.addEventListener('mouseenter', () => { if (selected !== e.p.node) select(e.p.node); });
    labelLayer.appendChild(el); e.tag = el;
    // Prefer parts.json label_anchor (node-local frame); fall back to the node's bounding-box centre.
    model.updateMatrixWorld(true);
    e.local = Array.isArray(e.p.label_anchor) ? new THREE.Vector3(...e.p.label_anchor) : e.node.worldToLocal(new THREE.Box3().setFromObject(e.node).getCenter(new THREE.Vector3()));
  }
  const v = new THREE.Vector3();
  function placeLabels() {
    const w = stage.clientWidth, h = stage.clientHeight, show = factor > 0.6;
    labelLayer.classList.toggle('is-on', show);
    if (!show) return;
    for (const e of entries) {
      v.copy(e.local); e.node.localToWorld(v); v.project(camera);
      e.tag.style.transform = `translate(${(v.x * .5 + .5) * w}px, ${(-v.y * .5 + .5) * h}px)`;
      e.tag.classList.toggle('is-sel', e.p.node === selected);
    }
  }

  // Click/tap on the model to pick a part (ignore drags).
  const ray = new THREE.Raycaster(); let down = null;
  canvas.addEventListener('pointerdown', ev => { down = [ev.clientX, ev.clientY]; controls.autoRotate = false; });
  canvas.addEventListener('pointerup', ev => {
    if (down && ev.pointerType !== 'mouse' && Math.hypot(ev.clientX - down[0], ev.clientY - down[1]) <= 6 && !hitPart(ev)) { pinned = target <= 0.5; setTarget(pinned ? 1 : 0); return; }
    if (!down || Math.hypot(ev.clientX - down[0], ev.clientY - down[1]) > 6) return;
    const r = canvas.getBoundingClientRect();
    ray.setFromCamera(new THREE.Vector2(((ev.clientX - r.left) / r.width) * 2 - 1, -((ev.clientY - r.top) / r.height) * 2 + 1), camera);
    const hit = ray.intersectObject(model, true)[0];
    let o = hit && hit.object; while (o && !o.userData.part) o = o.parent;
    if (o) select(o.userData.part);
  });
  controls.addEventListener('change', kick);
  function hitPart(ev) { const r = canvas.getBoundingClientRect(); ray.setFromCamera(new THREE.Vector2(((ev.clientX - r.left) / r.width) * 2 - 1, -((ev.clientY - r.top) / r.height) * 2 + 1), camera); return target > 0.5 && ray.intersectObject(model, true).length > 0; }

  const resize = () => {
    const w = stage.clientWidth, h = stage.clientHeight;
    renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); kick();
  };
  new ResizeObserver(resize).observe(stage);

  let visible = true;
  new IntersectionObserver(es => { visible = es[0].isIntersecting; if (visible) kick(); }).observe(stage);

  function kick() { idleUntil = performance.now() + 1500; if (!raf) raf = requestAnimationFrame(tick); }
  function tick(t) {
    raf = 0;
    const dt = Math.min(0.1, lastT ? (t - lastT) / 1000 : 0.016); lastT = t;
    if (Math.abs(target - factor) > 0.001) { factor += (target - factor) * (1 - Math.exp(-dt * 7)); if (Math.abs(target - factor) < 0.002) factor = target; applyFactor(factor); idleUntil = t + 500; }
    controls.update(); renderer.render(scene, camera); placeLabels();
    if (visible && (controls.autoRotate || t < idleUntil)) raf = requestAnimationFrame(tick); else lastT = 0;
  }

  fit(); resize();
  setTarget(parseFloat(root.dataset.start || '0'), true);
  root.classList.add('is-ready');
  if (status) status.textContent = entries.length + ' parts loaded. Drag to orbit, hover or tap to explode.';
  window.__xv = window.__xv || {}; window.__xv[root.dataset.slug] = { setTarget, select, get factor() { return factor; }, parts: entries.length };
}
