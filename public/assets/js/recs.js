/*
 * Shared front-end model for recommendations and the API helper.
 * Loaded by both index.html (public rendering) and admin.html (editor preview).
 * Exposes a single global: window.RB
 */
(function () {
  var REL = { d: 'Direct report', p: 'Team peer', x: 'Cross-team', s: 'Senior colleague' };
  var API = { recs: '/api/recommendations', auth: '/api/auth', resume: '/api/resume', avail: '/api/availability' };
  var LI_RECS = 'https://www.linkedin.com/in/rakesh-bind-2a797333b/details/recommendations/?detailScreenTabIndex=0';
  var EXT = '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 12 12 4M6 4h6v6"/></svg>';

  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function initialsOf(name) { return String(name || '').trim().split(/\s+/).filter(Boolean).slice(0, 2).map(function (w) { return w.charAt(0).toUpperCase(); }).join('') || '?'; }
  function paras(text) { return String(text || '').replace(/\r/g, '').split(/\n\s*\n/).map(function (p) { return p.trim(); }).filter(Boolean); }
  function listNames(names) { return names.length < 2 ? names.join('') : names.slice(0, -1).join(', ') + ' and ' + names[names.length - 1]; }
  function fmtBytes(b) { return b >= 1048576 ? (b / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.round(b / 1024)) + ' KB'; }

  /* One sentence to stand in for the whole recommendation (home-page strip). Prefers a mid-length
     sentence that says something specific over the "I had the opportunity to work with..." opener. */
  var HOT = /leader|mentor|technic|architect|ownership|trust|calm|problem|guid|clear|deliver|question|think|growth|expert|\bai\b|data/gi;
  var OPENER = /^(i had|having|working with|it was|i (truly|highly|would))/i;
  function pullQuote(text, max) {
    max = max || 210;
    var sents = String(text || '').replace(/\s+/g, ' ').match(/[^.!?]+[.!?]+["”']?|[^.!?]+$/g) || [];
    var best = null, bestScore = -Infinity;
    sents.forEach(function (s) {
      s = s.trim();
      if (s.length < 50 || s.length > max) return;
      var score = (s.match(HOT) || []).length - (OPENER.test(s) ? 3 : 0);
      if (score > bestScore) { bestScore = score; best = s; }
    });
    if (!best) {
      best = (sents[0] || String(text || '')).trim();
      if (best.length > max) best = best.slice(0, max).replace(/\s+\S*$/, '') + '…';
    }
    return best;
  }

  function normRec(r) {
    return {
      id: r.id || String(r.name || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || ('rec-' + Date.now()),
      name: r.name || '', initials: r.initials || '', color: r.color || '#8FA0FF', title: r.title || '',
      relType: REL[r.relType] ? r.relType : 'd', relationship: r.relationship || '', date: r.date || '',
      profile: r.profile || '', hidden: !!r.hidden, text: r.text || ''
    };
  }
  function normDoc(doc) {
    return { updated: doc.updated || null, featured: parseInt(doc.featured, 10) || 6, items: (doc.items || []).map(normRec) };
  }

  /* One card. `more` marks cards hidden behind "Read all". */
  function recCard(r, i, more) {
    var rel = REL[r.relType] ? r.relType : 'd';
    return '<article class="card rec reveal' + (more ? ' more' : '') + '" data-id="' + esc(r.id) + '" style="--av:' + esc(r.color || '#8FA0FF') + ';--d:' + ((i % 3) * 90) + 'ms">' +
      '<div class="who"><span class="av">' + esc(r.initials || initialsOf(r.name)) + '</span><div><span class="nm">' + esc(r.name) + '</span><span class="ttl" title="' + esc(r.title) + '">' + esc(r.title) + '</span></div></div>' +
      '<div class="rel ' + rel + '">' + esc(r.relationship || REL[rel]) + (r.date ? ' <small>· ' + esc(r.date) + '</small>' : '') + '</div>' +
      '<blockquote><div class="q">' + paras(r.text).map(function (p) { return '<p>' + esc(p) + '</p>'; }).join('') + '</div></blockquote>' +
      '<button class="more-btn" type="button" aria-expanded="false">Read full recommendation</button>' +
      '<a class="src" href="' + esc(r.profile || LI_RECS) + '" target="_blank" rel="noopener">View on LinkedIn ' + EXT + '</a>' +
      '</article>';
  }

  /* Availability badge: the career states the status dropdown offers, each with a colour (tone)
     and whether the dot pulses. Keys are what the API stores; labels are what visitors read. */
  var STATUS = {
    open:      { label: 'Open to work',            tone: 'ok',   live: true },
    notice:    { label: 'Serving notice period',   tone: 'warn', live: true },
    freelance: { label: 'Available for consulting', tone: 'a2',  live: true },
    passive:   { label: 'Open to conversations',   tone: 'a1',   live: false },
    joined:    { label: 'Just joined a new role',  tone: 'rose', live: false },
    busy:      { label: 'Not looking right now',   tone: 'dim',  live: false }
  };
  function statusOf(key) { return STATUS[key] || STATUS.open; }
  function availBadge(doc) {
    var st = statusOf(doc.status);
    return '<span class="st t-' + st.tone + (st.live ? ' live' : '') + '"><i></i>' + esc(st.label) + '</span>' +
      (doc.facts || []).map(function (f) { return '<span class="fact"><small>' + esc(f.label) + '</small>' + esc(f.value) + '</span>'; }).join('');
  }

  /* fetch() that always resolves to parsed JSON and throws Error(message){status} on failure */
  function getJson(url, opt) {
    return fetch(url, opt).then(function (r) {
      return r.text().then(function (t) {
        var j = {}; try { j = t ? JSON.parse(t) : {}; } catch (e) { j = { error: 'Unexpected response (' + r.status + ')' }; }
        if (!r.ok) { var err = new Error(j.error || ('Request failed (' + r.status + ')')); err.status = r.status; throw err; }
        return j;
      });
    });
  }

  window.RB = { REL: REL, API: API, LI_RECS: LI_RECS, EXT: EXT, esc: esc, initialsOf: initialsOf, paras: paras, listNames: listNames, fmtBytes: fmtBytes, pullQuote: pullQuote, normRec: normRec, normDoc: normDoc, recCard: recCard, STATUS: STATUS, statusOf: statusOf, availBadge: availBadge, getJson: getJson };
})();
