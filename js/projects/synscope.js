/* SynScope Canted-Mount Explainer — illustrative only. */
(function () {
  'use strict';
  var root = document.querySelector('[data-mount]');
  if (!root) return;
  root.hidden = false;
  root.closest('section').classList.add('mx-enhanced');
  var pod = root.querySelector('.mx-pod'), podSide = root.querySelector('.mx-pod-side'), content = root.querySelector('.mx-screen-content');
  var tilt = document.getElementById('mx-tilt'), tiltOut = document.getElementById('mx-tilt-out');
  var level = document.getElementById('mx-level'), levelState = document.getElementById('mx-level-state');
  var caption = document.getElementById('mx-caption'), status = document.getElementById('mx-status');
  var timer;
  function v(n) { return root.querySelector('input[name="' + n + '"]:checked').value; }

  function render() {
    var view = v('view'), mount = v('mountpos'), hud = v('hud'), on = level.getAttribute('aria-pressed') === 'true';
    var deg = mount === 'top' ? 0 : parseInt(tilt.value, 10);
    tilt.disabled = mount === 'top';
    tiltOut.textContent = deg + '°';
    tilt.setAttribute('aria-valuetext', tilt.value + ' degrees');
    root.dataset.view = view; root.dataset.mountPos = mount; root.dataset.hud = hud; root.dataset.level = on ? 'on' : 'off';
    // Rear view: pod rotates about the rail. Side view: canted pod sits lower beside the optic.
    pod.style.transform = 'rotate(' + deg + 'deg)';
    podSide.style.transform = mount === 'top' ? 'translate(-110px, -6px)' : 'translate(0, ' + (deg / 60 * 14) + 'px)';
    content.style.transform = on ? 'rotate(' + (-deg) + 'deg)' : 'none';
    status.textContent = mount === 'top' ? 'Blocks the optic' : 'Optic clear, display in view';
    var lv = deg === 0 ? 'No tilt to correct.' : (on ? 'Picture stays level with the ground.' : 'Without levelling, the picture tilts with the mount.');
    var txt = status.textContent + '. ' + (hud === 'on' ? lv + ' Illustrative screen, not live data.' : 'Screen off.');
    clearTimeout(timer);
    timer = setTimeout(function () { caption.textContent = txt; }, 120);
  }
  level.addEventListener('click', function () {
    var on = level.getAttribute('aria-pressed') !== 'true';
    level.setAttribute('aria-pressed', String(on));
    levelState.textContent = on ? 'On' : 'Off';
    render();
  });
  root.addEventListener('input', render);
  root.addEventListener('change', render);
  render();
})();
