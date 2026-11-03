/* HUGINN Mission Endurance Explorer — illustrative model (design estimates). */
(function () {
  'use strict';
  // Perched full-AI watch on battery, hours (confirmed 10.9 h by Metalika, 3 Nov 2026). Single source of truth; never show 24 h.
  var PERCH_WATCH_HOURS = 10.9;
  var BASE_FLIGHT_HOURS = 3.2;   // no sun, no lift
  var SCALE_HOURS = 12;          // chart scale (ticks every 2 h)

  var root = document.querySelector('[data-endurance]');
  if (!root) return;
  var section = root.closest('section');
  root.hidden = false;
  if (section) section.classList.add('ee-enhanced');

  var $ = function (id) { return document.getElementById(id); };
  var range = $('ee-perch'), out = $('ee-perch-out'), total = $('ee-total');
  var flyH = $('ee-fly-h'), perchH = $('ee-perch-h'), explain = $('ee-explain');
  var bar = root.querySelector('.ee-bar'), fly = root.querySelector('.ee-fly'), perch = root.querySelector('.ee-perch');
  var timer = null;

  function val(name) { var el = root.querySelector('input[name="' + name + '"]:checked'); return el ? parseFloat(el.value) : 0; }
  function fmt(h) { return h.toFixed(1) + ' h'; }

  function compute(s, l, pct) {
    var tFlight = BASE_FLIGHT_HOURS / (1 - 0.30 * s - 0.28 * l);
    var p = pct / 100;
    var t = 1 / ((1 - p) / tFlight + p / PERCH_WATCH_HOURS);
    return { total: t, flight: t * (1 - p), perched: t * p };
  }

  function render(announce) {
    var s = val('sun'), l = val('lift'), pct = parseInt(range.value, 10);
    var r = compute(s, l, pct);
    out.textContent = pct + ' %';
    range.setAttribute('aria-valuetext', pct + ' % perched');
    bar.style.width = Math.min(100, r.total / SCALE_HOURS * 100) + '%';
    fly.style.flexBasis = (r.flight / r.total * 100) + '%';
    perch.style.flexBasis = (r.perched / r.total * 100) + '%';
    flyH.textContent = fmt(r.flight);
    perchH.textContent = fmt(r.perched);
    root.classList.toggle('is-perched', pct >= 50);
    explain.textContent = pct >= 50
      ? 'Most of the mission is spent perched, where HUGINN needs far less power than flying. Sun on the perch can extend this further.'
      : (s + l >= 1.5 ? 'Sun and rising air let HUGINN glide far longer than battery alone.' : 'Battery-only glide: no sun, no lift.');
    // Debounce the live-region text so screen readers aren't flooded while dragging.
    clearTimeout(timer);
    var txt = '≈ ' + fmt(r.total);
    if (announce) timer = setTimeout(function () { total.textContent = txt; }, 100);
    else total.textContent = txt;
  }

  root.addEventListener('input', function () { render(true); });
  root.addEventListener('change', function () { render(true); });
  render(false);

  // Expose model for QA in console only.
  window.__huginnEndurance = compute;
})();
