(function () {
  'use strict';
  var btn = document.getElementById('ct-toggle');
  if (!btn) return;
  btn.addEventListener('click', function () {
    var el = document.documentElement;
    var cur = el.getAttribute('data-theme');
    if (!cur) cur = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    var next = cur === 'dark' ? 'light' : 'dark';
    el.setAttribute('data-theme', next);
    try { localStorage.setItem('ce-theme', next); } catch (e) {}
  });
})();
