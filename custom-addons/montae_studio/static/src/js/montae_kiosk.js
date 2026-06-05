/* ─── Montae Studio — Kiosk JS ──────────────────────────────────────────── */
'use strict';

(function () {

  function jsonRpc(url, params) {
    return fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', method: 'call', params }),
    }).then(r => r.json()).then(r => r.result || r.error);
  }

  const queryInput   = document.getElementById('kiosk-query');
  const searchBtn    = document.getElementById('kiosk-search-btn');
  const resultsEl    = document.getElementById('kiosk-results');
  const confirmEl    = document.getElementById('kiosk-confirm');
  const confirmName  = document.getElementById('kiosk-confirm-name');
  const confirmSess  = document.getElementById('kiosk-confirm-session');
  const resetBtn     = document.getElementById('kiosk-reset');

  function doSearch() {
    const q = queryInput.value.trim();
    if (!q) return;
    resultsEl.innerHTML = '<p style="color:var(--clr-muted);padding:.75rem;">Searching…</p>';
    resultsEl.style.display = '';
    jsonRpc('/kiosk/lookup', { query: q }).then(data => {
      resultsEl.innerHTML = '';
      if (!data || !data.length) {
        resultsEl.innerHTML = '<p style="color:var(--clr-muted);padding:.75rem;">No upcoming bookings found.</p>';
        return;
      }
      data.forEach(b => {
        const item = document.createElement('div');
        item.className = 'kiosk-result-item';
        item.innerHTML = '<div class="kiosk-result-name">' + escHtml(b.client) + '</div>' +
          '<div class="kiosk-result-details">' + escHtml(b.session) + ' · ' + escHtml(b.resource) + ' · ' + escHtml(b.time) + '</div>';
        item.addEventListener('click', () => checkIn(b));
        resultsEl.appendChild(item);
      });
      if (typeof lucide !== 'undefined') lucide.createIcons();
    });
  }

  function checkIn(b) {
    jsonRpc('/kiosk/checkin', { booking_id: b.id, token: b.token }).then(data => {
      if (data && data.status === 'checked_in') {
        confirmName.textContent  = data.client;
        confirmSess.textContent  = data.session + ' at ' + data.resource;
        resultsEl.style.display  = 'none';
        confirmEl.style.display  = '';
        if (typeof lucide !== 'undefined') lucide.createIcons();
      } else {
        alert((data && data.message) || 'Check-in failed. Please see staff.');
      }
    });
  }

  function escHtml(s) {
    return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  }

  if (searchBtn) searchBtn.addEventListener('click', doSearch);
  if (queryInput) {
    queryInput.addEventListener('keydown', e => { if (e.key === 'Enter') doSearch(); });
  }
  if (resetBtn) {
    resetBtn.addEventListener('click', () => {
      queryInput.value = '';
      resultsEl.innerHTML = '';
      resultsEl.style.display = 'none';
      confirmEl.style.display = 'none';
    });
  }

})();
