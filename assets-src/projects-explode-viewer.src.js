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

  // Perf: cap DPR at 1.5 and skip MSAA on hi-DPI screens (the extra pixels already smooth edges).
  const DPR = Math.min(window.devicePixelRatio || 1, 1.5);
  const renderer = new THREE.WebGLRenderer({ antialias: (window.devicePixelRatio || 1) < 1.5, alpha: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(DPR);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  const canvas = renderer.domElement;
  canvas.className = 'xv-canvas';
  canvas.setAttribute('aria-label', root.dataset.label || '3D model');
  canvas.setAttribute('role', 'img');
  stage.appendChild(canvas);

  const PERF = /[?&]perf=1/.test(location.search) ? xvPerf(stage) : null;
  const scene = new THREE.Scene();
  scene.add(new THREE.HemisphereLight(0xffffff, 0x8899aa, 2.2));
  const key = new THREE.DirectionalLight(0xffffff, 2.4); key.position.set(3, 5, 4); scene.add(key);
  const rim = new THREE.DirectionalLight(0xffd9b0, 1.2); rim.position.set(-4, 2, -3); scene.add(rim);
  const camera = new THREE.PerspectiveCamera(35, 1, 0.01, 100);
  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = !REDUCED; controls.enablePan = false;
  controls.autoRotate = false; controls.autoRotateSpeed = 0.8;
  // Short intro spin only (a few seconds after first view), never a continuous idle loop.
  let spinUntil = 0, spun = REDUCED;

  const draco = new DRACOLoader().setDecoderPath('/js/vendor/draco/');
  const loader = new GLTFLoader().setDRACOLoader(draco);
  const gltf = await loader.loadAsync(root.dataset.model);
  const model = gltf.scene; scene.add(model);

  const entries = [], meshes = [];
  for (const p of parts.parts) {
    const node = model.getObjectByName(p.node);
    if (!node) continue;
    const mats = [];
    const cl = new Map(); // one clone per source material per part (highlighting is per part)
    node.traverse(o => { if (o.isMesh) { if (!cl.has(o.material)) { const m = o.material.clone(); const g = m.clone(); g.transparent = true; g.opacity = 0.35; g.depthWrite = false; m.userData.ghost = g; cl.set(o.material, m); mats.push(m); } o.material = cl.get(o.material); meshes.push(o); o.userData.part = p.node; } });
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
    camera.near = size / 100; camera.far = size * 20;
    camera.aspect = stage.clientWidth / Math.max(1, stage.clientHeight) || camera.aspect; camera.updateProjectionMatrix();
    applyFactor(1); model.updateMatrixWorld(true); xvFit(camera, box, c, model); applyFactor(factor);
    controls.minDistance = size * 0.4; controls.maxDistance = size * 3;
  };

  let lastT = 0, factor = 0, target = 0, selected = null, raf = 0, visible = false, ready = false, hovPart = null, dirty = true, sizeDirty = true, SW = 1, SH = 1, slow = 0, lowQ = false;
  function applyFactor(f) { for (const e of entries) e.node.position.copy(e.rest).addScaledVector(e.dir, f); }
  function setTarget(t, instant) {
    target = Math.max(0, Math.min(1, t));
    if (target > 0) { spinUntil = 0; controls.autoRotate = false; }
    if (instant || REDUCED) { factor = target; applyFactor(factor); }
    toggle.setAttribute('aria-pressed', String(target > 0.5));
    toggle.querySelector('span').textContent = target > 0.5 ? 'Assemble' : 'Explode';
    const ic = toggle.querySelector('i'); if (ic) ic.className = 'fas ' + (target > 0.5 ? 'fa-down-left-and-up-right-to-center' : 'fa-up-right-and-down-left-from-center');
    toggle.setAttribute('aria-label', target > 0.5 ? 'Assemble the model' : 'Explode the model');
    kick();
  }

  function select(id) {
    selected = selected === id ? null : id;
    for (const e of entries) {
      const on = e.p.node === selected;
      for (const m of e.mats) {
        if (m.emissive) m.emissive.setHex(on ? 0xdd8c33 : 0x000000);
        if ('emissiveIntensity' in m) m.emissiveIntensity = on ? 0.45 : 0;
      }
      const ghost = !!selected && !on;
      e.node.traverse(o => { if (o.isMesh) { const base = o.userData.base || (o.userData.base = o.material); o.material = ghost ? base.userData.ghost : base; } });
    }
    if (hovPart) glow(hovPart, true);
    list.querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.node === selected)));
    const e = entries.find(x => x.p.node === selected);
    info.innerHTML = '';
    if (e) { const h = document.createElement('h3'); h.textContent = e.p.name; const d = document.createElement('p'); d.textContent = e.p.description; info.append(h, d); }
    else { const d = document.createElement('p'); d.className = 'xv-hint'; d.textContent = (matchMedia('(hover: hover)').matches ? 'Press Explode to separate the parts, then point at a label.' : 'Tap Explode to separate the parts, then tap a label.'); info.append(d); }
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

  // Float the toggle over the stage so it is always visible next to the model.
  toggle.classList.add('xv-toggle-float'); stage.appendChild(toggle);
  // Explode/assemble only through the button (no hover or canvas-tap toggling).
  toggle.addEventListener('click', () => setTarget(target > 0.5 ? 0 : 1));
  // Desktop: hover explodes, leave reassembles. Touch: tap toggles.
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
  let labelKey = '';
  function placeLabels(moved) {
    const w = SW, h = SH, show = factor > 0.6;
    labelLayer.classList.toggle('is-on', show);
    if (!show) return;
    // Project anchors; xvLayout places dots, leader lines, pills and the tooltip.
    // Only re-run the collision layout when the camera, explode factor, size, hover or selection changed.
    const key = selected + '|' + (labelLayer._hover ? labelLayer._hover.p.node : '');
    if (!moved && key === labelKey) return;
    const full = moved || !labelKey; labelKey = key;
    const pts = [];
    for (const e of entries) {
      v.copy(e.local); e.node.localToWorld(v); v.project(camera);
      e.tag.classList.toggle('is-sel', e.p.node === selected);
      pts.push({ Z: e, x: (v.x * .5 + .5) * w, y: (-v.y * .5 + .5) * h });
    }
    xvLayout(pts, w, h, selected, labelLayer, full);
  }

  // Click/tap on the model to pick a part (ignore drags).
  const ray = new THREE.Raycaster(); let down = null;
  canvas.addEventListener('pointerdown', ev => { down = [ev.clientX, ev.clientY]; controls.autoRotate = false; });
  canvas.addEventListener('pointerup', ev => {
    if (!down || Math.hypot(ev.clientX - down[0], ev.clientY - down[1]) > 6) return;
    const r = canvas.getBoundingClientRect();
    ray.setFromCamera(new THREE.Vector2(((ev.clientX - r.left) / r.width) * 2 - 1, -((ev.clientY - r.top) / r.height) * 2 + 1), camera);
    const hit = ray.intersectObject(model, true)[0];
    let o = hit && hit.object; while (o && !o.userData.part) o = o.parent;
    if (o) select(o.userData.part);
  });
  // Component hover: highlight the part under the cursor (emissive uniform only, precompiled
  // materials, no swaps) and show its tooltip when exploded. At most one raycast per frame.
  let hovEv = null, hovRaf = 0;
  function glow(e, on) { if (!e || e.p.node === selected) return; for (const m of e.mats) { if (m.emissive) m.emissive.setHex(on ? 0x5c86b8 : 0); if ('emissiveIntensity' in m) m.emissiveIntensity = on ? 0.35 : 0; } }
  function setHover(e) {
    if (e === hovPart) return;
    glow(hovPart, false); hovPart = e; glow(e, true);
    canvas.style.cursor = e ? 'pointer' : '';
    if (target > 0.5) { if (e) labelLayer._hover = e; else if (labelLayer._hover && !labelLayer._hover.tag.matches(':hover')) labelLayer._hover = null; }
    kick();
  }
  canvas.addEventListener('pointermove', ev => {
    if (ev.pointerType !== 'mouse' || ev.buttons) return;
    hovEv = ev; if (hovRaf) return;
    hovRaf = requestAnimationFrame(() => {
      hovRaf = 0; const r = canvas.getBoundingClientRect();
      ray.setFromCamera(new THREE.Vector2(((hovEv.clientX - r.left) / r.width) * 2 - 1, -((hovEv.clientY - r.top) / r.height) * 2 + 1), camera);
      const hit = ray.intersectObject(model, true)[0]; let o = hit && hit.object; while (o && !o.userData.part) o = o.parent;
      setHover(o ? entries.find(x => x.p.node === o.userData.part) : null);
    });
  });
  canvas.addEventListener('pointerleave', () => { if (hovRaf) { cancelAnimationFrame(hovRaf); hovRaf = 0; } setHover(null); });
  controls.addEventListener('change', kick);
  function hitPart(ev) { const r = canvas.getBoundingClientRect(); ray.setFromCamera(new THREE.Vector2(((ev.clientX - r.left) / r.width) * 2 - 1, -((ev.clientY - r.top) / r.height) * 2 + 1), camera); return target > 0.5 && ray.intersectObject(model, true).length > 0; }

  const resize = () => {
    const w = stage.clientWidth, h = stage.clientHeight;
    if (!w || !h) return; SW = w; SH = h;
    renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); sizeDirty = true; kick();
  };
  new ResizeObserver(resize).observe(stage);

  // Render on demand: frames only while exploding/assembling, orbit damping, the intro spin, or a
  // hover/selection change. Paused while offscreen or the tab is hidden.
  function live() { return visible && !document.hidden; }
  new IntersectionObserver(es => {
    visible = es[0].isIntersecting;
    if (visible && ready && !spun) startIntro();
    if (live()) kick(); else if (raf) { cancelAnimationFrame(raf); raf = 0; lastT = 0; }
  }).observe(stage);
  document.addEventListener('visibilitychange', () => { if (live()) kick(); else if (raf) { cancelAnimationFrame(raf); raf = 0; lastT = 0; } });
  canvas.addEventListener('pointerdown', () => { spinUntil = 0; controls.autoRotate = false; });

  function startIntro() {
    spun = true;
    if (stage.matches(':hover') || target > 0) return;
    controls.autoRotateSpeed = 0.5; spinUntil = performance.now() + 3000; controls.autoRotate = true; kick();
  }
  function kick() { dirty = true; if (!raf && live()) raf = requestAnimationFrame(tick); }
  const lastCam = new THREE.Matrix4();
  function tick(t) {
    raf = 0;
    const dt = Math.min(0.1, lastT ? (t - lastT) / 1000 : 0.016); lastT = t;
    let anim = false;
    if (Math.abs(target - factor) > 0.001) { factor += (target - factor) * (1 - Math.exp(-dt * 7)); if (Math.abs(target - factor) < 0.002) factor = target; applyFactor(factor); anim = true; }
    if (controls.autoRotate && t > spinUntil) controls.autoRotate = false;
    controls.update();
    camera.updateMatrixWorld();
    const camMoved = !lastCam.equals(camera.matrixWorld); if (camMoved) lastCam.copy(camera.matrixWorld);
    const moved = anim || camMoved || sizeDirty;
    if (moved || dirty) {
      const t0 = performance.now();
      renderer.render(scene, camera); placeLabels(moved);
      const ft = performance.now() - t0 + (dt > 0.05 && lastT ? 50 : 0);
      if (PERF) PERF.frame(ft);
      // Quality fallback: several slow frames -> DPR 1 and hide minor labels.
      if (!lowQ && ft > 50 && ++slow >= 4) { lowQ = true; renderer.setPixelRatio(1); renderer.setSize(SW, SH, false); stage.classList.add('xv-lowq'); sizeDirty = true; }
    }
    sizeDirty = false; dirty = false;
    if (live() && (moved || controls.autoRotate)) raf = requestAnimationFrame(tick); else lastT = 0;
  }

  // Staged startup: async shader compile (both material variants), then label DOM/measurements in
  // idle time, then the poster crossfades and the intro may play; hover arms last.
  const idle = () => new Promise(res => (window.requestIdleCallback || setTimeout)(res, { timeout: 300 }));
  fit(); resize();
  for (const o of meshes) { o.userData.base = o.material; o.material = o.material.userData.ghost; }
  await (renderer.compileAsync ? renderer.compileAsync(scene, camera) : renderer.compile(scene, camera));
  for (const o of meshes) o.material = o.userData.base;
  await (renderer.compileAsync ? renderer.compileAsync(scene, camera) : renderer.compile(scene, camera));
  performance.mark('xv-compiled');
  await idle();
  { // pre-create dots/pills and measure them once, hidden, at the exploded pose
    const w = SW, h = SH; applyFactor(1); model.updateMatrixWorld(true);
    labelLayer.style.visibility = 'hidden'; labelLayer.classList.add('is-on');
    xvLayout(entries.map(e => { v.copy(e.local); e.node.localToWorld(v); v.project(camera); return { Z: e, x: (v.x * .5 + .5) * w, y: (-v.y * .5 + .5) * h }; }), w, h, null, labelLayer, true);
    labelLayer.classList.remove('is-on'); labelLayer.style.visibility = ''; labelKey = ''; applyFactor(factor);
  }
  await idle();
  setTarget(parseFloat(root.dataset.start || '0'), true);
  renderer.render(scene, camera);
  performance.mark('xv-ready');
  ready = true; root.classList.add('is-ready');
  if (visible && !spun) startIntro();
  if (status) status.textContent = entries.length + ' parts loaded. Drag to orbit; use the Explode button to separate the parts.';
  window.__xv = window.__xv || {}; window.__xv[root.dataset.slug] = { setTarget, select, get factor() { return factor; }, parts: entries.length, info: renderer.info };
}

