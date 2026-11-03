/* SynScope Canted-Mount Explainer — swaps illustrative renders. */
(function () {
  'use strict';
  var root = document.querySelector('[data-mount]');
  if (!root) return;
  root.hidden = false;
  root.closest('section').classList.add('mx-enhanced');
  var shots = root.querySelectorAll('.mx-shot');
  var caption = document.getElementById('mx-caption'), status = document.getElementById('mx-status');
  var timer;
  function v(n) { return root.querySelector('input[name="' + n + '"]:checked').value; }
  // Warm the other states once the explainer is near view so toggles crossfade instantly.
  function preload() {
    shots.forEach(function (p) { var i = p.querySelector('img'); i.loading = 'eager'; if (i.decode) i.decode().catch(function () {}); });
  }
  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (e) { if (e.some(function (x) { return x.isIntersecting; })) { preload(); io.disconnect(); } }, { rootMargin: '400px' });
    io.observe(root);
  } else preload();

  function render() {
    var view = v('view') === 'side' ? 'side' : 'eye', mount = v('mountpos');
    var m = mount === 'top' ? 'toprail' : 'offset45';
    root.dataset.view = view; root.dataset.mountPos = mount;
    shots.forEach(function (p) {
      var on = p.dataset.v === view && p.dataset.m === m;
      p.classList.toggle('is-on', on);
      p.querySelector('img').setAttribute('aria-hidden', on ? 'false' : 'true');
    });
    status.textContent = mount === 'top' ? 'Blocks the optic' : 'Optic clear, display in view';
    var txt = status.textContent + '. Illustrative screen, not live data.';
    clearTimeout(timer);
    timer = setTimeout(function () { caption.textContent = txt; }, 120);
  }
  root.addEventListener('change', render);
  render();
})();
