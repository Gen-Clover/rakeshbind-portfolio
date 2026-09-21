/*
 * Light/dark theme. Loaded in <head> before the stylesheet so the first paint is already in the
 * right theme: dark by default, unless the visitor has chosen light here before. The toggle
 * button(s) with [data-theme-toggle] flip it and remember the choice. Shared by index.html and admin.html.
 */
(function () {
  var KEY = 'theme', root = document.documentElement;
  var META = { dark: '#04050C', light: '#F5F6FB' };

  function saved() { try { return localStorage.getItem(KEY); } catch (e) { return null; } }
  function apply(t) {
    root.setAttribute('data-theme', t);
    var m = document.querySelector('meta[name="theme-color"]');
    if (m) m.setAttribute('content', META[t]);
    var next = t === 'light' ? 'dark' : 'light';
    Array.prototype.forEach.call(document.querySelectorAll('[data-theme-toggle]'), function (b) {
      b.setAttribute('aria-label', 'Switch to ' + next + ' theme');
      b.title = 'Switch to ' + next + ' theme';
    });
  }

  var choice = saved();
  apply(choice === 'light' ? 'light' : 'dark');

  document.addEventListener('DOMContentLoaded', function () {
    apply(root.getAttribute('data-theme'));   // now that the buttons exist, label them
    document.addEventListener('click', function (e) {
      var b = e.target.closest ? e.target.closest('[data-theme-toggle]') : null;
      if (!b) return;
      var t = root.getAttribute('data-theme') === 'light' ? 'dark' : 'light';
      apply(t);
      try { localStorage.setItem(KEY, t); } catch (err) {}
    });
  });
})();
