/* Overwatch Tactical Edition — kit hotspot diagram. */
(function () {
  'use strict';
  var root = document.querySelector('[data-hotspots]');
  var dataEl = document.getElementById('hs-data');
  if (!root || !dataEl) return;
  var items = JSON.parse(dataEl.textContent);
  var dots = Array.prototype.slice.call(root.querySelectorAll('.hs-dot'));
  var card = document.getElementById('hs-card'), title = document.getElementById('hs-title'), body = document.getElementById('hs-body');
  var flowBtn = root.querySelector('.hs-flow-btn'), flowNote = root.querySelector('.hs-flow-note');
  var listItems = root.querySelectorAll('.hs-list li');
  dots.forEach(function (d) { d.hidden = false; });
  flowBtn.hidden = false;
  var current = null;

  function select(id, focusCard) {
    current = id;
    var item = items.filter(function (i) { return i.id === id; })[0];
    dots.forEach(function (d) { d.setAttribute('aria-expanded', String(d.dataset.id === id)); });
    listItems.forEach(function (li) { li.classList.toggle('is-sel', li.dataset.id === id); });
    root.classList.toggle('has-sel', !!item);
    if (!item) { card.hidden = true; return; }
    title.textContent = item.title; body.textContent = item.body; card.hidden = false;
  }
  dots.forEach(function (d, i) {
    d.addEventListener('click', function (e) { e.stopPropagation(); select(current === d.dataset.id ? null : d.dataset.id); });
    d.addEventListener('keydown', function (e) {
      var k = e.key, n = null;
      if (k === 'ArrowRight' || k === 'ArrowDown') n = (i + 1) % dots.length;
      if (k === 'ArrowLeft' || k === 'ArrowUp') n = (i - 1 + dots.length) % dots.length;
      if (n !== null) { e.preventDefault(); dots[n].focus(); select(dots[n].dataset.id); }
    });
  });
  card.querySelector('.hs-close').addEventListener('click', function () {
    var prev = current; select(null);
    var d = dots.filter(function (x) { return x.dataset.id === prev; })[0]; if (d) d.focus();
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && current) { var prev = current; select(null); var d = dots.filter(function (x) { return x.dataset.id === prev; })[0]; if (d) d.focus(); }
  });
  document.addEventListener('click', function (e) { if (current && !card.contains(e.target) && !root.querySelector('.hs-stage').contains(e.target)) select(null); });
  flowBtn.addEventListener('click', function () {
    var on = flowBtn.getAttribute('aria-pressed') !== 'true';
    flowBtn.setAttribute('aria-pressed', String(on));
    flowBtn.textContent = on ? 'Hide data flow' : 'Show data flow';
    root.classList.toggle('show-flow', on); flowNote.hidden = !on;
  });
})();
