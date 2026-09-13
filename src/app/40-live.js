// Live overzicht: leest de OTAP-stand van een openbare GitHub-repo (alleen-lezen, zonder token).
const API = 'https://api.github.com';
const OEFEN = 'oefen';
const BRANCH = { T: 'development', A: 'acceptatie', P: 'main' };
const BRANCH_ENV = { development: 'T', acceptatie: 'A', main: 'P' };
const STANDAARD_APPS = [
  { repo: 'HansdeRooijPrive/Ventus-KM-Declaratie', naam: 'Ventus KM-Declaratie' },
  { repo: 'HansdeRooijPrive/Prive-OTAP-Demo', naam: 'OTAP Platform Monitoring (deze app)' },
  { repo: 'HansdeRooijPrive/Prive-Zeilen-Griekenland', naam: 'Zeilen in Griekenland' },
  { repo: 'HansdeRooijPrive/Prive-Reizen-Schotland', naam: 'Reizen Schotland' }
];
const PLATFORM_REPO = 'HansdeRooijPrive/OTAP-CI';
const PLATFORM_URL = 'https://github.com/' + PLATFORM_REPO;
const REPO_RE = /^[A-Za-z0-9-]+\/[A-Za-z0-9._-]+$/;
const KEUZE_KEY = STORAGE_KEY + '.dashboard';
const CACHE_KEY = STORAGE_KEY + '.github2';          // .github2: runs bevatten nu ook de OTAP-CI-versie
const PLATFORM_KEY = STORAGE_KEY + '.platform';
const CACHE_MS = 5 * 60 * 1000;
const PLATFORM_MS = 30 * 60 * 1000;
const VERSIE_RE = /\bv\d+(?:\.\d+)+\b/g;
const UITKOMST = { success: 'geslaagd', failure: 'mislukt', cancelled: 'geannuleerd', timed_out: 'time-out', skipped: 'overgeslagen',
  action_required: 'actie nodig', startup_failure: 'startfout', neutral: 'neutraal', stale: 'verouderd' };

