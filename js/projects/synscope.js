/* SynScope mount simulator: captions + poster fallback; loads the 3D module when WebGL is available. */
(function () {
  'use strict';
  var root = document.querySelector('[data-mount]');
  if (!root) return;
  root.hidden = false;
  root.closest('section').classList.add('mx-enhanced');
  var shots = root.querySelectorAll('.mx-shot');
  var caption = document.getElementById('mx-caption'), status = document.getElementById('mx-status');
  var timer;
  function pos() { return root.querySelector('input[name="mountpos"]:checked').value === 'top' ? 'toprail' : 'offset45'; }
  function render() {
    var m = pos();
    root.dataset.mountPos = m === 'toprail' ? 'top' : 'canted';
    shots.forEach(function (p) { var on = p.dataset.m === m; p.classList.toggle('is-on', on); p.querySelector('img').setAttribute('aria-hidden', on ? 'false' : 'true'); });
    status.textContent = m === 'toprail' ? 'Blocks the sights' : 'Sightline clear, display in view';
    clearTimeout(timer);
    timer = setTimeout(function () { caption.textContent = status.textContent + '. Illustrative screen, not live data.'; }, 120);
  }
  root.addEventListener('change', render);
  render();

  var c = document.createElement('canvas');
  var gl = c.getContext && (c.getContext('webgl2') || c.getContext('webgl'));
  if (!gl) { shots.forEach(function (p) { var i = p.querySelector('img'); i.loading = 'eager'; }); return; }
  var go = function () {
    root.classList.add('is-loading');
    import('/js/projects/mount-sim.js').then(function (mod) { return mod.mount(root); })
      .catch(function (err) { console.warn('3D mount unavailable', err); })
      .then(function () { root.classList.remove('is-loading'); });
  };
  if (!('IntersectionObserver' in window)) return go();
  var io = new IntersectionObserver(function (es) { if (es[0].isIntersecting) { io.disconnect(); go(); } }, { rootMargin: '200px' });
  io.observe(root);
})();
