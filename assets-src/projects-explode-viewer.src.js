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
    camera.near = size / 100; camera.far = size * 20;
    camera.aspect = stage.clientWidth / Math.max(1, stage.clientHeight) || camera.aspect; camera.updateProjectionMatrix();
    applyFactor(1); model.updateMatrixWorld(true); xvFit(camera, box, c, model); applyFactor(factor);
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
    // Project anchors; xvLayout places dots, leader lines, pills and the tooltip.
    const pts = [];
    for (const e of entries) {
      v.copy(e.local); e.node.localToWorld(v); v.project(camera);
      e.tag.classList.toggle('is-sel', e.p.node === selected);
      pts.push({ Z: e, x: (v.x * .5 + .5) * w, y: (-v.y * .5 + .5) * h });
    }
    xvLayout(pts, w, h, selected, labelLayer);
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

// Label layout for the explode viewer: anchor dot at the part, leader line, pill pushed away
// from the model centre, 2D collision relaxation (x and y), canvas clamping, drop-on-crowding,
// and one small tooltip for the hovered (or tapped) part only.
function xvLayout(L,W,H,sel,X){
  if(!X._svg){X._svg=document.createElementNS("http://www.w3.org/2000/svg","svg");X._svg.setAttribute("class","xv-lines");X.prepend(X._svg);
    X._tip=document.createElement("div");X._tip.className="xv-tip";X._tip.setAttribute("role","tooltip");X.appendChild(X._tip);X._hover=null;X._touch=false;
    X.ownerDocument.addEventListener("pointerdown",e=>{X._touch=e.pointerType!=="mouse"},true);}
  const pad=4,gap=6,small=W<560;
  let cx=0,cy=0;for(const o of L){cx+=o.x;cy+=o.y}cx/=L.length||1;cy/=L.length||1;
  for(const o of L){const Z=o.Z;
    if(!Z._dot){Z._dot=document.createElement("span");Z._dot.className="xv-dot";X.appendChild(Z._dot);
      Z._ln=document.createElementNS("http://www.w3.org/2000/svg","line");X._svg.appendChild(Z._ln);
      Z.tag.addEventListener("mouseenter",()=>{X._hover=Z});Z.tag.addEventListener("mouseleave",()=>{if(X._hover===Z)X._hover=null});
      Z.tag.addEventListener("focus",()=>{X._hover=Z});Z._dot.addEventListener("mouseenter",()=>{X._hover=Z;Z.tag.dispatchEvent(new Event("mouseenter"))});Z._dot.addEventListener("click",e=>{e.stopPropagation();X._hover=Z;Z.tag.click()});Z._dot.addEventListener("mouseleave",()=>{if(X._hover===Z)X._hover=null});Z.tag.addEventListener("blur",()=>{if(X._hover===Z)X._hover=null});}
    if(Z.tag.offsetWidth){Z._w=Z.tag.offsetWidth;Z._h=Z.tag.offsetHeight}o.w=Z._w||60;o.h=Z._h||18;
    let dx=o.x-cx,dy=o.y-cy,d=Math.hypot(dx,dy);if(d<1){dx=0;dy=-1;d=1}
    const R=(small?22:34)+Math.min(W,H)*0.04;
    o.tx=o.x+dx/d*(R+o.w*0.35);o.ty=o.y+dy/d*(R+o.h*0.5);
    if(Z._lx===undefined||Math.hypot(Z._lx-o.tx,Z._ly-o.ty)>W*0.25){Z._lx=o.tx;Z._ly=o.ty}
    o.lx=Z._lx;o.ly=Z._ly;o.on=true}
  // priority cap: many-part models show the first (major) parts labelled; the rest are dots until hovered/tapped
  const keep=o=>o.Z.p.node===sel||o.Z===X._hover,cap=Math.max(6,Math.min(16,Math.floor(W*H/(small?14000:30000)))),all=L;
  all.forEach((o,i)=>{o.rank=all.length>cap&&i>=cap;o.minor=o.rank&&!keep(o)});L=all.filter(o=>!o.minor);
  const clamp=o=>{o.lx=Math.min(Math.max(o.lx,o.w/2+pad),W-o.w/2-pad);o.ly=Math.min(Math.max(o.ly,o.h/2+pad),H-o.h/2-pad)};
  const ov=(a,b)=>{const ox=(a.w+b.w)/2+gap-Math.abs(a.lx-b.lx),oy=(a.h+b.h)/2+gap/2-Math.abs(a.ly-b.ly);return ox>0&&oy>0?[ox,oy]:null};
  for(let it=0;it<60;it++){
    for(const o of L){o.lx+=(o.tx-o.lx)*0.08;o.ly+=(o.ty-o.ly)*0.08}
    for(let i=0;i<L.length;i++)for(let j=i+1;j<L.length;j++){const a=L[i],b=L[j],r=ov(a,b);if(!r)continue;
      if(r[0]<r[1]*2.2){const s=(a.lx<b.lx?-1:1)*r[0]/2;a.lx+=s;b.lx-=s}else{const s=(a.ly<b.ly?-1:1)*r[1]/2;a.ly+=s;b.ly-=s}}
    // keep pills off other parts' anchor dots
    for(const o of L)for(const p of L){if(p===o)continue;const ox=o.w/2+5-Math.abs(o.lx-p.x),oy=o.h/2+5-Math.abs(o.ly-p.y);if(ox>0&&oy>0){if(ox<oy)o.lx+=(o.lx<p.x?-1:1)*ox;else o.ly+=(o.ly<p.y?-1:1)*oy}}
    for(const o of L)clamp(o)}
  // fallback: drop labels that still collide (keep selected/hovered, then the one nearer its target)
  for(let i=0;i<L.length;i++)for(let j=i+1;j<L.length;j++){const a=L[i],b=L[j];if(!a.on||!b.on||!ov(a,b))continue;
    const da=Math.hypot(a.lx-a.tx,a.ly-a.ty)-(keep(a)?1e6:0),db=Math.hypot(b.lx-b.tx,b.ly-b.ty)-(keep(b)?1e6:0);(da>db?a:b).on=false}
  for(const o of all)if(o.minor)o.on=false;L=all;
  for(const o of L){const Z=o.Z;Z._lx=o.lx;Z._ly=o.ly;
    Z.tag.style.transform=`translate(${o.lx}px, ${o.ly}px)`;Z.tag.classList.toggle("is-off",!o.on);
    Z._dot.classList.toggle("is-minor",!!o.rank);Z._dot.style.transform=`translate(${o.x}px, ${o.y}px)`;
    Z._ln.setAttribute("x1",o.x);Z._ln.setAttribute("y1",o.y);Z._ln.setAttribute("x2",o.lx);Z._ln.setAttribute("y2",o.ly);Z._ln.style.display=o.on?"":"none"}
  // tooltip: hovered label (mouse) or tapped part (touch) only
  const T=X._hover||(X._touch?L.map(o=>o.Z).find(Z=>Z.p.node===sel):null),tip=X._tip,t=T&&L.find(o=>o.Z===T);
  if(t&&t.on){if(tip._for!==T){tip.textContent=T.p.description;tip._for=T}tip.classList.add("is-on");
    const tw=tip.offsetWidth,th=tip.offsetHeight;let x=t.lx+t.w/2+8;if(x+tw>W-pad)x=t.lx-t.w/2-8-tw;if(x<pad)x=Math.min(Math.max(t.lx-tw/2,pad),W-tw-pad);
    let y=t.ly-th/2;if(x===Math.min(Math.max(t.lx-tw/2,pad),W-tw-pad))y=t.ly+t.h/2+6;if(y+th>H-pad)y=t.ly-t.h/2-6-th;y=Math.max(pad,y);
    tip.style.transform=`translate(${x}px, ${y}px)`;X.classList.add("has-tip")}else{tip.classList.remove("is-on");tip._for=null;X.classList.remove("has-tip")}
}

// fit camera distance so the exploded bbox fills ~80% of the frame (diagonal fit left big margins on tall explodes)
function xvFit(d,box,c,obj){const k=[],v=d.position.clone().sub(c);
  if(obj)obj.traverse(o=>{const g=o.isMesh&&o.geometry&&o.geometry.attributes.position;if(!g)return;const st=Math.max(1,Math.floor(g.count/400));for(let i=0;i<g.count;i+=st)k.push(box.min.clone().fromBufferAttribute(g,i).applyMatrix4(o.matrixWorld))});
  if(!k.length)for(let i=0;i<8;i++)k.push(box.min.clone().set(i&1?box.max.x:box.min.x,i&2?box.max.y:box.min.y,i&4?box.max.z:box.min.z));
  for(let n=0;n<4;n++){d.lookAt(c);d.updateMatrixWorld();let m=0;for(const p of k){const q=p.clone().project(d);m=Math.max(m,Math.abs(q.x),Math.abs(q.y))}if(!(m>0))return;v.multiplyScalar(Math.min(1.6,Math.max(.4,m/.8)));d.position.copy(c).add(v)}d.updateMatrixWorld()}
