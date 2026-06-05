/* ─── Montae Studio — Staff Day-Planner JS ──────────────────────────────── */
'use strict';

(function () {

  /* ── Helpers ─────────────────────────────────────────────────────────── */
  function jsonRpc(url, params) {
    return fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', method: 'call', params }),
    }).then(r => r.json()).then(r => r.result || r.error);
  }
  function escHtml(s) {
    return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  }
  function fmtTime(iso) {
    const d = new Date(iso);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
  function statusLabel(s) {
    return { confirmed:'Confirmed', checked_in:'Checked In', completed:'Completed',
             cancelled:'Cancelled', no_show:'No Show' }[s] || s;
  }
  function reIcons() { if (typeof lucide !== 'undefined') lucide.createIcons(); }

  /* ── State ───────────────────────────────────────────────────────────── */
  const resources = window.MONTAE_RESOURCES || [];
  const grid      = document.getElementById('staff-cal-grid');
  const drawer    = document.getElementById('staff-drawer');
  const drawerContent = document.getElementById('staff-drawer-content');
  const drawerClose   = document.getElementById('staff-drawer-close');
  const modal         = document.getElementById('staff-modal');
  const modalClose    = document.getElementById('staff-modal-close');
  const modalCancelBtn = document.getElementById('modal-cancel-btn');
  const modalConfirmBtn = document.getElementById('modal-confirm-btn');

  if (!grid) return;

  const currentDate = grid.dataset.date;

  // Time range across all resources
  const openHour  = Math.min(...resources.map(r => Math.floor(r.open_time)),  7);
  const closeHour = Math.max(...resources.map(r => Math.ceil(r.close_time)),  19);
  const SLOT_H    = 30; // minutes per row
  const SLOT_PX   = 36; // px per slot

  /* ── Grid rendering ──────────────────────────────────────────────────── */
  function buildGrid(bookings) {
    grid.innerHTML = '';

    const cols = resources.length + 1; // +1 for time label col
    const totalSlotRows = (closeHour - openHour) * (60 / SLOT_H);
    grid.style.gridTemplateColumns = '54px ' + resources.map(() => '1fr').join(' ');
    grid.style.gridTemplateRows = 'auto ' + `${SLOT_PX}px `.repeat(totalSlotRows).trim();

    // Header row
    const timeHead = el('div', 'staff-col-header staff-col-header--time', '');
    grid.appendChild(timeHead);
    resources.forEach(r => {
      const h = el('div', 'staff-col-header', escHtml(r.name));
      grid.appendChild(h);
    });

    // Time slot rows
    for (let h = openHour; h < closeHour; h++) {
      for (let m = 0; m < 60; m += SLOT_H) {
        const isHalfHour = m === 30;
        // Time label
        const timeEl = el('div', 'staff-time-label', isHalfHour ? '' : fmtHM(h, 0));
        grid.appendChild(timeEl);

        // Resource columns
        resources.forEach(res => {
          const slot = el('div', 'staff-slot' + (isHalfHour ? ' staff-slot--half-hour' : ''));
          slot.style.height = SLOT_PX + 'px';
          slot.dataset.resourceId = res.id;
          slot.dataset.hour = h;
          slot.dataset.minute = m;
          slot.addEventListener('click', () => openNewBookingModal(res.id, h, m));
          grid.appendChild(slot);
        });
      }
    }

    // Place booking cards
    bookings.forEach(b => {
      const colIdx = resources.findIndex(r => r.id === b.resource_id);
      if (colIdx === -1) return;
      const startDt = new Date(b.start);
      const endDt   = new Date(b.end);
      const startH  = startDt.getHours();
      const startM  = startDt.getMinutes();
      const endH    = endDt.getHours();
      const endM    = endDt.getMinutes();

      const topSlot   = (startH - openHour) * (60 / SLOT_H) + Math.floor(startM / SLOT_H);
      const slotCount = ((endH - startH) * 60 + (endM - startM)) / SLOT_H;
      const topPx     = topSlot * SLOT_PX;
      const heightPx  = Math.max(slotCount * SLOT_PX - 2, SLOT_PX - 2);

      // Find the column's first slot cell to get a reference position
      const headerRows = 1;
      const slotsPerHour = 60 / SLOT_H;
      const totalRows  = (closeHour - openHour) * slotsPerHour;
      // Grid row of this booking: header + topSlot (1-indexed)
      const gridRow = headerRows + 1 + topSlot;
      const gridCol = 1 + colIdx + 1; // +1 for time label col

      const card = document.createElement('div');
      card.className = 'staff-booking-card staff-booking-card--' + b.state;
      card.style.cssText = `
        grid-row: ${gridRow} / span ${Math.ceil(slotCount)};
        grid-column: ${gridCol};
        z-index: 2;
        margin: 1px 2px;
      `;
      card.innerHTML = '<div class="staff-card-client">' + escHtml(b.client) + '</div>' +
                       '<div class="staff-card-session">' + escHtml(b.session_type) + '</div>';
      card.addEventListener('click', e => { e.stopPropagation(); openDrawer(b); });
      grid.appendChild(card);
    });

    reIcons();
  }

  function fmtHM(h, m) {
    const ampm = h < 12 ? 'am' : 'pm';
    const disp = h > 12 ? h - 12 : h;
    return disp + (m ? ':' + String(m).padStart(2,'0') : '') + ampm;
  }

  function el(tag, cls, text) {
    const e = document.createElement(tag);
    if (cls)  e.className   = cls;
    if (text !== undefined) e.textContent = text;
    return e;
  }

  /* ── Drawer ──────────────────────────────────────────────────────────── */
  function openDrawer(b) {
    const resName = (resources.find(r => r.id === b.resource_id) || {}).name || '';
    drawerContent.innerHTML = `
      <h3>${escHtml(b.session_type)}</h3>
      <div class="staff-drawer-field">
        <span>Client</span><span>${escHtml(b.client)}</span>
      </div>
      <div class="staff-drawer-field">
        <span>Resource</span><span>${escHtml(resName)}</span>
      </div>
      <div class="staff-drawer-field">
        <span>Time</span><span>${fmtTime(b.start)} – ${fmtTime(b.end)}</span>
      </div>
      <div class="staff-drawer-field">
        <span>Status</span>
        <span class="montae-badge montae-badge--${b.state}">${statusLabel(b.state)}</span>
      </div>
      ${b.notes ? `<div class="staff-drawer-field"><span>Notes</span><span>${escHtml(b.notes)}</span></div>` : ''}
      <div class="staff-drawer-actions">
        ${b.state === 'confirmed' ? `<button class="montae-btn montae-btn--primary" id="drawer-checkin">Check In</button>` : ''}
        ${['confirmed','checked_in'].includes(b.state) ? `<button class="montae-btn montae-btn--danger" id="drawer-cancel">Cancel</button>` : ''}
      </div>
    `;
    drawer.style.display = '';
    reIcons();

    const ciBtn = document.getElementById('drawer-checkin');
    if (ciBtn) ciBtn.addEventListener('click', () => {
      jsonRpc('/studio/staff/booking/' + b.id + '/checkin', {}).then(res => {
        if (res && res.status === 'checked_in') { drawer.style.display = 'none'; loadAndRender(); }
        else alert((res && res.message) || 'Check-in failed.');
      });
    });

    const canBtn = document.getElementById('drawer-cancel');
    if (canBtn) canBtn.addEventListener('click', () => {
      if (!confirm('Cancel this booking?')) return;
      jsonRpc('/studio/staff/booking/' + b.id + '/cancel', {}).then(res => {
        if (res && res.status === 'cancelled') { drawer.style.display = 'none'; loadAndRender(); }
        else alert((res && res.message) || 'Cancel failed.');
      });
    });
  }

  if (drawerClose) drawerClose.addEventListener('click', () => { drawer.style.display = 'none'; });

  /* ── New booking modal ───────────────────────────────────────────────── */
  let pendingResourceId = null;

  function openNewBookingModal(resourceId, hour, minute) {
    pendingResourceId = resourceId;
    const dateInput = document.getElementById('modal-start-time');
    if (dateInput) {
      const pad = n => String(n).padStart(2,'0');
      dateInput.value = currentDate + 'T' + pad(hour) + ':' + pad(minute);
    }
    const ridInput = document.getElementById('modal-resource-id');
    if (ridInput) ridInput.value = resourceId;
    modal.style.display = '';
    reIcons();
  }

  if (modalClose)    modalClose.addEventListener('click',    () => { modal.style.display = 'none'; });
  if (modalCancelBtn) modalCancelBtn.addEventListener('click', () => { modal.style.display = 'none'; });

  if (modalConfirmBtn) {
    modalConfirmBtn.addEventListener('click', () => {
      const clientId   = (document.getElementById('modal-client-id')    || {}).value;
      const sessType   = (document.getElementById('modal-session-type') || {}).value;
      const startTime  = (document.getElementById('modal-start-time')   || {}).value;
      const duration   = (document.getElementById('modal-duration')     || {}).value;
      const notes      = (document.getElementById('modal-notes')        || {}).value;
      const resId      = (document.getElementById('modal-resource-id')  || {}).value;
      if (!clientId || !sessType || !startTime) {
        alert('Please fill in client, session type and start time.');
        return;
      }
      modalConfirmBtn.disabled = true;
      jsonRpc('/studio/staff/book', {
        resource_id: resId,
        partner_id: clientId,
        session_type: sessType,
        datetime_start: startTime,
        duration,
        notes,
      }).then(res => {
        modalConfirmBtn.disabled = false;
        if (res && res.booking_id) {
          modal.style.display = 'none';
          loadAndRender();
        } else {
          alert((res && res.message) || 'Booking failed.');
        }
      });
    });
  }

  /* ── Client autocomplete in modal ────────────────────────────────────── */
  const clientSearch  = document.getElementById('modal-client-search');
  const clientResults = document.getElementById('modal-client-results');
  const clientId      = document.getElementById('modal-client-id');
  let searchTimer;

  if (clientSearch) {
    clientSearch.addEventListener('input', () => {
      clearTimeout(searchTimer);
      const q = clientSearch.value.trim();
      if (q.length < 2) { clientResults.style.display = 'none'; return; }
      searchTimer = setTimeout(() => {
        jsonRpc('/studio/staff/clients/search', { query: q }).then(data => {
          clientResults.innerHTML = '';
          if (!Array.isArray(data) || !data.length) { clientResults.style.display = 'none'; return; }
          data.forEach(p => {
            const li = document.createElement('li');
            li.textContent = p.name + (p.email ? ' — ' + p.email : '');
            li.addEventListener('click', () => {
              clientSearch.value  = p.name;
              clientId.value      = p.id;
              clientResults.style.display = 'none';
            });
            clientResults.appendChild(li);
          });
          clientResults.style.display = '';
        });
      }, 300);
    });
    document.addEventListener('click', e => {
      if (!clientSearch.contains(e.target)) clientResults.style.display = 'none';
    });
  }

  /* ── Load + render ───────────────────────────────────────────────────── */
  function loadAndRender() {
    jsonRpc('/studio/staff/calendar/bookings', { date: currentDate }).then(data => {
      buildGrid(Array.isArray(data) ? data : []);
    });
  }

  loadAndRender();

})();
