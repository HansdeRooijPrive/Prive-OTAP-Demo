if (ENV_LABEL) document.getElementById('env-badge').textContent = ENV_LABEL;
document.getElementById('sleutel').textContent = STORAGE_KEY;

const LIVE_ACT = {
  ververs: function () { if (KEUZE.app !== OEFEN) haalApp(KEUZE.app, true); },
  toevoegen: function () {
    const f = document.getElementById('toevoeg-form');
    f.hidden = !f.hidden;
    document.getElementById('toevoeg-fout').textContent = '';
    if (!f.hidden) document.getElementById('toevoeg-repo').focus();
  },
  annuleer: function () { document.getElementById('toevoeg-form').hidden = true; },
  verwijder: function () {
    KEUZE.extra = KEUZE.extra.filter(function (a) { return !gelijk(a.repo, KEUZE.app); });
    kies(STANDAARD_APPS[0].repo);
  }
};

document.addEventListener('click', function (e) {
  const l = e.target.closest('[data-l]');
  if (l) { LIVE_ACT[l.dataset.l](); return; }
  const b = e.target.closest('[data-a]');
  if (!b || b.disabled) return;
  ACT[b.dataset.a](b.dataset.k);
});
document.getElementById('rels').addEventListener('keydown', function (e) {
  if ((e.key === 'Enter' || e.key === ' ') && e.target.dataset.a) { e.preventDefault(); ACT.sel(e.target.dataset.k); }
});
document.getElementById('app-kies').addEventListener('change', function () { kies(this.value); });
document.getElementById('toevoeg-form').addEventListener('submit', function (e) {
  e.preventDefault();
  const fout = voegToe(document.getElementById('toevoeg-repo').value);
  document.getElementById('toevoeg-fout').textContent = fout;
  if (!fout) { this.hidden = true; this.reset(); }
});
window.addEventListener('hashchange', function () {
  const h = uitHash();
  if (h && h !== KEUZE.app) kies(h);
});

render();
kies(uitHash() || (KEUZE.app === OEFEN || REPO_RE.test(KEUZE.app || '') ? KEUZE.app : STANDAARD_APPS[0].repo));
setInterval(tikMetrieken, reduced ? 8000 : 3000);
// Live stand automatisch verversen zodra de cache verloopt (alleen als de pagina zichtbaar is).
setInterval(function () {
  if (KEUZE.app !== OEFEN && !LIVE.laden && document.visibilityState === 'visible' && Date.now() - LIVE.opgehaald > CACHE_MS) haalApp(KEUZE.app, false);
}, 60000);

// Testhaakje voor de geautomatiseerde tests.
window.__app = {
  get env() { return ENV; },
  get key() { return STORAGE_KEY; },
  get keuze() { return KEUZE.app; },
  kies: kies,
  staat: function () { return JSON.parse(JSON.stringify(S)); },
  huidig: cur,
  bezig: busy,
  tempo: function (ms) { DUR = ms; REG_MS = ms; }
};
})();