// Label layout for the explode viewer: anchor dot at the part, leader line, pill pushed away
// from the model centre, 2D collision relaxation (x and y), canvas clamping, drop-on-crowding,
// and one small tooltip for the hovered (or tapped) part only.
function xvLayout(L,W,H,sel,X,full){
  if(!X._svg){X._svg=document.createElementNS("http://www.w3.org/2000/svg","svg");X._svg.setAttribute("class","xv-lines");X.prepend(X._svg);
    X._tip=document.createElement("div");X._tip.className="xv-tip";X._tip.setAttribute("role","tooltip");X.appendChild(X._tip);X._hover=null;X._touch=false;
    X.ownerDocument.addEventListener("pointerdown",e=>{X._touch=e.pointerType!=="mouse"},true);}
  const pad=4,gap=6,small=W<560;
  // measure every pill once in a single batch (one reflow), then never read layout per frame
  if(!X._measured&&L.length&&L[0].Z._dot){for(const o of L)o.Z.tag.classList.remove("is-off");for(const o of L){o.Z._w=o.Z.tag.offsetWidth;o.Z._h=o.Z.tag.offsetHeight}X._measured=L[0].Z._w>0}
  let cx=0,cy=0;for(const o of L){cx+=o.x;cy+=o.y}cx/=L.length||1;cy/=L.length||1;
  for(const o of L){const Z=o.Z;
    if(!Z._dot){Z._dot=document.createElement("span");Z._dot.className="xv-dot";X.appendChild(Z._dot);
      Z._ln=document.createElementNS("http://www.w3.org/2000/svg","line");X._svg.appendChild(Z._ln);
      Z.tag.addEventListener("mouseenter",()=>{X._hover=Z});Z.tag.addEventListener("mouseleave",()=>{if(X._hover===Z)X._hover=null});
      Z.tag.addEventListener("focus",()=>{X._hover=Z});Z._dot.addEventListener("mouseenter",()=>{X._hover=Z;Z.tag.dispatchEvent(new Event("mouseenter"))});Z._dot.addEventListener("click",e=>{e.stopPropagation();X._hover=Z;Z.tag.click()});Z._dot.addEventListener("mouseleave",()=>{if(X._hover===Z)X._hover=null});Z.tag.addEventListener("blur",()=>{if(X._hover===Z)X._hover=null});}
    o.w=Z._w||60;o.h=Z._h||18; // measure once (no per-frame layout reads)
    let dx=o.x-cx,dy=o.y-cy,d=Math.hypot(dx,dy);if(d<1){dx=0;dy=-1;d=1}
    const R=(small?22:34)+Math.min(W,H)*0.04;
    o.tx=o.x+dx/d*(R+o.w*0.35);o.ty=o.y+dy/d*(R+o.h*0.5);
    if(Z._lx===undefined||Math.hypot(Z._lx-o.tx,Z._ly-o.ty)>W*0.25){Z._lx=o.tx;Z._ly=o.ty}
    o.lx=Z._lx;o.ly=Z._ly;o.on=true}
  // priority cap: many-part models show the first (major) parts labelled; the rest are dots until hovered/tapped
  const keep=o=>o.Z.p.node===sel||o.Z===X._hover,cap=Math.max(6,Math.min(16,Math.floor(W*H/(small?14000:30000)))),all=L;
  all.forEach((o,i)=>{o.rank=all.length>cap&&i>=cap;o.minor=o.rank&&!keep(o)});L=all.filter(o=>!o.minor);
  const clamp=o=>{o.lx=Math.min(Math.max(o.lx,o.w/2+pad),W-o.w/2-pad);o.ly=Math.min(Math.max(o.ly,o.h/2+pad),H-o.h/2-pad)};
  // hover/selection-only update: labels already on screen stay put, only newly shown ones settle (no ping-pong under the cursor)
  for(const o of L)o.fix=full===false&&o.Z._on;
  const ov=(a,b)=>{const ox=(a.w+b.w)/2+gap-Math.abs(a.lx-b.lx),oy=(a.h+b.h)/2+gap/2-Math.abs(a.ly-b.ly);return ox>0&&oy>0?[ox,oy]:null};
  for(let it=0;it<(full===false?30:60);it++){
    for(const o of L){if(o.fix)continue;o.lx+=(o.tx-o.lx)*0.08;o.ly+=(o.ty-o.ly)*0.08}
    for(let i=0;i<L.length;i++)for(let j=i+1;j<L.length;j++){const a=L[i],b=L[j],r=ov(a,b);if(!r)continue;
      const ka=a.fix?0:b.fix?2:1,kb=b.fix?0:a.fix?2:1;if(!ka&&!kb)continue;
      if(r[0]<r[1]*2.2){const s=(a.lx<b.lx?-1:1)*r[0]/2;a.lx+=s*ka;b.lx-=s*kb}else{const s=(a.ly<b.ly?-1:1)*r[1]/2;a.ly+=s*ka;b.ly-=s*kb}}
    // keep pills off other parts' anchor dots
    for(const o of L)for(const p of L){if(p===o||o.fix)continue;const ox=o.w/2+5-Math.abs(o.lx-p.x),oy=o.h/2+5-Math.abs(o.ly-p.y);if(ox>0&&oy>0){if(ox<oy)o.lx+=(o.lx<p.x?-1:1)*ox;else o.ly+=(o.ly<p.y?-1:1)*oy}}
    for(const o of L)if(!o.fix)clamp(o)}
  // fallback: drop labels that still collide (keep selected/hovered, then the one nearer its target)
  for(let i=0;i<L.length;i++)for(let j=i+1;j<L.length;j++){const a=L[i],b=L[j];if(!a.on||!b.on||!ov(a,b))continue;
    const da=Math.hypot(a.lx-a.tx,a.ly-a.ty)-(keep(a)?1e6:0),db=Math.hypot(b.lx-b.tx,b.ly-b.ty)-(keep(b)?1e6:0);(da>db?a:b).on=false}
  for(const o of all)if(o.minor)o.on=false;L=all;
  for(const o of L){const Z=o.Z;Z._lx=o.lx;Z._ly=o.ly;Z._on=o.on;
    Z.tag.style.transform=`translate(${o.lx}px, ${o.ly}px)`;Z.tag.classList.toggle("is-off",!o.on);
    Z._dot.classList.toggle("is-minor",!!o.rank);Z._dot.style.transform=`translate(${o.x}px, ${o.y}px)`;
    Z._ln.setAttribute("x1",o.x);Z._ln.setAttribute("y1",o.y);Z._ln.setAttribute("x2",o.lx);Z._ln.setAttribute("y2",o.ly);Z._ln.style.display=o.on?"":"none"}
  // tooltip: hovered label (mouse) or tapped part (touch) only
  const T=X._hover||(X._touch?L.map(o=>o.Z).find(Z=>Z.p.node===sel):null),tip=X._tip,t=T&&L.find(o=>o.Z===T);
  if(t&&t.on){if(tip._for!==T){tip.textContent=T.p.description;tip._for=T}tip.classList.add("is-on");
    if(tip._sz!==T){tip._tw=tip.offsetWidth;tip._th=tip.offsetHeight;tip._sz=T}const tw=tip._tw,th=tip._th;let x=t.lx+t.w/2+8;if(x+tw>W-pad)x=t.lx-t.w/2-8-tw;if(x<pad)x=Math.min(Math.max(t.lx-tw/2,pad),W-tw-pad);
    let y=t.ly-th/2;if(x===Math.min(Math.max(t.lx-tw/2,pad),W-tw-pad))y=t.ly+t.h/2+6;if(y+th>H-pad)y=t.ly-t.h/2-6-th;y=Math.max(pad,y);
    tip.style.transform=`translate(${x}px, ${y}px)`;X.classList.add("has-tip")}else{tip.classList.remove("is-on");tip._for=null;X.classList.remove("has-tip")}
}

