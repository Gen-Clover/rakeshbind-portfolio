/*
 * Public site behaviour: hash routing between views, reveal/scroll animations, counters,
 * case-study diagram loops, and loading the What People Say cards from the API.
 * Depends on assets/js/recs.js (window.RB).
 */
(function () {
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var RB = window.RB, API = RB.API, LI_RECS = RB.LI_RECS, EXT = RB.EXT, esc = RB.esc, initialsOf = RB.initialsOf, listNames = RB.listNames, normDoc = RB.normDoc, recCard = RB.recCard, getJson = RB.getJson;

  /* ---------- One-time text preparation ---------- */
  function splitWords(el) {
    var words = el.textContent.trim().split(/\s+/);
    el.textContent = '';
    words.forEach(function (w, i) {
      var s = document.createElement('span');
      s.className = 'sw'; s.style.setProperty('--i', i); s.textContent = w;
      el.appendChild(s); el.appendChild(document.createTextNode(' '));
    });
  }
  $$('[data-split], [data-scrub]').forEach(splitWords);

  $$('[data-stagger]').forEach(function (p) {
    Array.prototype.forEach.call(p.children, function (c, i) {
      c.classList.add('reveal'); c.style.setProperty('--d', (i * 90) + 'ms');
    });
  });

  /* ---------- Card spotlight ---------- */
  if (window.matchMedia('(pointer: fine)').matches) {
    document.addEventListener('pointermove', function (e) {
      var c = e.target.closest ? e.target.closest('.card') : null;
      if (!c) return;
      var r = c.getBoundingClientRect();
      c.style.setProperty('--mx', (e.clientX - r.left) + 'px');
      c.style.setProperty('--my', (e.clientY - r.top) + 'px');
    }, { passive: true });
  }

  /* ---------- Routing ---------- */
  var ROUTES = {
    '#/': 'home',
    '#/work': 'work',
    '#/about': 'about',
    '#/contact': 'contact',
    '#/what-people-say': 'say',
    '#/work/observability': 'cs-obs',
    '#/work/data-bi': 'cs-bi',
    '#/work/drug-competitors': 'cs-dci',
    '#/work/ai-agents': 'cs-agents',
    '#/work/ats-analytics': 'cs-ats'
  };
  var NAVKEY = { 'home': 'home', 'work': 'work', 'about': 'about', 'say': 'say', 'contact': 'contact', 'cs-obs': 'work', 'cs-bi': 'work', 'cs-dci': 'work', 'cs-agents': 'work', 'cs-ats': 'work' };
  var current = null, activeView = null;

  var io = null;
  function initReveals(view) {
    if (io) { io.disconnect(); io = null; }
    var els = $$('.reveal, .split, .win', view);
    els.forEach(function (el) { el.classList.remove('in'); });
    if (reduce) { els.forEach(function (el) { el.classList.add('in'); }); return; }
    io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        e.target.classList.add('in');
        io.unobserve(e.target);
        if (e.target.closest('.stats')) runCounters(e.target.closest('.stats'));
      });
    }, { threshold: 0.15, rootMargin: '0px 0px -6% 0px' });
    els.forEach(function (el) { io.observe(el); });
  }

  function runCounters(scope) {
    $$('[data-count]', scope).forEach(function (el) {
      if (el.dataset.done === '1') return;
      el.dataset.done = '1';
      var end = parseInt(el.getAttribute('data-count'), 10);
      if (reduce) { el.textContent = end.toLocaleString(); return; }
      var t0 = null, dur = 1500;
      function step(t) {
        if (!t0) t0 = t;
        var p = Math.min((t - t0) / dur, 1), eased = 1 - Math.pow(1 - p, 3);
        el.textContent = Math.round(end * eased).toLocaleString();
        if (p < 1) requestAnimationFrame(step);
      }
      el.textContent = '0';
      requestAnimationFrame(step);
    });
  }

  var loopTimers = [];
  function initLoops(view) {
    loopTimers.forEach(clearInterval); loopTimers = [];
    if (reduce) return;
    $$('.loop ol', view).forEach(function (ol) {
      var items = $$('li', ol), i = 0;
      items.forEach(function (li, k) { li.classList.toggle('on', k === 0); });
      loopTimers.push(setInterval(function () {
        items[i].classList.remove('on');
        i = (i + 1) % items.length;
        items[i].classList.add('on');
      }, 2200));
    });
  }

  function restartCss(view) {
    $$('.ecg .trace, .ecg .scan, .ecg .flag', view).forEach(function (el) {
      el.style.animation = 'none';
      void el.getBoundingClientRect();
      el.style.animation = '';
    });
  }

  var scrubs = [], tl = null, tlItems = [];
  function initScroll(view) {
    scrubs = $$('[data-scrub]', view);
    tl = $('.tl', view);
    tlItems = tl ? $$(':scope > li', tl) : [];
    if (reduce && tl) {
      tlItems.forEach(function (i) { i.classList.add('on'); });
      tl.style.setProperty('--fill', '100%');
    }
    onScroll();
  }

  var bar = $('#progress'), ticking = false;
  function onScroll() {
    if (ticking) return; ticking = true;
    requestAnimationFrame(function () {
      ticking = false;
      var vh = window.innerHeight;
      var doc = document.documentElement;
      bar.style.transform = 'scaleX(' + Math.min(1, window.scrollY / Math.max(1, doc.scrollHeight - vh)) + ')';
      if (reduce) return;

      scrubs.forEach(function (el) {
        var words = el.querySelectorAll('.sw');
        var r = el.getBoundingClientRect();
        var p = (vh * 0.85 - r.top) / (vh * 0.55 + r.height * 0.4);
        p = Math.max(0, Math.min(1, p));
        Array.prototype.forEach.call(words, function (w, i) {
          var v = Math.max(0, Math.min(1, p * words.length * 1.1 - i));
          w.style.opacity = (0.16 + 0.84 * v).toFixed(3);
        });
      });

      if (tl) {
        var tr = tl.getBoundingClientRect();
        var fill = Math.max(0, Math.min(tr.height, vh * 0.62 - tr.top));
        tl.style.setProperty('--fill', fill + 'px');
        tlItems.forEach(function (item) { item.classList.toggle('on', item.offsetTop + 14 <= fill); });
      }
    });
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onScroll);

  function go(hash) {
    if (/^#\/admin(\/|$)/.test(hash)) { location.replace('admin.html'); return; }   // admin moved to its own page
    var deep = /^#\/what-people-say\/([a-z0-9-]+)$/i.exec(hash);   // #/what-people-say/<rec id> opens one card
    pendingRec = deep ? deep[1].toLowerCase() : null;
    if (deep) hash = '#/what-people-say';
    var key = ROUTES[hash];
    if (!key) key = 'home';
    if (key !== 'say') focusedRec = null;
    if (key === current) { if (key === 'say') focusRec(); return; }
    current = key;

    $$('.view').forEach(function (v) { v.classList.toggle('on', v.id === 'v-' + key); });
    activeView = $('#v-' + key);
    document.title = ({
      home: 'Rakesh Bind - AI Product Manager & Solution Architect',
      work: 'Work - Rakesh Bind',
      about: 'About - Rakesh Bind',
      contact: 'Contact - Rakesh Bind',
      say: 'What People Say - Rakesh Bind',
      'cs-obs': 'Autonomous AI Log Monitoring & Observability Platform - Rakesh Bind',
      'cs-bi': 'Data & BI Modernization - Rakesh Bind',
      'cs-dci': 'Drug Competitor Identification - Rakesh Bind',
      'cs-agents': 'AI Agents Platform - Rakesh Bind',
      'cs-ats': 'SourcePros ATS Product Analytics - Rakesh Bind'
    })[key];

    var nk = NAVKEY[key];
    $$('.links a, .drawer a').forEach(function (a) { a.classList.toggle('act', a.dataset.r === nk); });
    $('#drawer').classList.remove('open');
    $('#menuBtn').setAttribute('aria-expanded', 'false');

    window.scrollTo(0, 0);
    $$('[data-count]', activeView).forEach(function (el) { el.dataset.done = ''; });
    restartCss(activeView);
    initReveals(activeView);
    initLoops(activeView);
    initScroll(activeView);
    if (key === 'say') { fitRecs(); focusRec(); }

    var hero = $('.hero', activeView);
    if (hero) {
      hero.classList.remove('go');
      requestAnimationFrame(function () { setTimeout(function () { hero.classList.add('go'); }, 60); });
    }
  }

  window.addEventListener('hashchange', function () { go(location.hash); });

  /* In-page jump links inside case studies must not change the route */
  document.addEventListener('click', function (e) {
    var a = e.target.closest ? e.target.closest('.jump a') : null;
    if (!a) return;
    var t = $(a.getAttribute('href'));
    if (!t) return;
    e.preventDefault();
    t.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
  });

  /* Mobile drawer */
  $('#menuBtn').addEventListener('click', function () {
    var d = $('#drawer'), open = d.classList.toggle('open');
    this.setAttribute('aria-expanded', open ? 'true' : 'false');
  });

  /* ---------- What People Say: data-driven cards ---------- */
  /* Cards come from the API (database). If the API is unavailable (static preview, opened from
     disk) the page falls back to recommendations.json, then to the inline #recFallback copy.
     Card markup and helpers live in assets/js/recs.js (shared with the admin). */
  var recData = null;

  function renderRecs() {
    var grid = $('#recGrid'), bar = $('#recBar');
    if (!grid || !recData) return;
    var items = recData.items.filter(function (r) { return !r.hidden; });
    var show = Math.max(1, recData.featured || 6);
    var rest = items.slice(show);
    grid.classList.remove('all');
    grid.innerHTML = items.map(function (r, i) { return recCard(r, i, i >= show); }).join('');
    bar.hidden = items.length === 0;
    bar.classList.toggle('done', rest.length === 0);
    bar.innerHTML =
      '<div class="l">' +
        (rest.length ? '<div class="avs" aria-hidden="true">' + rest.slice(0, 3).map(function (r) { return '<span style="--av:' + esc(r.color) + '">' + esc(r.initials || initialsOf(r.name)) + '</span>'; }).join('') + (rest.length > 3 ? '<span class="n">+' + (rest.length - 3) + '</span>' : '') + '</div>' : '') +
        '<div>' +
          '<div class="hide"><b>' + rest.length + ' more recommendation' + (rest.length === 1 ? '' : 's') + '</b><small>From ' + esc(listNames(rest.map(function (r) { return r.name; }))) + '</small></div>' +
          '<div class="shown"><b>Showing all ' + items.length + ' recommendation' + (items.length === 1 ? '' : 's') + '</b><small>Exactly as written on LinkedIn, in the recommenders\' own words</small></div>' +
        '</div>' +
      '</div>' +
      '<div class="r">' +
        '<button class="btn-a" type="button" id="recAll">Read all ' + items.length + '</button>' +
        '<a class="btn-b" href="' + LI_RECS + '" target="_blank" rel="noopener">View on LinkedIn ' + EXT + '</a>' +
      '</div>';
    if (activeView && activeView.id === 'v-say') { revealNew(grid); revealNew(bar.parentNode); fitRecs(); focusRec(); }
    renderTicker(items);
  }

  /* Home page strip: one pull-quote per recommendation, scrolling continuously. The set is
     rendered twice so the loop is seamless; the copy is inert so it is not read or tabbed twice. */
  function renderTicker(items) {
    var rail = $('#tickerRail'), sec = $('#homeSay');
    if (!rail) return;
    sec.hidden = items.length === 0;
    if (!items.length) return;
    var set = items.map(function (r) {
      return '<a class="card tq" href="#/what-people-say/' + esc(r.id) + '" draggable="false" style="--av:' + esc(r.color) + '" aria-label="Read the full recommendation from ' + esc(r.name) + '">' +
        '<p class="q">“' + esc(RB.pullQuote(r.text)) + '”</p>' +
        '<div class="who"><span class="av">' + esc(r.initials || initialsOf(r.name)) + '</span><div><span class="nm">' + esc(r.name) + '</span><span class="ttl">' + esc(r.title) + '</span></div></div>' +
        '</a>';
    }).join('');
    rail.innerHTML = '<div class="set">' + set + '</div><div class="set" aria-hidden="true" inert>' + set + '</div>';
    strip.refresh();
  }

  /* Strip motion. One offset drives everything: it creeps forward on its own, follows the pointer
     while pressed, keeps a little momentum after a fling, and resumes creeping a moment later.
     A press that travels more than a few pixels is a drag, so the card underneath does not open.
     Under reduced motion the strip is a plain horizontal scroller (CSS) and none of this runs. */
  var strip = (function () {
    var el = $('#ticker'), rail = $('#tickerRail');
    if (!el || !rail || reduce) return { refresh: function () {} };
    var SPEED = 44, GAP = 18, SLOP = 6, REST = 2000;
    var x = 0, loop = 0, last = 0, raf = null, visible = false, hover = false, focus = false;
    var drag = null, vel = 0, idleUntil = 0, suppress = false;

    function measure() { var s = $('.set', rail); loop = s ? s.getBoundingClientRect().width + GAP : 0; }
    function paint() { rail.style.transform = 'translate3d(' + (-x).toFixed(2) + 'px,0,0)'; }
    function tick(t) {
      raf = null;
      var dt = Math.min(0.05, (t - last) / 1000 || 0); last = t;
      if (!drag) {
        if (Math.abs(vel) > 4) { x += vel * dt; vel *= Math.pow(0.03, dt); }      // fling decays to ~3% per second
        else if (!hover && !focus && t > idleUntil) x += SPEED * dt;
      }
      if (loop) x = ((x % loop) + loop) % loop;
      paint();
      if (visible) raf = requestAnimationFrame(tick);
    }
    function run() { if (!raf && visible) { last = performance.now(); raf = requestAnimationFrame(tick); } }

    el.addEventListener('pointerdown', function (e) {
      if (e.button !== 0) return;
      drag = { x0: e.clientX, x: e.clientX, t: performance.now(), pos: x, moved: false };
      vel = 0;
    });
    el.addEventListener('pointermove', function (e) {
      if (!drag) return;
      var now = performance.now(), dt = (now - drag.t) / 1000 || 0.016;
      if (!drag.moved && Math.abs(e.clientX - drag.x0) > SLOP) {
        drag.moved = true;
        el.setPointerCapture(e.pointerId);   // capture only once it is a drag: capturing on press would steal the click from the link
        el.classList.add('dragging');
      }
      if (drag.moved) x = drag.pos - (e.clientX - drag.x0);
      vel = 0.75 * (-(e.clientX - drag.x) / dt) + 0.25 * vel;
      drag.x = e.clientX; drag.t = now;
      paint();
    });
    function release(e) {
      if (!drag) return;
      var moved = drag.moved, still = performance.now() - drag.t > 80;
      drag = null;
      el.classList.remove('dragging');
      try { el.releasePointerCapture(e.pointerId); } catch (err) {}
      if (!moved || still) vel = 0;   // a plain click, or a release after holding still, has no fling
      idleUntil = performance.now() + REST;
      if (moved) { suppress = true; setTimeout(function () { suppress = false; }, 60); }
      run();
    }
    el.addEventListener('pointerup', release);
    el.addEventListener('pointercancel', release);
    el.addEventListener('click', function (e) { if (suppress) { e.preventDefault(); e.stopPropagation(); } }, true);
    el.addEventListener('dragstart', function (e) { e.preventDefault(); });

    el.addEventListener('pointerenter', function (e) { if (e.pointerType === 'mouse') hover = true; });
    el.addEventListener('pointerleave', function (e) { if (e.pointerType === 'mouse') hover = false; });
    el.addEventListener('focusin', function (e) {   // keyboard focus pauses the strip; a mouse press also focuses the link, and must not
      try { focus = e.target.matches(':focus-visible'); } catch (err) { focus = false; }
    });
    el.addEventListener('focusout', function () { focus = false; });
    window.addEventListener('resize', measure);
    new IntersectionObserver(function (entries) {
      visible = entries[0].isIntersecting;
      if (visible) { measure(); run(); }
    }, { threshold: 0 }).observe(el);

    return { refresh: function () { measure(); paint(); run(); } };
  })();

  /* Deep link (#/what-people-say/<id>, e.g. from the home strip): show the card even if it is behind
     "Read all", expand the full text, scroll to it and pulse a highlight. Runs once the cards exist. */
  var pendingRec = null, focusedRec = null;
  function focusRec() {
    if (!pendingRec || !activeView || activeView.id !== 'v-say') return;
    var grid = $('#recGrid'), card = $('.rec[data-id="' + pendingRec + '"]', grid);
    if (!card) return;
    focusedRec = pendingRec; pendingRec = null;
    if (card.classList.contains('more') && !grid.classList.contains('all')) { grid.classList.add('all'); $('#recBar').classList.add('done'); fitRecs(); }
    var q = $('.q', card), btn = $('.more-btn', card);
    q.classList.remove('clamp');
    btn.setAttribute('aria-expanded', 'true'); btn.textContent = 'Show less';
    card.classList.add('in');
    setTimeout(function () {
      card.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
      card.classList.add('hl');
      setTimeout(function () { card.classList.remove('hl'); }, 2600);
    }, 120);
  }

  /* Observe cards that were added after the view's reveal observer was set up */
  function revealNew(container) {
    var els = $$('.reveal:not(.in)', container);
    if (reduce || !io) { els.forEach(function (el) { el.classList.add('in'); }); return; }
    els.forEach(function (el) { io.observe(el); });
  }

  function loadRecs() {
    var inline = function () {
      var doc = { items: [] };
      try { doc = JSON.parse($('#recFallback').textContent); } catch (e) {}
      recData = normDoc(doc); renderRecs();
    };
    inline();   // paint the committed copy at once (no empty strip on the home page), then refresh from the API
    if (location.protocol === 'file:' || !window.fetch) return;
    var fromFile = function () { return getJson('recommendations.json?v=' + Date.now(), { cache: 'no-store' }); };
    getJson(API.recs, { credentials: 'same-origin' })
      .then(function (doc) { return (doc.items && doc.items.length) ? doc : fromFile(); }, fromFile)
      .then(function (doc) {
        doc = normDoc(doc);
        if (JSON.stringify(doc) === JSON.stringify(recData)) return;   // same as the inline copy: leave the DOM alone
        recData = doc; pendingRec = pendingRec || focusedRec; renderRecs();
      })
      .catch(function () {});   // the inline copy is already on screen
  }

  /* Clamp long quotes so the grid stays even; the full text is always in the DOM */
  function fitRecs() {
    $$('#v-say .rec').forEach(function (card) {
      if (!card.offsetParent) return;
      var q = $('.q', card), btn = $('.more-btn', card);
      if (card.dataset.fit === '1' || btn.getAttribute('aria-expanded') === 'true') return;
      q.classList.remove('clamp'); card.classList.remove('can');
      var limit = parseFloat(getComputedStyle(q).fontSize) * 17.6;
      if (q.scrollHeight > limit + 8) { q.classList.add('clamp'); card.classList.add('can'); }
      card.dataset.fit = '1';
    });
  }
  document.addEventListener('click', function (e) {
    var t = e.target.closest ? e.target : null;
    if (!t) return;
    var btn = t.closest('#v-say .more-btn');
    if (btn) {
      var q = $('.q', btn.parentNode), open = !q.classList.toggle('clamp');
      btn.setAttribute('aria-expanded', open ? 'true' : 'false');
      btn.textContent = open ? 'Show less' : 'Read full recommendation';
      return;
    }
    if (t.closest('#recAll')) {
      $('#recGrid').classList.add('all');
      $('#recBar').classList.add('done');
      fitRecs();
      var first = $('#recGrid .more');
      if (first) first.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
    }
  });
  window.addEventListener('resize', function () {
    $$('#v-say .rec').forEach(function (c) { if ($('.more-btn', c).getAttribute('aria-expanded') !== 'true') c.dataset.fit = ''; });
    fitRecs();
  });

  /* "Get my resume": the API streams the current PDF; when opened from disk link the committed copy */
  if (location.protocol === 'file:') $$('[data-resume]').forEach(function (a) { a.href = 'resume/Rakesh-Bind-Resume.pdf'; });
  loadRecs();

  /* Copy buttons */
  document.addEventListener('click', function (e) {
    var b = e.target.closest ? e.target.closest('.copy[data-copy]') : null;
    if (!b) return;
    var text = b.getAttribute('data-copy'), label = b.textContent;
    function done() { b.textContent = 'Copied'; b.classList.add('done'); setTimeout(function () { b.textContent = label; b.classList.remove('done'); }, 1800); }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(done, function () { b.textContent = text; });
    } else {
      var ta = document.createElement('textarea');
      ta.value = text; document.body.appendChild(ta); ta.select();
      try { document.execCommand('copy'); done(); } catch (err) { b.textContent = text; }
      document.body.removeChild(ta);
    }
  });

  /* ---------- Diagram players ---------- */
  var CAPTIONS = {
    dgObs: [
      '<b>1. A service throws an error.</b> A payments-related service logs a failure.',
      '<b>2. It is logged with a trace ID.</b> The shared library stamps the line and Cloud Logging stores it.',
      '<b>3. An alert fires.</b> A log-based alert on ERROR severity publishes to Pub/Sub.',
      '<b>4. The webhook accepts it.</b> It replies instantly and starts the swarm in the background.',
      '<b>5. Log Analyst triages.</b> It reads the surrounding logs and rates criticality.',
      '<b>6. Environment agent fetches code.</b> It pulls the exact file from Bitbucket at the running commit.',
      '<b>7. Coder writes the fix.</b> A corrected file, with a comment explaining the change.',
      '<b>8. Reviewer checks it.</b> An independent pass for security, syntax and correctness.',
      '<b>9. GitOps opens a pull request.</b> Branch, commit and PR, all logged back to Cloud Logging.',
      '<b>10. People take over.</b> An engineer reviews and merges, and the dashboard shows the whole trail.'
    ],
    dgObsEnd: '<b>Resolved.</b> The full path from error to reviewed pull request, with a person in control of what ships.',
    dgBi: [
      '<b>1. Ingestion.</b> NetSuite, publisher and vendor files and APIs land in Cloud Storage through one standard framework.',
      '<b>2. Data engineering.</b> Cloud Composer DAGs validate, log and retry, replacing 200+ undocumented Talend jobs.',
      '<b>3. Warehouse.</b> BigQuery holds one set of business rules, and becomes the single source of truth.',
      '<b>4. Analytics and apps.</b> Power BI semantic models and Node/Python APIs read from the same warehouse.',
      '<b>5. The portal.</b> Embedded reports, operational apps, user administration, role-based access and Row-Level Security in one place.',
      '<b>6. End users.</b> Business users access, analyze, operate and collaborate without leaving the portal.'
    ],
    dgBiEnd: '<b>One governed pipeline.</b> Source to end user, with the business rules living in exactly one place.',
    dgDci: [
      '<b>1. The analyst types a drug name.</b> One search screen, no configuration.',
      '<b>2. The proxy authenticates.</b> Node mints a fresh Google identity token and forwards the call.',
      '<b>3. FastAPI receives it.</b> Behind Identity-Aware Proxy, it starts the LangGraph workflow.',
      '<b>4. Seed lookup.</b> The drug is found in the OpenFDA table, or the workflow stops right there.',
      '<b>5. Web search.</b> Gemini with Google Search grounding proposes candidate competitor names.',
      '<b>6. Verify and score.</b> Each candidate is scored against the seed drug on UNII, RxCUI, class, category, route and form.',
      '<b>7. Reconcile.</b> Results are cross-checked against the company\u2019s own curated list of 912 relationships.',
      '<b>8. The analyst decides.</b> Verified and unverified candidates both appear, and one click updates the ground-truth list.'
    ],
    dgDciEnd: '<b>Done.</b> A competitor list with evidence behind every row, and a person still holding the pen.',
    dgAgt: [
      '<b>1. A creator opens the dashboard.</b> Every agent is a tile, one click away.',
      '<b>2. The ingredients go up.</b> A physician list and the poster\u2019s content sections land in Cloud Storage.',
      '<b>3. Validation checks the input.</b> Rules the business owns catch wrong columns or badly sized assets up front.',
      '<b>4. A job number comes back.</b> The screen answers instantly and the run continues in the background.',
      '<b>5. QR Generator does its job.</b> A tracked code is found or created for every physician and location.',
      '<b>6. The Assembler builds posters.</b> Print-sharp PDFs, in small batches, with placeholders for missing sections.',
      '<b>7. Metadata Collector records it.</b> What was made, when, and how to retrieve it again.',
      '<b>8. A person approves the perks.</b> Codes are validated automatically, then held until a reviewer signs off.',
      '<b>9. The batch goes out.</b> Approved codes reach the partner, and one ZIP is ready for print.'
    ],
    dgAgtEnd: '<b>Done.</b> One upload in, a recorded and trackable box of posters out, with people in control of what ships.',
    dgAts: [
      '<b>1. A recruiter works the requirement.</b> Sourcing, submissions and interviews are logged inside the ATS.',
      '<b>2. SQL extracts and transforms.</b> Operational records are loaded into the analytical layer on a schedule.',
      '<b>3. The warehouse models it.</b> Five fact tables and seven conformed dimensions, one grain, one set of joins.',
      '<b>4. Data quality runs first.</b> Duplicates, missing fields, orphans and invalid dates are caught before publishing.',
      '<b>5. The DAX layer measures it.</b> Time-to-Fill, fill rate and every conversion ratio, defined once and reused.',
      '<b>6. Models score the risk.</b> Fill probability, candidate success and at-risk flags, refreshed nightly.',
      '<b>7. Dashboards deliver it.</b> Six Power BI dashboards on one model, scoped by role.',
      '<b>8. A manager decides.</b> Escalate, reassign, or let it run. The score recommends; the person calls it.'
    ],
    dgAtsEnd: '<b>Done.</b> A scattered ATS record in, a trusted number on a dashboard out, with people owning every call.'
  };

  var NS = 'http://www.w3.org/2000/svg', XL = 'http://www.w3.org/1999/xlink';

  $$('svg.dg').forEach(function (svg) {
    var texts = CAPTIONS[svg.id];
    if (!texts) return;
    var endText = CAPTIONS[svg.id + 'End'];
    var stage = svg.closest('.stage');
    var cap = $('.cap', stage), playBtn = $('[data-play]', stage), restartBtn = $('[data-restart]', stage);

    var items = $$('[data-step]', svg).map(function (el) {
      return { el: el, steps: el.getAttribute('data-step').split(',').map(Number) };
    });
    var N = texts.length;

    var packets = {};
    $$('path.arrow', svg).forEach(function (p) {
      if (!p.id) return;
      var c = document.createElementNS(NS, 'circle'); c.setAttribute('r', '4.5'); c.setAttribute('class', 'pk');
      var am = document.createElementNS(NS, 'animateMotion');
      am.setAttribute('dur', '0.9s'); am.setAttribute('begin', 'indefinite'); am.setAttribute('fill', 'freeze');
      var mp = document.createElementNS(NS, 'mpath');
      mp.setAttribute('href', '#' + p.id); mp.setAttributeNS(XL, 'xlink:href', '#' + p.id);
      am.appendChild(mp); c.appendChild(am); svg.appendChild(c);
      packets[p.id] = { c: c, am: am };
    });
    function fire(id) {
      var pk = packets[id]; if (!pk || reduce) return;
      pk.c.style.opacity = 1;
      try { pk.am.beginElement(); } catch (e) {}
      setTimeout(function () { pk.c.style.opacity = 0; }, 900);
    }

    function apply(k) {
      items.forEach(function (it) {
        var hot = it.steps.indexOf(k) > -1;
        var done = !hot && it.steps.some(function (s) { return s < k; });
        it.el.classList.toggle('hot', hot);
        it.el.classList.toggle('done', done);
        if (hot && it.el.tagName === 'path') fire(it.el.id);
      });
    }

    var k = -1, playing = !reduce, visible = false, timer = null;
    function show(step) {
      k = step; apply(k);
      cap.innerHTML = (k >= 0 && k < N) ? texts[k] : endText;
    }
    function schedule() {
      clearTimeout(timer);
      if (!playing || !visible) return;
      timer = setTimeout(function () {
        var next = k + 1;
        if (next > N) { show(-1); timer = setTimeout(function () { show(0); schedule(); }, 700); return; }
        show(next); schedule();
      }, k === N ? 3200 : 1900);
    }
    function setPlaying(v) { playing = v; playBtn.textContent = v ? 'Pause' : 'Play'; schedule(); }
    playBtn.addEventListener('click', function () {
      if (!playing && k >= N) show(-1);
      setPlaying(!playing);
      if (playing && k === -1) { show(0); schedule(); }
    });
    restartBtn.addEventListener('click', function () { show(0); setPlaying(true); });

    if (reduce) { show(N); playBtn.textContent = 'Play'; }
    new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        visible = e.isIntersecting;
        if (visible && playing && k === -1) { show(0); }
        schedule();
      });
    }, { threshold: 0.25 }).observe(svg);
  });

  /* ---------- Boot ---------- */
  go(location.hash);
})();
