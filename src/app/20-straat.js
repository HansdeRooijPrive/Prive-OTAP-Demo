// Toestand, poortcriteria, uitrol en acties. Opslag per omgeving via STORAGE_KEY.
const reduced = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
let DUR = reduced ? 220 : 850;        // duur per uitrolstap (ms)
let REG_MS = reduced ? 120 : 260;     // tik van de regressietest (ms)

function laad() {
  let s = null;
  try { s = JSON.parse(localStorage.getItem(STORAGE_KEY)); } catch (e) { s = null; }
  if (!s || typeof s !== 'object' || !s.envs) s = seed();
  if (s.gates.T.reg === 'running') s.gates.T.reg = 'idle';   // onderbroken test na herladen
  ORDER.forEach(function (k) { if (s.envs[k].status !== 'failed') s.envs[k].status = 'ok'; });
  return s;
}
let S = laad();
function save() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(S)); } catch (e) { /* geen opslag */ }
}

const RUN = {};      // lopende uitrol per omgeving (niet opgeslagen)
let regCount = 0, regTimer = null, freshLog = 0;

function cur(k) { const h = S.envs[k].hist; return h[h.length - 1]; }
function prev(k) { const h = S.envs[k].hist; return h.length > 1 ? h[h.length - 2] : null; }
function rel(v) { return S.releases.find(function (r) { return r.v === v; }); }
function busy() { return Object.keys(RUN).length > 0; }
function now() {
  const d = new Date();
  return d.getDate() + ' ' + MONTHS[d.getMonth()] + ' ' + String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
}
function log(e, lv, x) {
  S.log.unshift({ t: now(), e: e, lv: lv, x: x });
  freshLog++;
  if (S.log.length > 80) S.log.pop();
}

/* ---------- poortcriteria ---------- */
function gate(src) {
  const tgt = NEXT[src], g = [];
  if (src === 'O') {
    g.push({ ok: true, l: 'Build geslaagd' }, { ok: true, l: 'Unittests 412/412 geslaagd' }, { ok: true, l: 'SAST-scan: 0 kritieke bevindingen' });
  } else if (src === 'T') {
    const r = S.gates.T.reg;
    g.push(r === 'pass' ? { ok: true, l: 'Regressietest 186/186 geslaagd' }
      : r === 'running' ? { run: true, l: 'Regressietest loopt… ' + regCount + '/186' }
      : { ok: false, l: 'Regressietest nog niet uitgevoerd', act: 'reg', al: 'Starten' });
    g.push({ ok: !S.freeze, l: S.freeze ? 'Release freeze actief' : 'Geen release freeze' });
  } else {
    const a = S.gates.A;
    g.push(a.uat ? { ok: true, l: 'Gebruikersacceptatie: akkoord van ' + PO + ' (PO)' } : { ok: false, l: 'Gebruikersacceptatie door product owner', act: 'uat', al: 'Akkoord geven' });
    g.push(a.cab ? { ok: true, l: a.chg + ' goedgekeurd door ' + CM + ' · vier-ogenprincipe' } : { ok: false, l: 'Change-goedkeuring (goedkeurder ≠ uitvoerder)', act: 'cab', al: 'Goedkeuren' });
    g.push({ ok: S.windowOpen, l: S.windowOpen ? 'Binnen wijzigingsvenster (tot 20:00)' : 'Buiten wijzigingsvenster (18:00–20:00)' });
    g.push({ ok: !S.freeze, l: S.freeze ? 'Release freeze actief' : 'Geen release freeze' });
  }
  let why = '';
  if (RUN[src] || RUN[tgt]) why = 'Wacht tot de lopende uitrol klaar is.';
  else if (cur(src) === cur(tgt)) why = OMG[tgt].name + ' draait deze versie al.';
  else if (g.some(function (c) { return !c.ok; })) why = 'Nog niet alle poortcriteria zijn gehaald.';
  return { g: g, why: why, ok: !why };
}

/* ---------- uitrol ---------- */
function deploy(k, v, kind, by) {
  RUN[k] = { steps: STEPS[kind], i: 0, v: v, kind: kind, fail: false };
  S.envs[k].status = 'ok';
  log(k, 'info', (kind === 'rollback' ? 'Terugdraaien naar ' : kind === 'build' ? 'Build ' : 'Uitrol ') + v + ' gestart door ' + by);
  render();
  function step() {
    const r = RUN[k];
    if (!r) return;
    if (kind === 'prod' && S.failSmoke && r.steps[r.i] === 'Rooktest') {
      r.fail = true;
      render();
      setTimeout(function () {
        delete RUN[k];
        S.envs[k].status = 'failed';
        log(k, 'bad', 'Rooktest ' + v + ' mislukt: /api/health gaf 503. Verkeer blijft op ' + cur(k) + ', groene omgeving afgebouwd.');
        save(); render();
      }, DUR * 1.4);
      return;
    }
    r.i++;
    if (r.i >= r.steps.length) { done(k, v, kind, by); return; }
    render();
    setTimeout(step, DUR);
  }
  setTimeout(step, DUR);
}