function leesJson(key, standaard) {
  try { const v = JSON.parse(localStorage.getItem(key)); return v == null ? standaard : v; } catch (e) { return standaard; }
}
function schrijfJson(key, v) {
  try { localStorage.setItem(key, JSON.stringify(v)); } catch (e) { /* geen opslag of vol */ }
}
try { localStorage.removeItem(STORAGE_KEY + '.github'); } catch (e) { /* oude cache opruimen */ }
function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; });
}
function fmt(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.getDate() + ' ' + MONTHS[d.getMonth()] + ' ' + String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
}
function hhmm(ms) { const d = new Date(ms); return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0'); }
function sha7(s) { return String(s || '').slice(0, 7); }
function gelijk(a, b) { return String(a).toLowerCase() === String(b).toLowerCase(); }
// Vergelijkt versies als "v3.21" en "v2": -1, 0 of 1.
function vergelijkVersie(a, b) {
  const x = String(a).replace(/^v/, '').split('.').map(Number), y = String(b).replace(/^v/, '').split('.').map(Number);
  for (let i = 0; i < Math.max(x.length, y.length); i++) {
    if ((x[i] || 0) !== (y[i] || 0)) return (x[i] || 0) > (y[i] || 0) ? 1 : -1;
  }
  return 0;
}

/* ---------- keuze van de app ---------- */
let KEUZE = leesJson(KEUZE_KEY, null);
if (!KEUZE || typeof KEUZE !== 'object') KEUZE = {};
if (!Array.isArray(KEUZE.extra)) KEUZE.extra = [];
KEUZE.extra = KEUZE.extra.filter(function (a) { return a && REPO_RE.test(a.repo); });

function alleApps() { return STANDAARD_APPS.concat(KEUZE.extra); }
function appInfo(repo) {
  const a = alleApps().find(function (x) { return gelijk(x.repo, repo); });
  return a || { repo: repo, naam: repo.split('/')[1].replace(/[-_]+/g, ' ') };
}
function pagesUrl(repo, k) {
  const delen = repo.split('/');
  const basis = 'https://' + delen[0].toLowerCase() + '.github.io/' + delen[1] + '/';
  return k === 'P' ? basis : k === 'A' ? basis + 'acceptatie/' : basis + 'test/';
}
function uitHash() {
  const m = location.hash.match(/^#app=(.+)$/);
  if (!m) return null;
  let v;
  try { v = decodeURIComponent(m[1]); } catch (e) { return null; }
  return v === OEFEN || REPO_RE.test(v) ? v : null;
}

/* ---------- GitHub ophalen ---------- */
const LIVE = { repo: null, laden: false, fout: null, data: null, opgehaald: 0, limiet: null };
const PLATFORM = { data: leesJson(PLATFORM_KEY, null), laden: false };
let liveVolgnr = 0;

function gh(pad) {
  return fetch(API + pad, { headers: { Accept: 'application/vnd.github+json' } })
    .catch(function () { const e = new Error('netwerk'); e.netwerk = true; throw e; })
    .then(function (r) {
      const rest = r.headers.get('X-RateLimit-Remaining');
      if (rest !== null) LIVE.limiet = { rest: +rest, max: +(r.headers.get('X-RateLimit-Limit') || 60), reset: +(r.headers.get('X-RateLimit-Reset') || 0) };
      if (r.ok) return r.json();
      const e = new Error('http ' + r.status);
      e.status = r.status;
      throw e;
    });
}
function slankCommit(c) {
  const cm = c.commit || {}, au = cm.author || cm.committer || {};
  return { sha: c.sha, msg: String(cm.message || '').split('\n')[0], auteur: au.name || (c.author && c.author.login) || '', datum: au.date || null, url: c.html_url };
}
// Met welke OTAP-CI-versie draaide deze run? GitHub legt herbruikbare workflows vast in referenced_workflows.
function otapVanRun(r) {
  const w = (r.referenced_workflows || []).find(function (x) { return /\/otap-ci\/\.github\/workflows\//i.test(x.path || ''); });
  if (!w) return null;
  const versie = w.ref ? w.ref.replace(/^refs\/(tags|heads)\//, '') : (String(w.path).split('@')[1] || '?');
  return { versie: versie, sha: w.sha || null };
}
function slankRun(r) {
  return { naam: r.name || '', branch: r.head_branch || '', sha: r.head_sha, status: r.status, uitkomst: r.conclusion, datum: r.created_at, url: r.html_url, otap: otapVanRun(r) };
}
function foutTekst(e, repo) {
  if (e.netwerk) return 'GitHub is niet bereikbaar. Controleer je internetverbinding en probeer het opnieuw.';
  if (e.status === 404) return 'Repo ' + repo + ' niet gevonden. Controleer de naam; alleen openbare repo\'s zijn te lezen.';
  if ((e.status === 403 || e.status === 429) && LIVE.limiet && LIVE.limiet.rest === 0) {
    return 'GitHub-limiet bereikt (60 verzoeken per uur zonder inloggen). Weer beschikbaar om ' + hhmm(LIVE.limiet.reset * 1000) + '.';
  }
  if (e.status) return 'GitHub gaf een foutmelding (' + e.status + '). Probeer het later opnieuw.';
  if (window.console) console.error(e);
  return 'De gegevens van GitHub hadden een onverwachte vorm.';
}

// Nieuwste vrijgegeven OTAP-CI-versie = hoogste tag vN; 30 minuten bewaard, gedeeld door alle apps.
function haalPlatform(forceer) {
  const d = PLATFORM.data;
  if (PLATFORM.laden || (!forceer && d && Date.now() - d.t < PLATFORM_MS)) return;
  PLATFORM.laden = true;
  gh('/repos/' + PLATFORM_REPO + '/git/matching-refs/tags/v').then(function (refs) {
    const tags = refs.map(function (r) { return { naam: r.ref.replace('refs/tags/', ''), sha: r.object.sha, type: r.object.type }; })
      .filter(function (t) { return /^v\d+(\.\d+)*$/.test(t.naam); })
      .sort(function (a, b) { return vergelijkVersie(b.naam, a.naam); });
    if (!tags.length) return { t: Date.now(), nieuwste: null };
    const n = tags[0];
    if (n.type !== 'tag') return { t: Date.now(), nieuwste: { naam: n.naam, sha: n.sha, commit: n.sha, datum: null } };
    return gh('/repos/' + PLATFORM_REPO + '/git/tags/' + n.sha).then(function (t) {
      return { t: Date.now(), nieuwste: { naam: n.naam, sha: n.sha, commit: t.object && t.object.sha, datum: t.tagger && t.tagger.date } };
    });
  }).then(function (nieuw) {
    PLATFORM.data = nieuw;
    schrijfJson(PLATFORM_KEY, nieuw);
  }).catch(function (e) {
    if (window.console) console.warn('Nieuwste OTAP-CI-versie niet opgehaald', e);
  }).then(function () {
    PLATFORM.laden = false;
    renderLive();
  });
}

function haalApp(repo, forceer) {
  haalPlatform(forceer);
  const cache = leesJson(CACHE_KEY, {});
  const c = cache[repo];
  const nr = ++liveVolgnr;
  LIVE.repo = repo;
  LIVE.fout = null;
  LIVE.data = c ? c.d : null;
  LIVE.opgehaald = c ? c.t : 0;
  if (!forceer && c && Date.now() - c.t < CACHE_MS) { LIVE.laden = false; renderLive(); return Promise.resolve(); }
  LIVE.laden = true;
  renderLive();
  const pad = '/repos/' + repo;
  return gh(pad + '/branches?per_page=100').then(function (branches) {
    const namen = branches.map(function (b) { return b.name; });
    const envB = ['development', 'acceptatie', 'main'].filter(function (b) { return namen.indexOf(b) >= 0; });
    return Promise.all([gh(pad + '/actions/runs?per_page=60')].concat(envB.map(function (b) { return gh(pad + '/commits?per_page=30&sha=' + b); })))
      .then(function (res) {
        const commits = {};
        envB.forEach(function (b, i) { commits[b] = res[i + 1].map(slankCommit); });
        return { runs: (res[0].workflow_runs || []).map(slankRun), commits: commits };
      });
  }).then(function (d) {
    if (nr !== liveVolgnr) return;
    LIVE.data = d; LIVE.opgehaald = Date.now(); LIVE.laden = false;
    const vers = leesJson(CACHE_KEY, {});
    vers[repo] = { t: LIVE.opgehaald, d: d };
    Object.keys(vers).sort(function (a, b) { return vers[b].t - vers[a].t; }).slice(6).forEach(function (r) { delete vers[r]; });
    schrijfJson(CACHE_KEY, vers);
    renderLive();
  }).catch(function (e) {
    if (nr !== liveVolgnr) return;
    LIVE.laden = false;
    LIVE.fout = foutTekst(e, repo);
    renderLive();
  });
}

/* ---------- model ---------- */
function isDeploy(r) { return /deploy/i.test(r.naam); }
function isFout(r) { return r.status === 'completed' && ['success', 'skipped', 'neutral'].indexOf(r.uitkomst) < 0; }
// Hoogste versienummer uit het commitbericht ("Release: v3.20 + v3.21" -> v3.21), anders de korte sha.
function versie(c) {
  if (!c) return '—';
  const m = c.msg.match(VERSIE_RE);
  if (!m) return sha7(c.sha);
  return m.reduce(function (hoogste, v) { return vergelijkVersie(v, hoogste) > 0 ? v : hoogste; });
}
function laatstePerWorkflow(runs) {
  const gezien = {}, uit = [];
  runs.forEach(function (r) { if (!gezien[r.naam]) { gezien[r.naam] = 1; uit.push(r); } });
  return uit;
}
function zoekCommit(d, sha, repo) {
  for (const b in d.commits) {
    const c = d.commits[b].find(function (x) { return x.sha === sha; });
    if (c) return c;
  }
  return { sha: sha, msg: '', auteur: '', datum: null, url: 'https://github.com/' + repo + '/commit/' + sha };
}
function model(d, repo) {
  const M = {};
  ['T', 'A', 'P'].forEach(function (k) {
    const b = BRANCH[k], lijst = d.commits[b];
    if (!lijst) { M[k] = null; return; }
    const runs = d.runs.filter(function (r) { return r.branch === b; });
    const deploys = runs.filter(isDeploy);
    const live = deploys.filter(function (r) { return r.status === 'completed' && r.uitkomst === 'success'; })[0] || null;
    M[k] = {
      branch: b, lijst: lijst, head: lijst[0] || null, deploys: deploys, laatste: deploys[0] || null, live: live,
      liveCommit: live ? zoekCommit(d, live.sha, repo) : null,
      checks: laatstePerWorkflow(runs.filter(function (r) { return !isDeploy(r); }))
    };
  });
  return M;
}
// Aantal commits op de bron die (binnen de laatste 30) nog niet op het doel staan.
function wachtend(bron, doel) {
  const set = {};
  doel.forEach(function (c) { set[c.sha] = 1; });
  for (let i = 0; i < bron.length; i++) if (set[bron[i].sha]) return i;
  return bron.length >= 30 ? '30+' : bron.length;
}
function commitsTekst(n) { return n + ' ' + (n === 1 ? 'commit' : 'commits'); }

// Platformversie van een run beoordelen tegen de nieuwste OTAP-CI-versie.
function platformLabel(otap, heeftRuns) {
  if (!otap) return heeftRuns ? { cls: 'info', tekst: 'Eigen workflows (geen OTAP-CI)' } : null;
  const N = PLATFORM.data && PLATFORM.data.nieuwste;
  const naam = 'OTAP-CI ' + otap.versie;
  if (!/^v\d+(\.\d+)*$/.test(otap.versie)) return { cls: 'no', tekst: naam + ' (geen vrijgegeven versie)' };
  if (!N) return { cls: 'info', tekst: naam };
  const c = vergelijkVersie(otap.versie, N.naam);
  if (c < 0) return { cls: 'no', tekst: naam + ' · ' + N.naam + ' beschikbaar' };
  if (c === 0 && otap.sha && N.sha && otap.sha !== N.sha && otap.sha !== N.commit) return { cls: 'no', tekst: naam + ' · oudere stand' };
  return { cls: 'ok', tekst: naam + ' · nieuwste' };
}

/* ---------- weergave ---------- */
function pillL(c, t, bezig) { return '<span class="pill' + (bezig ? ' busy' : '') + '" style="--c:' + c + '">' + t + '</span>'; }
function extLink(url, tekst, cls) { return '<a class="' + cls + '" href="' + esc(url) + '" target="_blank" rel="noopener">' + tekst + '</a>'; }
function item(cls, ic, tekst) { return '<li class="' + cls + '"><span class="ic">' + ic + '</span><span class="lbl">' + tekst + '</span></li>'; }
function chip(lab, otap) {
  const inhoud = '<span class="chip ' + lab.cls + '">' + esc(lab.tekst) + '</span>';
  return otap ? extLink(PLATFORM_URL + '/tree/' + encodeURIComponent(otap.versie), inhoud, 'chip-link') : inhoud;
}
function platformRij(otap, heeftRuns) {
  const lab = platformLabel(otap, heeftRuns);
  return lab ? '<dt>Platform</dt><dd>' + chip(lab, otap) + '</dd>' : '';
}
function laneKop(k, sub, pill, cls) {
  return '<article class="lane' + (cls || '') + '" data-env="' + k + '" style="--env:' + envVar(k) + '">' +
    '<div class="lane-head"><div class="glyph" aria-hidden="true">' + k + '</div><div class="lane-title"><h2>' + OMG[k].name + '</h2><div class="host">' + sub + '</div></div>' + pill + '</div>';
}
function checkItem(r) {
  const naam = extLink(r.url, esc(r.naam), 'lnk');
  if (r.status !== 'completed') return item('run', '…', naam + ' loopt');
  if (isFout(r)) return item('no', '!', naam + ': ' + (UITKOMST[r.uitkomst] || esc(r.uitkomst)));
  return item('ok', '✓', naam + ' ' + (UITKOMST[r.uitkomst] || 'geslaagd'));
}

function laneLiveO(M, repo) {
  const T = M.T;
  if (!T) {
    return laneKop('O', 'branch development', pillL('var(--ink-3)', 'Geen branch'), ' leeg') +
      '<div class="lane-body"><p class="leeg-tekst">Deze app heeft geen branch <code>development</code>.</p></div></article>';
  }
  const head = T.head, checks = T.checks;
  const bezig = checks.some(function (r) { return r.status !== 'completed'; });
  const fout = checks.some(isFout);
  const pill = bezig ? pillL('var(--env)', 'Checks lopen…', true) : fout ? pillL('var(--bad)', 'CI rood') : checks.length ? pillL('var(--ok)', 'CI groen') : pillL('var(--ink-3)', 'Geen checks');
  const metOtap = checks.find(function (r) { return r.otap; });
  let h = laneKop('O', 'branch development', pill);
  h += '<div class="lane-body"><div class="ver"><div class="ver-txt">' + esc(versie(head)) + '</div>';
  h += '<div class="ver-meta">' + (head ? '<span class="mono">' + sha7(head.sha) + '</span> · ' + esc(head.auteur) + ' · ' + fmt(head.datum) : 'Geen commits') + '</div></div>';
  if (head) h += '<p class="msg">' + esc(head.msg) + '</p>';
  h += '<dl class="facts"><dt>Bron</dt><dd>' + extLink('https://github.com/' + repo + '/commits/development', 'Commits op development', 'lnk') + '</dd>' +
    platformRij(metOtap ? metOtap.otap : null, checks.length > 0) + '</dl></div>';
  h += '<div class="gate"><div class="gate-hd"><span>Poort naar Test</span><em>automatisch bij push</em></div><ul class="checks">';
  h += checks.length ? checks.map(checkItem).join('') : item('info', 'i', 'Geen CI-workflows gevonden');
  if (T.live && head && T.live.sha === head.sha) h += item('ok', '✓', 'Nieuwste commit staat op Test');
  else if (T.laatste && head && T.laatste.sha === head.sha && T.laatste.status !== 'completed') h += item('run', '…', 'Uitrol naar Test loopt');
  else h += item('no', '!', 'Nieuwste commit staat nog niet op Test');
  return h + '</ul></div></article>';
}

function laneLiveEnv(k, M, repo) {
  const E = M[k], b = BRANCH[k];
  const url = pagesUrl(repo, k), host = url.replace(/^https:\/\/[^/]+/, '');
  if (!E) {
    return laneKop(k, esc(host), pillL('var(--ink-3)', 'Niet ingericht'), ' leeg') +
      '<div class="lane-body"><p class="leeg-tekst">Deze app heeft geen branch <code>' + b + '</code>.' +
      (k === 'A' ? ' Wijzigingen gaan van Test rechtstreeks naar Productie.' : '') + '</p></div></article>';
  }
  const L = E.laatste;
  const pill = !L ? pillL('var(--ink-3)', 'Niet uitgerold')
    : L.status !== 'completed' ? pillL('var(--env)', 'Uitrollen…', true)
    : L.uitkomst === 'success' ? pillL('var(--ok)', 'Live') : pillL('var(--bad)', 'Uitrol mislukt');
  let h = laneKop(k, extLink(url, esc(host), 'lnk'), pill, k === 'P' ? ' is-prod' : '');
  h += '<div class="lane-body"><div class="ver"><div class="ver-txt">' + (E.live ? esc(versie(E.liveCommit)) : '—') + '</div>';
  h += '<div class="ver-meta">' + (E.live ? '<span class="mono">' + sha7(E.live.sha) + '</span> · uitgerold ' + fmt(E.live.datum) : 'Nog geen geslaagde uitrol gevonden') + '</div></div>';
  if (E.live && E.liveCommit.msg) h += '<p class="msg">' + esc(E.liveCommit.msg) + '</p>';
  if (L && isFout(L) && E.live) {
    h += '<div class="note"><b>Laatste uitrol ' + (UITKOMST[L.uitkomst] || 'mislukt') + '</b> (' + fmt(L.datum) + '). Op ' + OMG[k].name + ' staat nog ' + esc(versie(E.liveCommit)) + '.</div>';
  }
  h += '<dl class="facts"><dt>Branch</dt><dd><code>' + b + '</code></dd>';
  if (L) h += '<dt>Uitrol</dt><dd>' + extLink(L.url, esc(L.naam), 'lnk') + ' · ' + (L.status !== 'completed' ? 'bezig' : (UITKOMST[L.uitkomst] || esc(L.uitkomst))) + '</dd>';
  h += platformRij(E.live ? E.live.otap : (L ? L.otap : null), E.deploys.length > 0);
  h += '</dl></div><div class="gate">';
  if (k !== 'P') {
    const nk = k === 'T' ? (M.A ? 'A' : 'P') : 'P', N = M[nk];
    const fout = E.checks.some(isFout), bezig = E.checks.some(function (r) { return r.status !== 'completed'; });
    h += '<div class="gate-hd"><span>Op weg naar ' + OMG[nk].name + '</span><em>' + (nk === 'P' ? 'na akkoord' : 'fast-forward') + '</em></div><ul class="checks">';
    h += !E.checks.length ? item('info', 'i', 'Geen CI op ' + b) : bezig ? item('run', '…', 'CI loopt op ' + b) : fout ? item('no', '!', 'CI rood op ' + b) : item('ok', '✓', 'CI groen op ' + b);
    h += !L ? item('no', '!', 'Nog niet uitgerold') : L.status !== 'completed' ? item('run', '…', 'Uitrol loopt')
      : L.uitkomst === 'success' ? item('ok', '✓', 'Uitrol geslaagd') : item('no', '!', 'Uitrol ' + (UITKOMST[L.uitkomst] || 'mislukt'));
    if (N) {
      const n = wachtend(E.lijst, N.lijst);
      h += n === 0 ? item('ok', '✓', OMG[nk].name + ' is bij') : item('wait', '→', commitsTekst(n) + ' klaar voor ' + OMG[nk].name);
    }
    if (nk === 'P') h += item('info', 'i', 'Productie alleen na expliciet akkoord');
    h += '</ul>' + extLink('https://github.com/' + repo + '/compare/' + BRANCH[nk] + '...' + b, 'Verschil met ' + OMG[nk].name + ' op GitHub →', 'btn ghost');
  } else {
    h += '<div class="gate-hd"><span>Productie</span><em>alleen-lezen</em></div>';
    h += extLink(url, 'Open de app →', 'btn prod') + extLink('https://github.com/' + repo + '/actions?query=branch%3Amain', 'Uitrolgeschiedenis op GitHub', 'btn ghost');
  }
  return h + '</div></article>';
}

function samenvattingPlatform(M) {
  const P = M.P;
  const otapP = P && P.live ? P.live.otap : null;
  let s = '';
  const lab = platformLabel(otapP, !!(P && P.deploys.length));
  if (lab) s += '<span>Platform in productie: ' + chip(lab, otapP) + '</span>';
  const afwijkend = ['T', 'A'].filter(function (k) {
    const o = M[k] && M[k].live ? M[k].live.otap : null;
    return o && (!otapP || o.versie !== otapP.versie);
  }).map(function (k) { return OMG[k].name + ' ' + esc(M[k].live.otap.versie); });
  if (afwijkend.length) s += '<span>Afwijkend: <b>' + afwijkend.join(', ') + '</b></span>';
  const N = PLATFORM.data && PLATFORM.data.nieuwste;
  s += '<span>Nieuwste OTAP-CI: ' + (N ? extLink(PLATFORM_URL + '/tree/' + encodeURIComponent(N.naam), '<b class="mono">' + esc(N.naam) + '</b>', 'lnk') +
    (N.datum ? ' · vrijgegeven ' + fmt(N.datum) : '') : (PLATFORM.laden ? 'wordt opgehaald…' : 'onbekend')) + '</span>';
  return s;
}

function renderLive() {
  const repo = LIVE.repo, d = LIVE.data;
  if (!repo) return;
  const st = document.getElementById('live-status');
  if (LIVE.fout) st.innerHTML = '<div class="melding fout"><span>' + esc(LIVE.fout) + '</span><button class="mini" type="button" data-l="ververs">Opnieuw proberen</button></div>';
  else if (LIVE.laden) st.innerHTML = '<div class="melding laden">' + (d ? 'Bijwerken vanuit GitHub…' : 'Stand wordt gelezen uit GitHub…') + '</div>';
  else st.innerHTML = '';

  const naam = '<span><b>' + esc(appInfo(repo).naam) + '</b></span>';
  if (!d) {
    document.getElementById('live-summary').innerHTML = naam;
    document.getElementById('live-lanes').innerHTML = ORDER.map(function (k) {
      return laneKop(k, '', pillL('var(--ink-3)', LIVE.fout ? 'Onbekend' : '…'), ' leeg') +
        '<div class="lane-body"><p class="leeg-tekst">' + (LIVE.fout ? 'Geen gegevens.' : 'Laden…') + '</p></div></article>';
    }).join('');
    document.getElementById('live-commits').innerHTML = '';
    document.getElementById('live-log').innerHTML = '';
    document.getElementById('live-runcount').textContent = '';
    return;
  }

  const M = model(d, repo);
  const doelK = M.A ? 'A' : 'P';
  let s = naam;
  s += M.P && M.P.live ? '<span>Productie draait <b class="mono">' + esc(versie(M.P.liveCommit)) + '</b> sinds ' + fmt(M.P.live.datum) + '</span>'
    : '<span>Productie: <b>nog geen geslaagde uitrol</b></span>';
  if (M.T && M[doelK]) s += '<span><b>' + commitsTekst(wachtend(M.T.lijst, M[doelK].lijst)) + '</b> op Test nog niet in ' + OMG[doelK].name + '</span>';
  const rood = ['T', 'A', 'P'].reduce(function (t, k) { return t + (M[k] ? M[k].checks.filter(isFout).length : 0); }, 0);
  s += '<span>CI: <b style="color:var(' + (rood ? '--bad' : '--ok') + ')">' + (rood ? rood + ' rood' : 'groen') + '</b></span>';
  s += samenvattingPlatform(M);
  s += '<span>Bijgewerkt ' + hhmm(LIVE.opgehaald) + (LIVE.limiet ? ' · GitHub-limiet ' + LIVE.limiet.rest + '/' + LIVE.limiet.max : '') + '</span>';
  document.getElementById('live-summary').innerHTML = s;

  document.getElementById('live-lanes').innerHTML = laneLiveO(M, repo) + laneLiveEnv('T', M, repo) + laneLiveEnv('A', M, repo) + laneLiveEnv('P', M, repo);

  const lijstB = M.T ? 'development' : M.A ? 'acceptatie' : 'main';
  const lijst = (d.commits[lijstB] || []).slice(0, 15);
  document.getElementById('live-commits-titel').textContent = 'Commits op ' + lijstB;
  const idxT = M.T && M.T.live ? M.T.lijst.findIndex(function (c) { return c.sha === M.T.live.sha; }) : -1;
  const sets = {};
  ['A', 'P'].forEach(function (k) { sets[k] = {}; if (M[k]) M[k].lijst.forEach(function (c) { sets[k][c.sha] = 1; }); });
  document.getElementById('live-commits').innerHTML = lijst.map(function (c, i) {
    const pips = ORDER.map(function (k) {
      let cls = '';
      if (k === 'O') cls = lijstB === 'development' ? (i === 0 ? ' here' : ' on') : '';
      else if (k === 'T') cls = !M.T ? '' : (M.T.live && c.sha === M.T.live.sha) ? ' here' : (idxT >= 0 && i > idxT) ? ' on' : '';
      else cls = !M[k] ? '' : (M[k].live && c.sha === M[k].live.sha) ? ' here' : sets[k][c.sha] ? ' on' : '';
      return '<span class="pip' + cls + '" style="--env:' + envVar(k) + '" title="' + OMG[k].name + '">' + k + '</span>';
    }).join('');
    return '<tr><td class="v">' + esc(versie(c)) + '</td><td class="msg-cell">' + extLink(c.url, esc(c.msg), 'lnk') + '</td><td>' + esc(c.auteur) +
      '</td><td>' + fmt(c.datum) + '</td><td><span class="pips">' + pips + '</span></td></tr>';
  }).join('');

  document.getElementById('live-runcount').textContent = d.runs.length + ' recente runs';
  document.getElementById('live-log').innerHTML = d.runs.slice(0, 25).map(function (r) {
    const k = BRANCH_ENV[r.branch];
    const lv = r.status !== 'completed' ? 'info' : isFout(r) ? (r.uitkomst === 'cancelled' ? 'warn' : 'bad') : 'ok';
    const uit = r.status !== 'completed' ? 'bezig' : (UITKOMST[r.uitkomst] || esc(r.uitkomst));
    return '<li class="' + lv + '"><time>' + fmt(r.datum) + '</time><span class="e" style="--env:' + (k ? envVar(k) : 'var(--ink-3)') + '" title="' + esc(r.branch) + '">' +
      (k || '·') + '</span><span class="txt">' + extLink(r.url, esc(r.naam), 'lnk') + ' · ' + uit + ' · <span class="mono">' + esc(r.branch) + '</span>' +
      (r.otap ? ' · <span class="mono">OTAP-CI ' + esc(r.otap.versie) + '</span>' : '') + '</span></li>';
  }).join('');
}

/* ---------- kiezer ---------- */
function renderKiezer() {
  const sel = document.getElementById('app-kies');
  let h = '<optgroup label="Live uit GitHub">';
  alleApps().forEach(function (a) { h += '<option value="' + esc(a.repo) + '">' + esc(a.naam) + '</option>'; });
  if (KEUZE.app !== OEFEN && !alleApps().some(function (a) { return gelijk(a.repo, KEUZE.app); })) {
    h += '<option value="' + esc(KEUZE.app) + '">' + esc(appInfo(KEUZE.app).naam) + '</option>';
  }
  h += '</optgroup><optgroup label="Oefenen"><option value="' + OEFEN + '">Oefenstraat (simulatie)</option></optgroup>';
  sel.innerHTML = h;
  sel.value = KEUZE.app;
  document.getElementById('verwijder').hidden = !KEUZE.extra.some(function (a) { return gelijk(a.repo, KEUZE.app); });
  document.getElementById('ververs').hidden = KEUZE.app === OEFEN;
}

function kies(app) {
  KEUZE.app = app;
  schrijfJson(KEUZE_KEY, KEUZE);
  if (location.hash !== '#app=' + app) history.replaceState(null, '', '#app=' + app);
  const live = app !== OEFEN;
  document.getElementById('view-live').hidden = !live;
  document.getElementById('view-sim').hidden = live;
  document.getElementById('subtitel').innerHTML = live
    ? 'Live uit GitHub · ' + extLink('https://github.com/' + app, esc(app), 'lnk') + ' · alleen-lezen'
    : 'Van eerste build tot productie, met alle poorten ertussen. <span class="demo-tag">Oefenstraat · gesimuleerd</span>';
  renderKiezer();
  if (live) haalApp(app, false);
}

function voegToe(invoer) {
  let r = String(invoer || '').trim().replace(/^https?:\/\/github\.com\//i, '').replace(/\.git$/i, '').replace(/\/+$/, '');
  if (!REPO_RE.test(r)) return 'Vul een repo in als eigenaar/repo, bijvoorbeeld HansdeRooijPrive/Prive-Reizen-Schotland.';
  const bestaand = alleApps().find(function (a) { return gelijk(a.repo, r); });
  if (bestaand) r = bestaand.repo;
  else KEUZE.extra.push({ repo: r, naam: r.split('/')[1].replace(/[-_]+/g, ' ') });
  kies(r);
  return '';
}
