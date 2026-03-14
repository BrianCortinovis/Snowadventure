// Booking Widget - Snow Adventure
(function() {
  'use strict';

  const MONTHS_IT = ['Gennaio','Febbraio','Marzo','Aprile','Maggio','Giugno','Luglio','Agosto','Settembre','Ottobre','Novembre','Dicembre'];
  const DAYS_IT = ['Lun','Mar','Mer','Gio','Ven','Sab','Dom'];

  let state = {
    experience: null,
    step: 1,
    month: new Date(),
    slots: [],
    selectedDate: null,
    selectedSlot: null,
    paymentMethod: null,
    giftCardValid: null,
    giftCardDiscount: 0,
  };

  // Detect experience from page
  function detectExperience() {
    const path = window.location.pathname;
    if (path.includes('sunset')) return 'sunset';
    if (path.includes('night')) return 'night';
    if (path.includes('freeride')) return 'freeride';
    return null;
  }

  // Load CSS
  function loadCSS() {
    if (!document.querySelector('link[href="/css/widgets.css"]')) {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = '/css/widgets.css';
      document.head.appendChild(link);
    }
  }

  // Create modal HTML
  function createModal() {
    const overlay = document.createElement('div');
    overlay.className = 'bw-overlay';
    overlay.id = 'bw-overlay';
    overlay.innerHTML = `
      <div class="bw-modal">
        <button class="bw-close" onclick="window.BWClose()">&times;</button>
        <div id="bw-content"></div>
      </div>
    `;
    overlay.addEventListener('click', (e) => { if (e.target === overlay) window.BWClose(); });
    document.body.appendChild(overlay);
  }

  window.BWClose = function() {
    const ov = document.getElementById('bw-overlay');
    if (ov) { ov.classList.remove('open'); setTimeout(() => ov.remove(), 300); }
    state = { ...state, step: 1, selectedDate: null, selectedSlot: null, paymentMethod: null, giftCardValid: null, giftCardDiscount: 0 };
  };

  window.BWOpen = function(experience) {
    state.experience = experience || detectExperience();
    state.step = state.experience ? 1 : 0;
    state.month = new Date();
    state.selectedDate = null;
    state.selectedSlot = null;
    state.paymentMethod = null;
    state.giftCardValid = null;
    state.giftCardDiscount = 0;
    loadCSS();
    createModal();
    if (state.experience) {
      loadSlots().then(() => {
        renderStep();
        setTimeout(() => document.getElementById('bw-overlay').classList.add('open'), 10);
      });
    } else {
      renderStep();
      setTimeout(() => document.getElementById('bw-overlay').classList.add('open'), 10);
    }
  };

  // STEP 0: Experience selector (when opened from pages without a specific experience)
  window.BWSelectExp = function(exp) {
    state.experience = exp;
    state.step = 1;
    state.month = new Date();
    loadSlots().then(() => renderStep());
  };

  async function loadSlots() {
    const month = `${state.month.getFullYear()}-${String(state.month.getMonth() + 1).padStart(2, '0')}`;
    const res = await fetch(`/api/availability?experience=${state.experience}&month=${month}`);
    state.slots = await res.json();
  }

  function renderStep() {
    const content = document.getElementById('bw-content');
    if (state.step === 0) renderExpSelector(content);
    else if (state.step === 1) renderCalendarStep(content);
    else if (state.step === 2) renderFormStep(content);
    else if (state.step === 3) renderPaymentStep(content);
  }

  function renderExpSelector(el) {
    el.innerHTML = `
      <div class="bw-title">Prenota un'esperienza</div>
      <div class="bw-sub">Scegli l'escursione che preferisci</div>
      <div class="bw-step active" style="display:flex;flex-direction:column;gap:12px;margin-top:16px">
        <div class="bw-exp-card" onclick="BWSelectExp('sunset')" style="padding:20px;background:rgba(255,255,255,.05);cursor:pointer;transition:background .3s">
          <div style="font-size:16px;font-weight:600;margin-bottom:4px">Orobic Sunset Tour</div>
          <div style="font-size:13px;color:#aaa">1.5 ore — Aperitivo in quota al tramonto</div>
          <div style="font-size:20px;font-weight:700;color:#c8e635;margin-top:8px">150€</div>
        </div>
        <div class="bw-exp-card" onclick="BWSelectExp('night')" style="padding:20px;background:rgba(255,255,255,.05);cursor:pointer;transition:background .3s">
          <div style="font-size:16px;font-weight:600;margin-bottom:4px">Night Tour Adventure</div>
          <div style="font-size:13px;color:#aaa">3 ore — Escursione notturna + cena in rifugio</div>
          <div style="font-size:20px;font-weight:700;color:#c8e635;margin-top:8px">170€</div>
        </div>
        <div class="bw-exp-card" onclick="BWSelectExp('freeride')" style="padding:20px;background:rgba(255,255,255,.05);cursor:pointer;transition:background .3s">
          <div style="font-size:16px;font-weight:600;margin-bottom:4px">Private Freeride Ski Shuttle</div>
          <div style="font-size:13px;color:#aaa">1.5 ore — Shuttle privato per freeride</div>
          <div style="font-size:20px;font-weight:700;color:#c8e635;margin-top:8px">Su richiesta</div>
        </div>
      </div>
    `;
  }

  // STEP 1: Calendar
  function renderCalendarStep(el) {
    const year = state.month.getFullYear();
    const mon = state.month.getMonth();
    const firstDay = new Date(year, mon, 1).getDay();
    const daysInMonth = new Date(year, mon + 1, 0).getDate();
    const startDay = firstDay === 0 ? 6 : firstDay - 1;
    const today = new Date().toISOString().slice(0, 10);

    // Available dates
    const availDates = {};
    state.slots.forEach(s => {
      if (s.availableSleds > 0) availDates[s.date] = true;
    });

    let calHTML = DAYS_IT.map(d => `<div class="day-name">${d}</div>`).join('');
    for (let i = 0; i < startDay; i++) calHTML += '<div class="day empty"></div>';
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${year}-${String(mon + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const isAvail = availDates[dateStr];
      const isPast = dateStr < today;
      const isSelected = dateStr === state.selectedDate;
      let cls = 'day';
      if (isPast || !isAvail) cls += ' disabled';
      else cls += ' available';
      if (isSelected) cls += ' selected';
      calHTML += `<div class="${cls}" data-date="${dateStr}" onclick="BWSelectDate('${dateStr}')">${d}</div>`;
    }

    // Times for selected date
    let timesHTML = '';
    if (state.selectedDate) {
      const daySlots = state.slots.filter(s => s.date === state.selectedDate);
      timesHTML = '<p class="bw-label">Orario</p><div class="bw-times">' +
        daySlots.map(s => {
          const isFull = s.availableSleds <= 0;
          const isSelected = state.selectedSlot && state.selectedSlot.id === s.id;
          return `<div class="bw-time${isFull ? ' full' : ''}${isSelected ? ' selected' : ''}" onclick="${isFull ? '' : `BWSelectSlot('${s.id}')`}">${s.time} (${s.availableSleds} disp.)</div>`;
        }).join('') + '</div>';
    }

    const expNames = { sunset: 'Orobic Sunset Tour', night: 'Night Tour Adventure', freeride: 'Private Freeride Ski Shuttle' };

    el.innerHTML = `
      <div class="bw-title">Prenota ${expNames[state.experience] || ''}</div>
      <div class="bw-sub">Scegli data e orario</div>
      <div class="bw-step active">
        <div class="bw-cal">
          <div class="bw-cal-header">
            <button onclick="BWPrevMonth()">&#8249;</button>
            <span>${MONTHS_IT[mon]} ${year}</span>
            <button onclick="BWNextMonth()">&#8250;</button>
          </div>
          <div class="bw-cal-grid">${calHTML}</div>
        </div>
        ${timesHTML}
        <button class="bw-btn" ${!state.selectedSlot ? 'disabled' : ''} onclick="BWStep(2)">Continua</button>
      </div>
    `;
  }

  window.BWSelectDate = function(date) {
    if (date < new Date().toISOString().slice(0, 10)) return;
    state.selectedDate = date;
    state.selectedSlot = null;
    renderStep();
  };

  window.BWSelectSlot = function(slotId) {
    state.selectedSlot = state.slots.find(s => s.id === slotId);
    renderStep();
  };

  window.BWPrevMonth = async function() {
    state.month.setMonth(state.month.getMonth() - 1);
    state.selectedDate = null;
    state.selectedSlot = null;
    await loadSlots();
    renderStep();
  };

  window.BWNextMonth = async function() {
    state.month.setMonth(state.month.getMonth() + 1);
    state.selectedDate = null;
    state.selectedSlot = null;
    await loadSlots();
    renderStep();
  };

  window.BWStep = function(step) {
    state.step = step;
    renderStep();
  };

  // STEP 2: Form
  function renderFormStep(el) {
    el.innerHTML = `
      <div class="bw-title">I tuoi dati</div>
      <div class="bw-sub">${state.selectedDate} ore ${state.selectedSlot.time} — ${state.selectedSlot.availableSleds} motoslitte disponibili</div>
      <div class="bw-step active">
        <button class="bw-btn bw-btn-back" onclick="BWStep(1)">← Indietro</button>
        <div class="bw-row">
          <div><p class="bw-label">Nome *</p><input class="bw-input" id="bw-nome" required></div>
          <div><p class="bw-label">Cognome *</p><input class="bw-input" id="bw-cognome" required></div>
        </div>
        <p class="bw-label">Email *</p>
        <input class="bw-input" id="bw-email" type="email" required>
        <p class="bw-label">Telefono</p>
        <input class="bw-input" id="bw-phone" type="tel">
        <div class="bw-row">
          <div>
            <p class="bw-label">Motoslitte *</p>
            <select class="bw-input" id="bw-sleds" onchange="BWUpdatePeople()">
              ${Array.from({length: Math.min(state.selectedSlot.availableSleds, 10)}, (_, i) =>
                `<option value="${i + 1}">${i + 1}</option>`
              ).join('')}
            </select>
          </div>
          <div>
            <p class="bw-label">Persone totali *</p>
            <select class="bw-input" id="bw-people">
              <option value="1">1</option>
              <option value="2" selected>2</option>
            </select>
          </div>
        </div>
        <p class="bw-label">Hai un codice sconto o gift card?</p>
        <div class="bw-gift-row">
          <input class="bw-input" id="bw-code" placeholder="Inserisci codice" style="margin-bottom:0">
          <button onclick="BWValidateCode()">Verifica</button>
        </div>
        <div id="bw-code-msg"></div>
        <p class="bw-label">Note</p>
        <textarea class="bw-input" id="bw-notes" rows="2" placeholder="Richieste particolari..."></textarea>
        <div class="bw-checkbox">
          <input type="checkbox" id="bw-privacy" required>
          <label for="bw-privacy">Acconsento al trattamento dei dati personali ai sensi del GDPR (Art. 13 Reg. UE 2016/679). <a href="/legal/privacy.html" target="_blank">Informativa Privacy</a> *</label>
        </div>
        <div class="bw-checkbox">
          <input type="checkbox" id="bw-marketing">
          <label for="bw-marketing">Acconsento a ricevere comunicazioni commerciali da Snow Adventure</label>
        </div>
        <div id="bw-form-error"></div>
        <button class="bw-btn" onclick="BWStep(3)">Continua al Pagamento</button>
      </div>
    `;
  }

  window.BWUpdatePeople = function() {
    const sleds = parseInt(document.getElementById('bw-sleds').value);
    const sel = document.getElementById('bw-people');
    sel.innerHTML = '';
    for (let i = 1; i <= sleds * 2; i++) {
      const opt = document.createElement('option');
      opt.value = i; opt.textContent = i;
      if (i === sleds * 2) opt.selected = true;
      sel.appendChild(opt);
    }
  };

  window.BWValidateCode = async function() {
    const code = document.getElementById('bw-code').value.trim();
    if (!code) return;
    const msgEl = document.getElementById('bw-code-msg');

    // Try gift card first
    let res = await fetch(`/api/giftcards/validate?code=${encodeURIComponent(code)}`);
    if (res.ok) {
      const gc = await res.json();
      state.giftCardValid = gc;
      state.giftCardDiscount = gc.amountCents;
      msgEl.innerHTML = `<p class="bw-gift-msg ok">✓ Gift Card valida: ${(gc.amountCents / 100).toFixed(0)}€</p>`;
      return;
    }
    state.giftCardValid = null;
    state.giftCardDiscount = 0;
    msgEl.innerHTML = `<p class="bw-gift-msg err">✗ Codice non valido o scaduto</p>`;
  };

  // STEP 3: Payment
  function renderPaymentStep(el) {
    const nome = document.getElementById('bw-nome')?.value || '';
    const cognome = document.getElementById('bw-cognome')?.value || '';
    const email = document.getElementById('bw-email')?.value || '';
    const phone = document.getElementById('bw-phone')?.value || '';
    const sleds = parseInt(document.getElementById('bw-sleds')?.value || '1');
    const people = parseInt(document.getElementById('bw-people')?.value || '2');
    const notes = document.getElementById('bw-notes')?.value || '';
    const privacy = document.getElementById('bw-privacy')?.checked;
    const marketing = document.getElementById('bw-marketing')?.checked;
    const code = document.getElementById('bw-code')?.value?.trim() || '';

    // Store in state for submission
    state.formData = { nome, cognome, email, phone, sleds, people, notes, privacy, marketing, code };

    // Validation
    if (!nome || !cognome || !email) {
      state.step = 2;
      renderStep();
      setTimeout(() => {
        const errEl = document.getElementById('bw-form-error');
        if (errEl) errEl.innerHTML = '<p class="bw-error">Compila tutti i campi obbligatori</p>';
      }, 50);
      return;
    }
    if (!privacy) {
      state.step = 2;
      renderStep();
      setTimeout(() => {
        const errEl = document.getElementById('bw-form-error');
        if (errEl) errEl.innerHTML = '<p class="bw-error">Il consenso al trattamento dati è obbligatorio</p>';
      }, 50);
      return;
    }

    // Calculate prices (we'll get final from server, but show estimate)
    const prices = { sunset: 15000, night: 17000, freeride: 0 };
    const unitPrice = prices[state.experience] || 0;
    const total = unitPrice * sleds;
    const discount = Math.min(state.giftCardDiscount, total);
    const toPay = total - discount;

    el.innerHTML = `
      <div class="bw-title">Riepilogo e Pagamento</div>
      <div class="bw-step active">
        <button class="bw-btn bw-btn-back" onclick="BWStep(2)">← Indietro</button>
        <div class="bw-summary">
          <div class="bw-summary-row"><span class="lbl">Data</span><span class="val">${state.selectedDate} ore ${state.selectedSlot.time}</span></div>
          <div class="bw-summary-row"><span class="lbl">Esperienza</span><span class="val">${state.experience === 'sunset' ? 'Orobic Sunset Tour' : state.experience === 'night' ? 'Night Tour Adventure' : 'Freeride'}</span></div>
          <div class="bw-summary-row"><span class="lbl">Motoslitte</span><span class="val">${sleds}</span></div>
          <div class="bw-summary-row"><span class="lbl">Persone</span><span class="val">${people}</span></div>
          <div class="bw-summary-row"><span class="lbl">Prezzo</span><span class="val">${(total / 100).toFixed(0)}€</span></div>
          ${discount > 0 ? `<div class="bw-summary-row"><span class="lbl">Sconto</span><span class="val" style="color:#27ae60">-${(discount / 100).toFixed(0)}€</span></div>` : ''}
          <div class="bw-summary-row total"><span class="lbl">Totale</span><span class="val">${(toPay / 100).toFixed(0)}€</span></div>
        </div>
        ${toPay > 0 ? `
          <p class="bw-label">Metodo di Pagamento</p>
          <div class="bw-pay-methods">
            <div class="bw-pay-method${state.paymentMethod === 'stripe' ? ' selected' : ''}" onclick="BWSelectPay('stripe')">
              <div class="pay-icon">💳</div>Carta di Credito
            </div>
            <div class="bw-pay-method${state.paymentMethod === 'paypal' ? ' selected' : ''}" onclick="BWSelectPay('paypal')">
              <div class="pay-icon">🅿️</div>PayPal
            </div>
            <div class="bw-pay-method${state.paymentMethod === 'satispay' ? ' selected' : ''}" onclick="BWSelectPay('satispay')">
              <div class="pay-icon">📱</div>Satispay
            </div>
          </div>
        ` : '<p style="color:#27ae60;margin-bottom:16px;font-size:14px">✓ Coperto interamente dalla Gift Card!</p>'}
        <div id="bw-pay-error"></div>
        <button class="bw-btn" id="bw-submit" ${toPay > 0 && !state.paymentMethod ? 'disabled' : ''} onclick="BWSubmit()">
          ${toPay > 0 ? 'Procedi al Pagamento' : 'Conferma Prenotazione'}
        </button>
      </div>
    `;
  }

  window.BWSelectPay = function(method) {
    state.paymentMethod = method;
    document.querySelectorAll('.bw-pay-method').forEach(el => el.classList.remove('selected'));
    document.querySelector(`.bw-pay-method[onclick="BWSelectPay('${method}')"]`).classList.add('selected');
    document.getElementById('bw-submit').disabled = false;
  };

  window.BWSubmit = async function() {
    const btn = document.getElementById('bw-submit');
    btn.disabled = true;
    btn.textContent = 'Elaborazione...';
    const errEl = document.getElementById('bw-pay-error');

    const fd = state.formData;
    const isGiftCard = state.giftCardValid && fd.code.startsWith('SA-GC');

    try {
      // Create booking
      const bookRes = await fetch('/api/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slotId: state.selectedSlot.id,
          experience: state.experience,
          date: state.selectedDate,
          time: state.selectedSlot.time,
          nome: fd.nome,
          cognome: fd.cognome,
          email: fd.email,
          phone: fd.phone,
          numSleds: fd.sleds,
          numPeople: fd.people,
          giftCardCode: isGiftCard ? fd.code : null,
          voucherCode: !isGiftCard && fd.code ? fd.code : null,
          paymentMethod: state.paymentMethod,
          privacyConsent: fd.privacy,
          marketingConsent: fd.marketing,
          notes: fd.notes,
        }),
      });

      const bookData = await bookRes.json();
      if (!bookRes.ok) {
        errEl.innerHTML = `<p class="bw-error">${bookData.error}</p>`;
        btn.disabled = false;
        btn.textContent = 'Riprova';
        return;
      }

      // If no payment needed
      if (!bookData.paymentRequired) {
        showSuccess(bookData.bookingRef);
        return;
      }

      // Create payment session
      const payRes = await fetch('/api/payments/create-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bookingRef: bookData.bookingRef, method: state.paymentMethod }),
      });

      const payData = await payRes.json();
      if (!payRes.ok) {
        errEl.innerHTML = `<p class="bw-error">${payData.error}</p>`;
        btn.disabled = false;
        btn.textContent = 'Riprova';
        return;
      }

      // Redirect to payment
      window.location.href = payData.redirectUrl;

    } catch (err) {
      errEl.innerHTML = '<p class="bw-error">Errore di connessione. Riprova.</p>';
      btn.disabled = false;
      btn.textContent = 'Riprova';
    }
  };

  function showSuccess(ref) {
    const content = document.getElementById('bw-content');
    content.innerHTML = `
      <div class="bw-success">
        <h3>Prenotazione Confermata!</h3>
        <p>Il tuo riferimento è:</p>
        <div class="ref">${ref}</div>
        <p>Riceverai una email di conferma a breve.</p>
        <p style="margin-top:16px;font-size:12px;color:#666">Punto di ritrovo: Baita Belfud, SP2, 24010 Foppolo BG<br>Arrivare 30 minuti prima della partenza.</p>
        <button class="bw-btn" style="margin-top:24px;max-width:200px;margin-inline:auto;display:block" onclick="BWClose()">Chiudi</button>
      </div>
    `;
  }

})();
