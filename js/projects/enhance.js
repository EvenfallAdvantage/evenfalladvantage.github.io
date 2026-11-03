/* Projects section enhancements: scroll reveals, count-up numbers, section nav, lightbox, lazy 3D viewer. */
(function () {
  'use strict';
  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var hasIO = 'IntersectionObserver' in window;
  var $$ = function (sel, ctx) { return Array.prototype.slice.call((ctx || document).querySelectorAll(sel)); };

  // 1. Scroll reveals
  var revealEls = $$('.pj-section .container > *, .pj-project, .pj-keys li');
  if (!reduced && hasIO) {
    document.documentElement.classList.add('pj-js-reveal');
    var ro = new IntersectionObserver(function (es) {
      es.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add('is-in'); ro.unobserve(e.target); } });
    }, { rootMargin: '0px 0px -8% 0px' });
    revealEls.forEach(function (el, i) { el.style.setProperty('--pj-d', (i % 4) * 70 + 'ms'); ro.observe(el); });
  }

  // 2. Count-up key numbers (values come from the page itself)
  function fmt(el, v) { var d = +el.dataset.decimals || 0; el.textContent = (el.dataset.prefix || '') + v.toFixed(d) + (el.dataset.suffix || ''); }
  var counts = $$('.pj-count');
  if (!reduced && hasIO) {
    var co = new IntersectionObserver(function (es) {
      es.forEach(function (e) {
        if (!e.isIntersecting) return; co.unobserve(e.target);
        var el = e.target, end = parseFloat(el.dataset.count), t0 = performance.now(), dur = 1200;
        (function step(t) { var p = Math.min(1, (t - t0) / dur); fmt(el, end * (1 - Math.pow(1 - p, 3))); if (p < 1) requestAnimationFrame(step); })(t0);
      });
    }, { threshold: 0.6 });
    counts.forEach(function (el) { fmt(el, 0); co.observe(el); });
  }

  // 3. Sticky in-page section nav
  var nav = document.querySelector('.pj-secnav ul');
  if (nav) {
    var heads = $$('.pj-section h2[id]');
    var links = heads.map(function (h) {
      var li = document.createElement('li'), a = document.createElement('a');
      a.href = '#' + h.id; a.textContent = h.textContent.replace(/^Why .*/, 'Overview').replace('Status and roadmap', 'Roadmap').replace('Mission Endurance Explorer', 'Endurance').replace('Canted-Mount Explainer', 'Mount').replace("What's in the kit", 'Kit');
      li.appendChild(a); nav.appendChild(li); return a;
    });
    if (hasIO) {
      var so = new IntersectionObserver(function (es) {
        es.forEach(function (e) {
          if (!e.isIntersecting) return;
          var id = e.target.querySelector('h2[id]').id;
          links.forEach(function (a) { var on = a.getAttribute('href') === '#' + id; a.classList.toggle('is-active', on); if (on) { a.setAttribute('aria-current', 'true'); if (a.scrollIntoView && nav.scrollWidth > nav.clientWidth) nav.scrollLeft = a.offsetLeft - 16; } else a.removeAttribute('aria-current'); });
        });
      }, { rootMargin: '-45% 0px -50% 0px' });
      heads.forEach(function (h) { so.observe(h.closest('section')); });
    }
  }

  // 4. Lightbox gallery (arrows, Esc, swipe)
  var figs = $$('.pj-gallery figure');
  if (figs.length) {
    var box = document.createElement('div');
    box.className = 'pj-lb'; box.hidden = true; box.setAttribute('role', 'dialog'); box.setAttribute('aria-modal', 'true'); box.setAttribute('aria-label', 'Image viewer');
    box.innerHTML = '<button type="button" class="pj-lb-close" aria-label="Close"><i class="fas fa-xmark"></i></button><button type="button" class="pj-lb-prev" aria-label="Previous image"><i class="fas fa-chevron-left"></i></button><figure><img alt=""><figcaption></figcaption></figure><button type="button" class="pj-lb-next" aria-label="Next image"><i class="fas fa-chevron-right"></i></button><p class="pj-lb-count" aria-live="polite"></p>';
    document.body.appendChild(box);
    var img = box.querySelector('img'), cap = box.querySelector('figcaption'), cnt = box.querySelector('.pj-lb-count'), idx = 0, opener = null;
    function show(i) {
      idx = (i + figs.length) % figs.length;
      var src = figs[idx].querySelector('img');
      img.src = src.currentSrc || src.src; img.alt = src.alt;
      cap.textContent = (figs[idx].querySelector('figcaption') || {}).textContent || '';
      cnt.textContent = (idx + 1) + ' / ' + figs.length;
    }
    function open(i) { opener = document.activeElement; show(i); box.hidden = false; document.body.classList.add('pj-lb-open'); box.querySelector('.pj-lb-close').focus(); }
    function close() { box.hidden = true; document.body.classList.remove('pj-lb-open'); if (opener) opener.focus(); }
    figs.forEach(function (f, i) {
      f.tabIndex = 0; f.setAttribute('role', 'button'); f.setAttribute('aria-label', 'Enlarge: ' + f.querySelector('img').alt);
      f.addEventListener('click', function () { open(i); });
      f.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(i); } });
    });
    box.querySelector('.pj-lb-close').onclick = close;
    box.querySelector('.pj-lb-prev').onclick = function () { show(idx - 1); };
    box.querySelector('.pj-lb-next').onclick = function () { show(idx + 1); };
    box.addEventListener('click', function (e) { if (e.target === box) close(); });
    document.addEventListener('keydown', function (e) {
      if (box.hidden) return;
      if (e.key === 'Escape') close(); else if (e.key === 'ArrowLeft') show(idx - 1); else if (e.key === 'ArrowRight') show(idx + 1);
      else if (e.key === 'Tab') { var b = $$('button', box), first = b[0], last = b[b.length - 1]; if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); } else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); } }
    });
    var sx = null;
    box.addEventListener('touchstart', function (e) { sx = e.touches[0].clientX; }, { passive: true });
    box.addEventListener('touchend', function (e) { if (sx === null) return; var dx = e.changedTouches[0].clientX - sx; if (Math.abs(dx) > 40) show(idx + (dx < 0 ? 1 : -1)); sx = null; });
  }

  // 5. Lazy exploded 3D viewer (WebGL + module support required; posters stay otherwise)
  // No-WebGL fallback: the Explode button (only) swaps between the assembled and exploded posters.
  function xvStatic(root) {
    if (root.classList.contains('is-static')) return;
    root.classList.add('is-static');
    var t = root.querySelector('.xv-toggle'); if (!t) return;
    t.addEventListener('click', function () {
      var on = !root.classList.contains('is-x'); root.classList.toggle('is-x', on);
      t.setAttribute('aria-pressed', String(on));
      var sp = t.querySelector('span'); if (sp) sp.textContent = on ? 'Assemble' : 'Explode';
    });
  }
  $$('.xv').forEach(function (root) {
    var c = document.createElement('canvas');
    var gl = c.getContext && (c.getContext('webgl2') || c.getContext('webgl'));
    if (!gl) { xvStatic(root); return; }
    var go = function () {
      root.classList.add('is-loading');
      import('/js/projects/explode-viewer.js').then(function (m) { return m.mount(root); })
        .catch(function (err) { console.warn('3D viewer unavailable', err); xvStatic(root); })
        .then(function () { root.classList.remove('is-loading'); });
    };
    if (!hasIO) return go();
    var io = new IntersectionObserver(function (es) { if (es[0].isIntersecting) { io.disconnect(); go(); } }, { rootMargin: '200px' });
    io.observe(root);
  });
})();
(function () {
  document.querySelectorAll('.pj-timeline').forEach(function (ol) {
    var li = ol.children, cur = ol.querySelector('.is-current'), i = Array.prototype.indexOf.call(li, cur);
    if (i >= 0 && li.length > 1) ol.style.setProperty('--pj-progress', (i / (li.length - 1) * 100) + '%');
  });
  var h = document.querySelector('.site-header');
  var set = function () { var hh = document.querySelector('.site-header'); if (hh && getComputedStyle(hh).position.match(/fixed|sticky/)) document.documentElement.style.setProperty('--pj-header-h', hh.offsetHeight + 'px'); else document.documentElement.style.setProperty('--pj-header-h', '0px'); };
  setTimeout(set, 600); window.addEventListener('resize', set);
})();
