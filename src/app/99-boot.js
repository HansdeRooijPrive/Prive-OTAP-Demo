if (ENV_LABEL) document.getElementById('env-badge').textContent = ENV_LABEL;
document.getElementById('sleutel').textContent = STORAGE_KEY;

document.addEventListener('click', function (e) {
  const b = e.target.closest('[data-a]');
  if (!b || b.disabled) return;
  ACT[b.dataset.a](b.dataset.k);
});
document.getElementById('rels').addEventListener('keydown', function (e) {
  if ((e.key === 'Enter' || e.key === ' ') && e.target.dataset.a) { e.preventDefault(); ACT.sel(e.target.dataset.k); }
});

render();
setInterval(tikMetrieken, reduced ? 8000 : 3000);

// Testhaakje voor de geautomatiseerde tests.
window.__app = {
  get env() { return ENV; },
  get key() { return STORAGE_KEY; },
  staat: function () { return JSON.parse(JSON.stringify(S)); },
  huidig: cur,
  bezig: busy,
  tempo: function (ms) { DUR = ms; REG_MS = ms; }
};
})();
