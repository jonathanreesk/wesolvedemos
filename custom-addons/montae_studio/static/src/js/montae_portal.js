/* ─── Montae Studio — Portal JS ─────────────────────────────────────────── */
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

  function getCsrfToken() {
    const m = document.cookie.match(/\bcsrf_token=([^;]+)/);
    return m ? decodeURIComponent(m[1]) : '';
  }

  /* ── Booking flow ────────────────────────────────────────────────────── */
  const resourceSelect = document.getElementById('resource-select');
  const bookingDate    = document.getElementById('booking-date');
  const slotGrid       = document.getElementById('slot-grid');
  const confirmBtn     = document.getElementById('confirm-booking');
  const sessionType    = document.getElementById('session-type');
  const durationSelect = document.getElementById('duration-select');
  const bookingResult  = document.getElementById('booking-result');

  let selectedSlot = null;

  function loadSlots() {
    if (!resourceSelect || !bookingDate || !bookingDate.value) return;
    slotGrid.innerHTML = '<p class="montae-muted">Loading…</p>';
    selectedSlot = null;
    if (confirmBtn) confirmBtn.disabled = true;
    jsonRpc('/studio/book/slots', {
      resource_id: resourceSelect.value,
      date: bookingDate.value,
    }).then(data => {
      if (!data || !data.slots) { slotGrid.innerHTML = '<p class="montae-muted">No slots available.</p>'; return; }
      slotGrid.innerHTML = '';
      data.slots.forEach(slot => {
        const btn = document.createElement('button');
        btn.className = 'montae-slot' + (slot.available ? '' : ' montae-slot--taken');
        btn.textContent = slot.time;
        btn.disabled = !slot.available;
        btn.addEventListener('click', () => {
          document.querySelectorAll('.montae-slot').forEach(b => b.classList.remove('montae-slot--selected'));
          btn.classList.add('montae-slot--selected');
          selectedSlot = slot.time;
          if (confirmBtn) confirmBtn.disabled = false;
        });
        slotGrid.appendChild(btn);
      });
    });
  }

  if (resourceSelect) resourceSelect.addEventListener('change', loadSlots);
  if (bookingDate) bookingDate.addEventListener('change', loadSlots);

  if (confirmBtn) {
    confirmBtn.addEventListener('click', () => {
      if (!selectedSlot) return;
      const dateStr = bookingDate.value;
      const datetimeStr = dateStr + 'T' + selectedSlot + ':00';
      confirmBtn.disabled = true;
      confirmBtn.textContent = 'Booking…';
      jsonRpc('/studio/book/confirm', {
        resource_id: resourceSelect.value,
        session_type: sessionType ? sessionType.value : 'Session',
        datetime_start: datetimeStr,
        duration: durationSelect ? durationSelect.value : 60,
      }).then(data => {
        confirmBtn.textContent = 'Confirm Booking';
        if (bookingResult) {
          bookingResult.style.display = '';
          if (data && data.booking_id) {
            bookingResult.innerHTML = '<p style="color:var(--clr-success)">Booking confirmed! Booking ID: ' + data.booking_id + '</p>';
          } else {
            bookingResult.innerHTML = '<p style="color:var(--clr-danger)">Error: ' + (data && data.message ? data.message : 'Please try again.') + '</p>';
            confirmBtn.disabled = false;
          }
        }
      });
    });
  }

  /* ── Subscribe buttons ───────────────────────────────────────────────── */
  document.querySelectorAll('.js-subscribe').forEach(btn => {
    btn.addEventListener('click', () => {
      const planId = btn.dataset.planId;
      jsonRpc('/studio/subscribe', { plan_id: planId }).then(data => {
        if (data && data.checkout_url) {
          window.location = data.checkout_url;
        } else {
          alert((data && data.message) || 'Subscription not yet configured.');
        }
      });
    });
  });

  /* ── Client calendar ─────────────────────────────────────────────────── */
  const calWrap = document.getElementById('montae-client-calendar');
  if (!calWrap) return;

  const calGrid     = document.getElementById('cal-grid');
  const calTitle    = document.getElementById('cal-title');
  const calPrev     = document.getElementById('cal-prev');
  const calNext     = document.getElementById('cal-next');
  const viewMonth   = document.getElementById('cal-view-month');
  const viewWeek    = document.getElementById('cal-view-week');
  const popover     = document.getElementById('cal-popover');
  const popClose    = document.getElementById('cal-popover-close');
  const popSession  = document.getElementById('pop-session');
  const popTime     = document.getElementById('pop-time');
  const popResource = document.getElementById('pop-resource');
  const popStatus   = document.getElementById('pop-status');
  const popCancel   = document.getElementById('pop-cancel');

  let bookings = [];
  let curView  = 'month';
  let curDate  = new Date();
  curDate.setDate(1);

  const DAYS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  const MONTHS = ['January','February','March','April','May','June',
                  'July','August','September','October','November','December'];

  function fmtTime(iso) {
    const d = new Date(iso);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
  function sameDay(a, b) {
    return a.getFullYear() === b.getFullYear() &&
           a.getMonth()    === b.getMonth()    &&
           a.getDate()     === b.getDate();
  }

  function bookingsOnDay(d) {
    return bookings.filter(b => b.start && sameDay(new Date(b.start), d));
  }

  function openPopover(b) {
    popSession.textContent  = b.title;
    popTime.textContent     = fmtTime(b.start) + ' – ' + fmtTime(b.end);
    popResource.textContent = b.resource;
    popStatus.textContent   = b.state.replace('_',' ');
    popStatus.className     = 'montae-badge montae-badge--' + b.state;
    if (b.state === 'confirmed') {
      popCancel.style.display = '';
      popCancel.onclick = () => {
        jsonRpc('/studio/account/cancel-booking', { booking_id: b.id }).then(res => {
          if (res && res.status === 'cancelled') {
            b.state = 'cancelled';
            renderCalendar();
            popover.style.display = 'none';
            loadBookings();
          }
        });
      };
    } else {
      popCancel.style.display = 'none';
    }
    popover.style.display = '';
    if (typeof lucide !== 'undefined') lucide.createIcons();
  }

  if (popClose) popClose.addEventListener('click', () => { popover.style.display = 'none'; });

  function renderMonth() {
    calGrid.className = 'montae-cal-grid montae-cal-grid--month';
    calTitle.textContent = MONTHS[curDate.getMonth()] + ' ' + curDate.getFullYear();
    calGrid.innerHTML = '';
    DAYS.forEach(d => {
      const el = document.createElement('div');
      el.className = 'montae-cal-dow';
      el.textContent = d;
      calGrid.appendChild(el);
    });
    const firstDay = new Date(curDate.getFullYear(), curDate.getMonth(), 1);
    const lastDay  = new Date(curDate.getFullYear(), curDate.getMonth() + 1, 0);
    const today    = new Date();
    for (let i = 0; i < firstDay.getDay(); i++) {
      const blank = document.createElement('div');
      blank.className = 'montae-cal-day montae-cal-day--other-month';
      blank.innerHTML = '<span class="montae-cal-day-num">&nbsp;</span>';
      calGrid.appendChild(blank);
    }
    for (let d = 1; d <= lastDay.getDate(); d++) {
      const dt   = new Date(curDate.getFullYear(), curDate.getMonth(), d);
      const cell = document.createElement('div');
      cell.className = 'montae-cal-day' + (sameDay(dt, today) ? ' montae-cal-day--today' : '');
      const numEl = document.createElement('span');
      numEl.className = 'montae-cal-day-num';
      numEl.textContent = d;
      cell.appendChild(numEl);
      const dayBkgs = bookingsOnDay(dt);
      dayBkgs.forEach(b => {
        const ev = document.createElement('div');
        ev.className = 'montae-cal-event montae-cal-event--' + b.state;
        ev.textContent = fmtTime(b.start) + ' ' + b.title;
        ev.addEventListener('click', e => { e.stopPropagation(); openPopover(b); });
        cell.appendChild(ev);
      });
      if (dayBkgs.length === 0) {
        cell.title = 'Book a session on ' + dt.toDateString();
        cell.addEventListener('click', () => {
          const ds = dt.toISOString().slice(0,10);
          window.location = '/studio/book?date=' + ds;
        });
      }
      calGrid.appendChild(cell);
    }
  }

  function renderWeek() {
    calGrid.className = 'montae-cal-grid montae-cal-grid--week';
    const monday = new Date(curDate);
    monday.setDate(curDate.getDate() - ((curDate.getDay() + 6) % 7));
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    calTitle.textContent = MONTHS[monday.getMonth()] + ' ' + monday.getDate() +
      ' – ' + MONTHS[sunday.getMonth()] + ' ' + sunday.getDate() + ', ' + sunday.getFullYear();
    calGrid.style.gridTemplateColumns = '50px repeat(7, 1fr)';
    calGrid.innerHTML = '';
    // Headers
    const timeHead = document.createElement('div');
    timeHead.className = 'montae-cal-week-header';
    calGrid.appendChild(timeHead);
    const today = new Date();
    for (let i = 0; i < 7; i++) {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      const h = document.createElement('div');
      h.className = 'montae-cal-week-header' + (sameDay(d, today) ? ' montae-cal-week-header--today' : '');
      h.innerHTML = '<span style="color:var(--clr-muted);font-size:.7rem">' + DAYS[d.getDay()] + '</span><br>' + d.getDate();
      calGrid.appendChild(h);
    }
    // Time rows (7am–7pm, hourly)
    for (let h = 7; h < 19; h++) {
      const timeCell = document.createElement('div');
      timeCell.className = 'montae-cal-time-cell';
      timeCell.textContent = (h < 12 ? h : h - 12) + (h < 12 ? 'am' : 'pm');
      calGrid.appendChild(timeCell);
      for (let i = 0; i < 7; i++) {
        const d = new Date(monday);
        d.setDate(monday.getDate() + i);
        const cell = document.createElement('div');
        cell.className = 'montae-cal-week-slot';
        const bkgs = bookings.filter(b => {
          if (!b.start) return false;
          const bs = new Date(b.start);
          return sameDay(bs, d) && bs.getHours() === h;
        });
        bkgs.forEach(b => {
          const ev = document.createElement('div');
          ev.className = 'montae-cal-event montae-cal-event--' + b.state;
          ev.style.cssText = 'position:absolute;left:0;right:0;top:0;font-size:.7rem;padding:.1rem .3rem;';
          ev.textContent = fmtTime(b.start) + ' ' + b.title;
          ev.addEventListener('click', e => { e.stopPropagation(); openPopover(b); });
          cell.style.position = 'relative';
          cell.appendChild(ev);
        });
        calGrid.appendChild(cell);
      }
    }
  }

  function renderCalendar() {
    if (curView === 'month') renderMonth(); else renderWeek();
    if (typeof lucide !== 'undefined') lucide.createIcons();
  }

  function loadBookings() {
    jsonRpc('/studio/account/bookings', {}).then(data => {
      if (Array.isArray(data)) { bookings = data; renderCalendar(); }
    });
  }

  if (calPrev) calPrev.addEventListener('click', () => {
    if (curView === 'month') curDate.setMonth(curDate.getMonth() - 1);
    else curDate.setDate(curDate.getDate() - 7);
    renderCalendar();
  });
  if (calNext) calNext.addEventListener('click', () => {
    if (curView === 'month') curDate.setMonth(curDate.getMonth() + 1);
    else curDate.setDate(curDate.getDate() + 7);
    renderCalendar();
  });
  if (viewMonth) viewMonth.addEventListener('click', () => {
    curView = 'month';
    curDate.setDate(1);
    viewMonth.classList.add('montae-btn--active');
    viewWeek.classList.remove('montae-btn--active');
    renderCalendar();
  });
  if (viewWeek) viewWeek.addEventListener('click', () => {
    curView = 'week';
    viewWeek.classList.add('montae-btn--active');
    viewMonth.classList.remove('montae-btn--active');
    renderCalendar();
  });

  loadBookings();

})();
