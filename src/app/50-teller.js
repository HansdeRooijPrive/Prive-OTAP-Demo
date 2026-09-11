function lees() {
  try { return parseInt(localStorage.getItem(STORAGE_KEY) || '0', 10) || 0; }
  catch (e) { return 0; }
}
function schrijf(n) {
  try { localStorage.setItem(STORAGE_KEY, String(n)); } catch (e) { /* geen opslag */ }
}
function teken() {
  document.getElementById('teller').textContent = lees();
}