// fit camera distance so the exploded bbox fills ~80% of the frame (diagonal fit left big margins on tall explodes)
function xvFit(d,box,c,obj){const k=[],v=d.position.clone().sub(c);
  if(obj)obj.traverse(o=>{const g=o.isMesh&&o.geometry&&o.geometry.attributes.position;if(!g)return;const st=Math.max(1,Math.floor(g.count/400));for(let i=0;i<g.count;i+=st)k.push(box.min.clone().fromBufferAttribute(g,i).applyMatrix4(o.matrixWorld))});
  if(!k.length)for(let i=0;i<8;i++)k.push(box.min.clone().set(i&1?box.max.x:box.min.x,i&2?box.max.y:box.min.y,i&4?box.max.z:box.min.z));
  for(let n=0;n<4;n++){d.lookAt(c);d.updateMatrixWorld();let m=0;for(const p of k){const q=p.clone().project(d);m=Math.max(m,Math.abs(q.x),Math.abs(q.y))}if(!(m>0))return;v.multiplyScalar(Math.min(1.6,Math.max(.4,m/.8)));d.position.copy(c).add(v)}d.updateMatrixWorld()}

// ?perf=1 debug overlay: fps, frame ms, long tasks.
function xvPerf(stage){const d=document.createElement("div");d.style.cssText="position:absolute;right:6px;top:6px;z-index:9;background:rgba(0,0,0,.75);color:#0f0;font:11px/1.3 monospace;padding:4px 6px;border-radius:4px;pointer-events:none;white-space:pre";stage.appendChild(d);
 let n=0,t0=performance.now(),fps=0,max=0,lt=0,ltMax=0;window.__xvLT=[];
 try{new PerformanceObserver(l=>{for(const e of l.getEntries()){lt++;ltMax=Math.max(ltMax,e.duration);__xvLT.push(Math.round(e.duration))}}).observe({type:"longtask",buffered:true})}catch{}
 const draw=()=>{d.textContent=`fps ${fps}  frame max ${max.toFixed(1)}ms\nlong tasks ${lt}  max ${Math.round(ltMax)}ms\nDPR ${Math.min(devicePixelRatio,1.5)}${stage.classList.contains("xv-lowq")?" (low-q)":""}`};
 setInterval(()=>{const t=performance.now();fps=Math.round(n*1000/(t-t0));n=0;t0=t;draw();max=0},1000);draw();
 return{frame(ms){n++;max=Math.max(max,ms);performance.mark("xv-frame")}}}