function done(k, v, kind, by) {
  delete RUN[k];
  const e = S.envs[k];
  if (kind === 'rollback') e.hist.pop(); else e.hist.push(v);
  if (e.hist.length > 6) e.hist.shift();
  e.by = by; e.at = now(); e.status = 'ok';
  const r = rel(v);
  if (r && r.reached.indexOf(k) < 0) r.reached.push(k);
  if (k === 'T') S.gates.T.reg = 'idle';
  if (k === 'A') S.gates.A = { uat: false, cab: false, chg: null };
  if (kind === 'build') log(k, 'ok', v + ' gebouwd en uitgerold op Ontwikkeling');
  else if (kind === 'rollback') log(k, 'warn', 'Productie teruggedraaid naar ' + v + ' door ' + by);
  else if (k === 'P') { log(k, 'ok', v + ' live in Productie · ' + (S.gates.A.chg || 'CHG') + ' · ' + by); S.gates.A = { uat: false, cab: false, chg: null }; }
  else log(k, 'ok', v + ' gepromoveerd naar ' + OMG[k].name + ' door ' + by);
  save(); render();
}

/* ---------- acties ---------- */
const ACT = {
  promote: function (src) {
    if (!gate(src).ok) return;
    const tgt = NEXT[src];
    deploy(tgt, cur(src), tgt === 'P' ? 'prod' : 'std', OPERATOR);
  },
  build: function () {
    if (RUN.O) return;
    const last = S.releases[0].v.split('.');
    const v = last[0] + '.' + last[1] + '.' + (+last[2] + 1);
    const a = POOL[S.pool % POOL.length], b = POOL[(S.pool + 1) % POOL.length];
    S.pool += 2;
    const commit = Math.random().toString(16).slice(2, 9).padEnd(7, '0');
    S.releases.unshift({ v: v, commit: commit, branch: 'main', built: now(), reached: [], changes: [a, b] });
    S.selected = v;
    deploy('O', v, 'build', 'CI-pipeline');
  },
  reg: function () {
    if (S.gates.T.reg !== 'idle') return;
    S.gates.T.reg = 'running';
    regCount = 0;
    log('T', 'info', 'Regressietest gestart op ' + cur('T'));
    render();
    regTimer = setInterval(function () {
      regCount = Math.min(186, regCount + (reduced ? 62 : 17));
      if (regCount >= 186) {
        clearInterval(regTimer);
        S.gates.T.reg = 'pass';
        log('T', 'ok', 'Regressietest ' + cur('T') + ': 186/186 geslaagd');
        save();
      }
      render();
    }, REG_MS);
  },
  uat: function () { S.gates.A.uat = true; log('A', 'ok', 'Gebruikersacceptatie ' + cur('A') + ' akkoord door ' + PO); save(); render(); },
  cab: function () {
    const c = 'CHG-0' + (S.chgSeq++);
    S.gates.A.cab = true; S.gates.A.chg = c;
    log('A', 'ok', c + ' voor ' + cur('A') + ' goedgekeurd door ' + CM);
    save(); render();
  },
  rollback: function () { const p = prev('P'); if (!p || RUN.P) return; deploy('P', p, 'rollback', OPERATOR); },
  win: function () {
    S.windowOpen = !S.windowOpen;
    log('sys', 'info', S.windowOpen ? 'Wijzigingsvenster geopend (18:00–20:00, gesimuleerd)' : 'Wijzigingsvenster gesloten');
    save(); render();
  },
  freeze: function () {
    S.freeze = !S.freeze;
    log('sys', S.freeze ? 'warn' : 'info', S.freeze ? 'Release freeze ingesteld: geen promoties naar A en P' : 'Release freeze opgeheven');
    save(); render();
  },
  fail: function () { S.failSmoke = !S.failSmoke; save(); render(); },
  sel: function (v) { S.selected = v; save(); render(); },
  reset: function () {
    if (busy()) return;
    clearInterval(regTimer);
    S = seed(); regCount = 0;
    save(); render();
  }
};
