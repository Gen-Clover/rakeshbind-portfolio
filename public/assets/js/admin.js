/*
 * Admin app (admin.html).
 *
 *   #/                 hub: one tile per module
 *   #/recommendations  edit the What People Say cards   -> PUT /api/recommendations
 *   #/resume           replace the resume PDF            -> PUT /api/resume
 *   #/availability     edit the Open-to-work badge       -> PUT /api/availability
 *   #/career           edit the Home page timeline       -> PUT /api/career
 *
 * Adding a module: add a tile + <section class="view" id="m-NAME"> in admin.html, then register
 * it in MODULES below with an optional enter() that loads its data the first time it opens.
 * Auth is a server-side session cookie (see api/auth.js); every write is checked on the server.
 */
(function () {
  var RB = window.RB, API = RB.API, REL = RB.REL, esc = RB.esc, initialsOf = RB.initialsOf, fmtBytes = RB.fmtBytes, normRec = RB.normRec, recCard = RB.recCard, getJson = RB.getJson;
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  var auth = { signedIn: false, checked: false };
  var current = null;

  function say(id, text, kind) { var el = $(id); if (!el) return; el.innerHTML = text || ''; el.className = 'msg' + (kind ? ' ' + kind : ''); }
  function post(url, body) { return getJson(url, { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }); }
  function put(url, body) { return getJson(url, { method: 'PUT', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }); }

  /* ======================================================================
     Routing
     ====================================================================== */
  var MODULES = {
    hub: {},
    recommendations: { enter: function () { Recs.enter(); }, dirty: function () { return Recs.dirty; } },
    resume: { enter: function () { Resume.enter(); } },
    availability: { enter: function () { Avail.enter(); }, dirty: function () { return Avail.dirty; } },
    career: { enter: function () { Career.enter(); }, dirty: function () { return Career.dirty; } }
  };

  function moduleFromHash() {
    var m = (location.hash.match(/^#\/([a-z-]+)/) || [])[1] || 'hub';
    return MODULES[m] ? m : 'hub';
  }
  function showView(id) {
    $$('main .view').forEach(function (v) { v.classList.toggle('on', v.id === 'm-' + id); });
    window.scrollTo(0, 0);
  }
  function route() {
    var m = moduleFromHash();
    if (!auth.signedIn) { showView('login'); $('#admNav').hidden = true; $('#admSignOut').hidden = true; return; }
    $('#admNav').hidden = false; $('#admSignOut').hidden = false;
    $$('#admNav a').forEach(function (a) { a.classList.toggle('act', a.dataset.m === m); });
    showView(m);
    document.title = (m === 'hub' ? 'Admin' : 'Admin · ' + m.charAt(0).toUpperCase() + m.slice(1)) + ' - Rakesh Bind';
    if (m !== current && MODULES[m].enter) MODULES[m].enter();
    current = m;
  }
  window.addEventListener('hashchange', route);

  /* ======================================================================
     Auth
     ====================================================================== */
  function checkSession() {
    if (location.protocol === 'file:') { say('#admLoginMsg', 'The admin needs the API. Run <code>npm run dev:local</code> or open it on Vercel.', 'err'); route(); return; }
    getJson(API.auth, { credentials: 'same-origin', cache: 'no-store' }).then(function (s) {
      auth.checked = true; auth.signedIn = !!s.admin;
      if (!s.configured) say('#admLoginMsg', 'ADMIN_PASSWORD is not set on the server yet. Add it in Vercel → Settings → Environment Variables and redeploy.', 'err');
      route();
    }).catch(function (e) {
      say('#admLoginMsg', 'The API is not reachable (' + esc(e.message) + '). Locally, run <code>npm run dev:local</code>; a plain static server has no /api.', 'err');
      route();
    });
  }
  function signIn(e) {
    if (e) e.preventDefault();
    var pass = $('#admPass').value;
    if (!pass) { say('#admLoginMsg', 'Enter the password.', 'err'); return; }
    $('#admSignIn').disabled = true;
    say('#admLoginMsg', 'Signing in…');
    post(API.auth, { password: pass })
      .then(function () { $('#admPass').value = ''; say('#admLoginMsg', ''); auth.signedIn = true; current = null; route(); })
      .catch(function (err) { say('#admLoginMsg', esc(err.message), 'err'); })
      .then(function () { $('#admSignIn').disabled = false; });
  }
  function signOut() {
    if (Recs.dirty && !confirm('You have unpublished changes. Sign out anyway?')) return;
    post(API.auth, { action: 'logout' }).catch(function () {});
    auth.signedIn = false; current = null; Recs.reset(); Avail.loaded = false; Avail.dirty = false; Career.reset();
    location.hash = '#/';
    route();
    say('#admLoginMsg', 'Signed out.');
  }
  /* A 401 from any write means the cookie expired: drop back to the login screen, keep edits in memory */
  function expired() {
    auth.signedIn = false; current = null; route();
    say('#admLoginMsg', 'Your session expired. Sign in again; your unpublished edits are kept until you reload the page.', 'err');
  }

  /* ======================================================================
     Module: recommendations
     ====================================================================== */
  var Recs = {
    items: [], featured: 6, sel: -1, dirty: false, source: '', loaded: false,

    reset: function () { Recs.items = []; Recs.sel = -1; Recs.dirty = false; Recs.loaded = false; Recs.setDirty(false); },
    enter: function () { if (!Recs.loaded) Recs.load().catch(function (e) { say('#admMsg', 'Load failed: ' + esc(e.message), 'err'); }); },
    setDirty: function (d) {
      Recs.dirty = d;
      $('#admPublish').disabled = !d;
      $('#admPublish').textContent = d ? 'Publish changes' : 'Publish';
    },
    status: function (extra) {
      var vis = Recs.items.filter(function (r) { return !r.hidden; }).length;
      $('#admStatus').textContent = Recs.items.length + ' cards · ' + vis + ' visible · ' + (Recs.source === 'db' ? 'database' : Recs.source === 'file' ? 'local file (dev)' : 'unsaved') + (extra ? ' · ' + extra : '');
    },
    apply: function (doc, source) {
      Recs.items = (doc.items || []).map(normRec);
      Recs.featured = parseInt(doc.featured, 10) || 6;
      Recs.source = source;
    },
    load: function () {
      say('#admMsg', 'Loading…');
      return getJson(API.recs + '?fresh=1', { credentials: 'same-origin', cache: 'no-store' }).then(function (doc) {
        Recs.apply(doc, doc.source || 'db'); Recs.loaded = true;
        Recs.setDirty(false); Recs.status(); Recs.close();
        say('#admMsg', Recs.items.length ? 'Loaded ' + Recs.items.length + ' cards.' : 'The database is empty. Click "Import from file" to load the cards from recommendations.json, then Publish.', Recs.items.length ? 'ok' : '');
      });
    },
    importFile: function () {
      if (Recs.dirty && !confirm('Replace your unpublished edits with the cards from recommendations.json?')) return;
      getJson('recommendations.json?v=' + Date.now(), { cache: 'no-store' }).then(function (doc) {
        Recs.apply(doc, Recs.source); Recs.setDirty(true); Recs.status(); Recs.close();
        say('#admMsg', 'Imported ' + Recs.items.length + ' cards from recommendations.json. Review them, then click Publish to save to the database.', 'ok');
      }).catch(function (e) { say('#admMsg', 'Import failed: ' + esc(e.message), 'err'); });
    },
    publish: function () {
      if (!Recs.dirty) return;
      $('#admPublish').disabled = true;
      say('#admMsg', 'Publishing…');
      put(API.recs, { featured: Recs.featured, items: Recs.items })
        .then(function (doc) {
          Recs.apply(doc, doc.source || 'db'); Recs.setDirty(false); Recs.status('saved ' + new Date().toLocaleTimeString()); Recs.renderList();
          say('#admMsg', 'Published. The site is showing the new cards now.', 'ok');
        })
        .catch(function (e) {
          $('#admPublish').disabled = false;
          if (e.status === 401) { expired(); return; }
          say('#admMsg', 'Publish failed: ' + esc(e.message), 'err');
        });
    },
    download: function () {
      var a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob([JSON.stringify({ updated: new Date().toISOString().slice(0, 10), featured: Recs.featured, items: Recs.items }, null, 2) + '\n'], { type: 'application/json' }));
      a.download = 'recommendations.json'; document.body.appendChild(a); a.click(); a.remove();
    },

    renderList: function () {
      var feat = Recs.featured, vis = 0;
      $('#admFeatN').textContent = feat;
      $('#admList').innerHTML = Recs.items.map(function (r, i) {
        var featured = !r.hidden && vis < feat; if (!r.hidden) vis++;
        return '<li data-i="' + i + '" class="' + (i === Recs.sel ? 'sel ' : '') + (r.hidden ? 'hid ' : '') + (featured ? 'is-feat' : '') + '">' +
          '<span class="n">' + (i + 1) + '</span>' +
          '<span class="av" style="--av:' + esc(r.color) + '">' + esc(r.initials || initialsOf(r.name)) + '</span>' +
          '<span class="nm">' + esc(r.name || 'Untitled') + '<small>' + esc(r.relationship || REL[r.relType]) + (r.date ? ' · ' + esc(r.date) : '') + '</small></span>' +
          (r.hidden ? '<span class="tag">hidden</span>' : featured ? '<span class="tag">featured</span>' : '') +
          '<span class="mv"><button type="button" data-mv="-1" aria-label="Move up"' + (i === 0 ? ' disabled' : '') + '>&#9650;</button><button type="button" data-mv="1" aria-label="Move down"' + (i === Recs.items.length - 1 ? ' disabled' : '') + '>&#9660;</button></span>' +
          '</li>';
      }).join('') || '<li style="cursor:default;color:var(--dim)">No cards yet. Click + New, or "Import from file" to load recommendations.json.</li>';
    },
    fill: function (r) {
      $('#fName').value = r.name; $('#fInitials').value = r.initials; $('#fTitle').value = r.title;
      $('#fRel').value = r.relType; $('#fRelLabel').value = r.relationship === REL[r.relType] ? '' : r.relationship;
      $('#fDate').value = r.date; $('#fProfile').value = r.profile; $('#fColor').value = r.color; $('#fColorHex').textContent = r.color;
      $('#fText').value = r.text; $('#fHidden').checked = r.hidden;
    },
    read: function () {
      var relType = $('#fRel').value, label = $('#fRelLabel').value.trim();
      var base = Recs.sel >= 0 ? Recs.items[Recs.sel] : {};
      return normRec({
        id: base.id, name: $('#fName').value.trim(), initials: $('#fInitials').value.trim().toUpperCase(), title: $('#fTitle').value.trim(),
        relType: relType, relationship: label || REL[relType], date: $('#fDate').value.trim(), profile: $('#fProfile').value.trim(),
        color: $('#fColor').value.toUpperCase(), text: $('#fText').value.replace(/\r/g, '').trim(), hidden: $('#fHidden').checked
      });
    },
    preview: function () {
      var r = Recs.read();
      $('#admPreview').innerHTML = recCard(r, 0, false);
      $('#fColorHex').textContent = r.color;
    },
    edit: function (i) {
      Recs.sel = i;
      var r = i >= 0 ? Recs.items[i] : normRec({ name: '', color: '#8FA0FF', date: new Date().toLocaleString('en', { month: 'short', year: 'numeric' }) });
      $('#admFormTitle').textContent = i >= 0 ? 'Edit card' : 'New card';
      $('#admFormId').textContent = i >= 0 ? r.id : '';
      $('#admDelete').hidden = i < 0;
      Recs.fill(r); Recs.preview();
      $('#admForm').hidden = false; $('#admEmpty').hidden = true;
      Recs.renderList();
      if (window.innerWidth <= 1000) $('#admForm').scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
    },
    close: function () {
      Recs.sel = -1;
      $('#admForm').hidden = true; $('#admEmpty').hidden = false;
      Recs.renderList();
    },
    save: function () {
      var r = Recs.read();
      if (!r.name) { say('#admMsg', 'The card needs a name.', 'err'); $('#fName').focus(); return; }
      if (!r.text) { say('#admMsg', 'The card needs the recommendation text.', 'err'); $('#fText').focus(); return; }
      if (Recs.sel >= 0) Recs.items[Recs.sel] = r; else { Recs.items.push(r); Recs.sel = Recs.items.length - 1; }
      Recs.setDirty(true); Recs.renderList(); Recs.status();
      $('#admFormId').textContent = r.id; $('#admFormTitle').textContent = 'Edit card'; $('#admDelete').hidden = false;
      say('#admMsg', 'Saved "' + esc(r.name) + '" in the editor. Click Publish to make it live.', 'ok');
    },
    remove: function () {
      if (Recs.sel < 0 || !confirm('Delete this card? It is removed from the site when you publish.')) return;
      Recs.items.splice(Recs.sel, 1); Recs.setDirty(true); Recs.close(); Recs.status();
    },

    init: function () {
      $('#admReload').addEventListener('click', function () {
        if (Recs.dirty && !confirm('Discard unpublished changes and reload?')) return;
        Recs.load().catch(function (e) { say('#admMsg', 'Reload failed: ' + esc(e.message), 'err'); });
      });
      $('#admImport').addEventListener('click', Recs.importFile);
      $('#admDownload').addEventListener('click', Recs.download);
      $('#admPublish').addEventListener('click', Recs.publish);
      $('#admNew').addEventListener('click', function () { Recs.edit(-1); });
      $('#admList').addEventListener('click', function (e) {
        var mv = e.target.closest('button[data-mv]'), li = e.target.closest('li[data-i]');
        if (!li) return;
        var i = parseInt(li.dataset.i, 10);
        if (mv) {
          var j = i + parseInt(mv.dataset.mv, 10);
          if (j < 0 || j >= Recs.items.length) return;
          var tmp = Recs.items[i]; Recs.items[i] = Recs.items[j]; Recs.items[j] = tmp;
          if (Recs.sel === i) Recs.sel = j; else if (Recs.sel === j) Recs.sel = i;
          Recs.setDirty(true); Recs.renderList(); return;
        }
        Recs.edit(i);
      });
      ['#fName', '#fInitials', '#fTitle', '#fRel', '#fRelLabel', '#fDate', '#fProfile', '#fColor', '#fText', '#fHidden'].forEach(function (id) {
        $(id).addEventListener('input', Recs.preview); $(id).addEventListener('change', Recs.preview);
      });
      $('#admSave').addEventListener('click', Recs.save);
      $('#admCancel').addEventListener('click', Recs.close);
      $('#admDelete').addEventListener('click', Recs.remove);
    }
  };

  /* ======================================================================
     Module: resume
     ====================================================================== */
  var Resume = {
    picked: null, loaded: false,
    enter: function () { if (!Resume.loaded) Resume.load(); },
    show: function (meta) {
      var el = $('#admResumeMeta');
      if (!meta || !meta.exists) { el.textContent = 'No resume uploaded yet'; return; }
      el.textContent = meta.filename + (meta.size ? ' · ' + fmtBytes(meta.size) : '') +
        (meta.updated ? ' · updated ' + new Date(meta.updated).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '') +
        ' · ' + (meta.source === 'db' ? 'database' : meta.source === 'file' ? 'local file (dev)' : 'committed copy in /resume');
    },
    load: function () {
      getJson(API.resume + '?meta=1', { credentials: 'same-origin', cache: 'no-store' })
        .then(function (m) { Resume.loaded = true; Resume.show(m); })
        .catch(function (e) { $('#admResumeMeta').textContent = 'Could not read resume info: ' + e.message; });
    },
    pick: function () {
      var input = $('#admResumeFile'), btn = $('#admResumeUpload');
      Resume.picked = input.files && input.files[0] ? input.files[0] : null;
      btn.disabled = true;
      if (!Resume.picked) { $('#admResumeName').textContent = 'No file chosen'; return; }
      var f = Resume.picked;
      $('#admResumeName').textContent = f.name + ' · ' + fmtBytes(f.size);
      if (!/\.pdf$/i.test(f.name) && f.type !== 'application/pdf') { say('#admResumeMsg', 'Only PDF files are accepted.', 'err'); return; }
      if (f.size > 3 * 1024 * 1024) { say('#admResumeMsg', 'That PDF is ' + fmtBytes(f.size) + '; the limit is 3 MB. Export a compressed PDF and try again.', 'err'); return; }
      say('#admResumeMsg', ''); btn.disabled = false;
    },
    upload: function () {
      var f = Resume.picked, btn = $('#admResumeUpload');
      if (!f) return;
      btn.disabled = true; say('#admResumeMsg', 'Uploading ' + esc(f.name) + '…');
      var fr = new FileReader();
      fr.onerror = function () { btn.disabled = false; say('#admResumeMsg', 'Could not read the file.', 'err'); };
      fr.onload = function () {
        put(API.resume, { filename: f.name, data: String(fr.result).split(',')[1] || '' })
          .then(function (meta) {
            Resume.show({ exists: true, filename: meta.filename, size: meta.size, updated: meta.updated, source: meta.source });
            say('#admResumeMsg', 'Resume replaced. "Get my resume" now downloads ' + esc(meta.filename) + '.', 'ok');
            $('#admResumeFile').value = ''; Resume.picked = null; $('#admResumeName').textContent = 'No file chosen';
            $('#admResumeDl').href = API.resume + '?v=' + Date.now();
          })
          .catch(function (e) {
            btn.disabled = false;
            if (e.status === 401) { expired(); return; }
            say('#admResumeMsg', 'Upload failed: ' + esc(e.message), 'err');
          });
      };
      fr.readAsDataURL(f);
    },
    init: function () {
      $('#admResumeFile').addEventListener('change', Resume.pick);
      $('#admResumeUpload').addEventListener('click', Resume.upload);
    }
  };

  /* ======================================================================
     Module: availability (the "Open to work" badge)
     ====================================================================== */
  var Avail = {
    loaded: false, dirty: false, doc: null,
    enter: function () { if (!Avail.loaded) Avail.load(); },
    read: function () {
      var facts = [];
      for (var i = 0; i < 4; i++) {
        var l = $('#avL' + i).value.trim(), v = $('#avV' + i).value.trim();
        if (l || v) facts.push({ label: l, value: v });
      }
      return { show: $('#avShow').checked, status: $('#avText').value, facts: facts };
    },
    fill: function (doc) {
      $('#avText').value = RB.STATUS[doc.status] ? doc.status : 'open';
      $('#avShow').checked = doc.show !== false;
      for (var i = 0; i < 4; i++) {
        var f = (doc.facts || [])[i] || {};
        $('#avL' + i).value = f.label || ''; $('#avV' + i).value = f.value || '';
      }
      Avail.preview();
    },
    preview: function () {
      var doc = Avail.read(), p = $('#avPreview');
      p.innerHTML = RB.availBadge(doc);
      p.style.opacity = doc.show ? '' : '.35';
      var problems = [];
      doc.facts.forEach(function (f, i) { if (!f.label || !f.value) problems.push('Fact ' + (i + 1) + ' needs both a label and a value.'); });
      say('#avMsg', problems.length ? esc(problems.join(' ')) : (Avail.dirty ? 'Unpublished changes.' : ''), problems.length ? 'err' : '');
      $('#avPublish').disabled = !Avail.dirty || problems.length > 0;
    },
    setDirty: function (d) { Avail.dirty = d; Avail.preview(); },
    status: function (doc) {
      $('#avStatus').textContent = doc && doc.updated ? 'Published ' + doc.updated + ' · ' + (doc.source === 'db' ? 'database' : 'local file (dev)') : 'Using the site\u2019s built-in copy (never published)';
    },
    load: function () {
      $('#avStatus').textContent = 'Loading…';
      getJson(API.avail + '?fresh=1', { credentials: 'same-origin', cache: 'no-store' })
        .catch(function (e) {
          if (e.status !== 404) throw e;
          return getJson('availability.json?v=' + Date.now(), { cache: 'no-store' }).then(function (d) { d.updated = null; return d; });
        })
        .then(function (doc) { Avail.loaded = true; Avail.doc = doc; Avail.fill(doc); Avail.status(doc); Avail.dirty = false; Avail.preview(); })
        .catch(function (e) { say('#avMsg', 'Load failed: ' + esc(e.message), 'err'); $('#avStatus').textContent = 'Could not load'; });
    },
    publish: function () {
      var btn = $('#avPublish'); btn.disabled = true; say('#avMsg', 'Publishing…');
      put(API.avail, Avail.read())
        .then(function (doc) { Avail.doc = doc; Avail.dirty = false; Avail.status(doc); Avail.preview(); say('#avMsg', 'Published. The badge is live on the site.', 'ok'); })
        .catch(function (e) {
          if (e.status === 401) { expired(); return; }
          say('#avMsg', 'Publish failed: ' + esc(e.message), 'err'); btn.disabled = false;
        });
    },
    init: function () {
      $('#avText').innerHTML = Object.keys(RB.STATUS).map(function (k) { return '<option value="' + k + '">' + esc(RB.STATUS[k].label) + '</option>'; }).join('');
      $$('#m-availability input, #m-availability select').forEach(function (el) {
        el.addEventListener('input', function () { Avail.setDirty(true); });
        el.addEventListener('change', function () { Avail.setDirty(true); });
      });
      $('#avPublish').addEventListener('click', Avail.publish);
      $('#avReload').addEventListener('click', function () {
        if (Avail.dirty && !confirm('Discard unpublished changes and reload?')) return;
        Avail.loaded = false; Avail.dirty = false; Avail.load();
      });
    }
  };

  /* ======================================================================
     Module: career (Home page timeline, LinkedIn-style experiences)
     ====================================================================== */
  var Career = {
    items: [], sel: -1, dirty: false, source: '', loaded: false,
    reset: function () { Career.items = []; Career.sel = -1; Career.dirty = false; Career.loaded = false; },
    enter: function () { if (!Career.loaded) Career.load(); },
    setDirty: function (d) { Career.dirty = d; $('#crPublish').disabled = !d; $('#crPublish').textContent = d ? 'Publish changes' : 'Publish'; },
    status: function (extra) {
      $('#crStatus').textContent = Career.items.length + ' role' + (Career.items.length === 1 ? '' : 's') + ' · ' +
        (Career.source === 'db' ? 'database' : Career.source === 'file' ? 'local file (dev)' : 'built-in copy (never published)') + (extra ? ' · ' + extra : '');
    },
    apply: function (doc, source) { Career.items = RB.sortJobs((doc.items || []).map(RB.normJob)); Career.source = source; },
    load: function () {
      say('#crMsg', 'Loading…');
      return getJson(API.career + '?fresh=1', { credentials: 'same-origin', cache: 'no-store' })
        .catch(function (e) {
          if (e.status !== 404) throw e;
          return getJson('career.json?v=' + Date.now(), { cache: 'no-store' }).then(function (d) { d.source = ''; return d; });
        })
        .then(function (doc) {
          Career.apply(doc, doc.source || 'db'); Career.loaded = true;
          Career.setDirty(false); Career.status(); Career.close();
          say('#crMsg', 'Loaded ' + Career.items.length + ' roles.', 'ok');
        })
        .catch(function (e) { say('#crMsg', 'Load failed: ' + esc(e.message), 'err'); });
    },
    publish: function () {
      if (!Career.dirty) return;
      $('#crPublish').disabled = true; say('#crMsg', 'Publishing…');
      put(API.career, { items: Career.items })
        .then(function (doc) {
          Career.apply(doc, doc.source || 'db'); Career.setDirty(false); Career.status('saved ' + new Date().toLocaleTimeString()); Career.renderList();
          say('#crMsg', 'Published. The Home page timeline is showing the new roles now.', 'ok');
        })
        .catch(function (e) {
          $('#crPublish').disabled = false;
          if (e.status === 401) { expired(); return; }
          say('#crMsg', 'Publish failed: ' + esc(e.message), 'err');
        });
    },
    download: function () {
      var a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob([JSON.stringify({ updated: new Date().toISOString().slice(0, 10), items: Career.items }, null, 2) + '\n'], { type: 'application/json' }));
      a.download = 'career.json'; document.body.appendChild(a); a.click(); a.remove();
    },
    renderList: function () {
      $('#crList').innerHTML = Career.items.map(function (j, i) {
        return '<li data-i="' + i + '" class="' + (i === Career.sel ? 'sel' : '') + '">' +
          '<span class="n">' + (i + 1) + '</span>' +
          '<span class="nm">' + esc(j.title) + ' - ' + esc(j.company) + '<small>' + esc(RB.jobWhen(j)) + '</small></span>' +
          (j.current ? '<span class="tag">current</span>' : '') +
          '</li>';
      }).join('') || '<li style="cursor:default;color:var(--dim)">No roles yet. Click "+ Add experience".</li>';
    },
    /* LinkedIn behaviour: ticking "currently working" hides the end date and shows "Present" */
    toggleEnd: function () {
      var cur = $('#cCurrent').checked;
      $('#cEndWrap').hidden = cur; $('#cEndPresent').hidden = !cur;
    },
    fill: function (j) {
      $('#cTitle').value = j.title; $('#cCompany').value = j.company; $('#cLocation').value = j.location; $('#cTeam').value = j.team;
      $('#cCurrent').checked = j.current;
      $('#cSm').value = j.sm; $('#cSy').value = j.sy;
      $('#cEm').value = j.em || new Date().getMonth() + 1; $('#cEy').value = j.ey || new Date().getFullYear();
      $('#cBullets').value = j.bullets.join('\n'); $('#cSummary').value = j.summary;
      Career.toggleEnd();
    },
    read: function () {
      var base = Career.sel >= 0 ? Career.items[Career.sel] : {};
      return RB.normJob({
        id: base.id, title: $('#cTitle').value.trim(), company: $('#cCompany').value.trim(), location: $('#cLocation').value.trim(), team: $('#cTeam').value.trim(),
        current: $('#cCurrent').checked, sm: $('#cSm').value, sy: $('#cSy').value, em: $('#cEm').value, ey: $('#cEy').value,
        bullets: $('#cBullets').value, summary: $('#cSummary').value.trim()
      });
    },
    problems: function (j) {
      var p = [];
      if (!j.title) p.push('Title is required.');
      if (!j.company) p.push('Company is required.');
      if (!(j.sy >= 1970 && j.sy <= 2100)) p.push('Start year must be between 1970 and 2100.');
      if (!j.current) {
        if (!(j.ey >= 1970 && j.ey <= 2100)) p.push('End year must be between 1970 and 2100, or tick "currently working".');
        else if (j.ey * 12 + j.em < j.sy * 12 + j.sm) p.push('The end date is before the start date.');
      }
      return p;
    },
    preview: function () {
      var j = Career.read();
      $('#crPreview').innerHTML = RB.jobItem(j).replace(/^<li( class="d")?/, function (m, d) { return '<li class="on' + (d ? ' d' : '') + '"'; });
    },
    edit: function (i) {
      Career.sel = i;
      var j = i >= 0 ? Career.items[i] : RB.normJob({ current: true, sm: new Date().getMonth() + 1, sy: new Date().getFullYear() });
      $('#crFormTitle').textContent = i >= 0 ? 'Edit experience' : 'Add experience';
      $('#crFormId').textContent = i >= 0 ? j.id : '';
      $('#crDelete').hidden = i < 0;
      Career.fill(j); Career.preview();
      $('#crForm').hidden = false; $('#crEmpty').hidden = true;
      Career.renderList();
      if (window.innerWidth <= 1000) $('#crForm').scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
    },
    close: function () { Career.sel = -1; $('#crForm').hidden = true; $('#crEmpty').hidden = false; Career.renderList(); },
    save: function () {
      var j = Career.read(), p = Career.problems(j);
      if (p.length) { say('#crMsg', esc(p[0]), 'err'); return; }
      if (Career.sel >= 0) Career.items[Career.sel] = j; else Career.items.push(j);
      Career.items = RB.sortJobs(Career.items);          // re-sort so a new or re-dated role lands in the right place
      Career.sel = Career.items.indexOf(j);
      Career.setDirty(true); Career.renderList(); Career.status();
      $('#crFormId').textContent = j.id; $('#crFormTitle').textContent = 'Edit experience'; $('#crDelete').hidden = false;
      say('#crMsg', 'Saved "' + esc(j.title) + '" in the editor. Click Publish to make it live.', 'ok');
    },
    remove: function () {
      if (Career.sel < 0 || !confirm('Delete this role? It is removed from the site when you publish.')) return;
      Career.items.splice(Career.sel, 1); Career.setDirty(true); Career.close(); Career.status();
    },
    init: function () {
      $('#crReload').addEventListener('click', function () {
        if (Career.dirty && !confirm('Discard unpublished changes and reload?')) return;
        Career.load();
      });
      $('#crDownload').addEventListener('click', Career.download);
      $('#crPublish').addEventListener('click', Career.publish);
      $('#crNew').addEventListener('click', function () { Career.edit(-1); });
      $('#crList').addEventListener('click', function (e) {
        var li = e.target.closest('li[data-i]'); if (li) Career.edit(parseInt(li.dataset.i, 10));
      });
      $$('#crForm input, #crForm select, #crForm textarea').forEach(function (el) {
        el.addEventListener('input', Career.preview); el.addEventListener('change', Career.preview);
      });
      $('#cCurrent').addEventListener('change', Career.toggleEnd);
      $('#crSave').addEventListener('click', Career.save);
      $('#crCancel').addEventListener('click', Career.close);
      $('#crDelete').addEventListener('click', Career.remove);
    }
  };

  /* ======================================================================
     Boot
     ====================================================================== */
  $('#admLogin').addEventListener('submit', signIn);
  $('#admSignOut').addEventListener('click', signOut);
  window.addEventListener('beforeunload', function (e) { if (Recs.dirty || Avail.dirty || Career.dirty) { e.preventDefault(); e.returnValue = ''; } });
  Recs.init();
  Resume.init();
  Avail.init();
  Career.init();
  checkSession();
})();
