if (ENV_LABEL) document.getElementById('env-badge').textContent = ENV_LABEL;
document.getElementById('sleutel').textContent = STORAGE_KEY;
teken();
document.getElementById('tik').addEventListener('click', function () {
  schrijf(lees() + 1);
  teken();
});

// Testhaakje voor de geautomatiseerde tests.
window.__app = { get env() { return ENV; }, get key() { return STORAGE_KEY; }, lees: lees, schrijf: schrijf };
})();
