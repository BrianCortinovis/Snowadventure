// Gift Card Checkout Widget
(function() {
  'use strict';

  function loadCSS() {
    if (!document.querySelector('link[href="/css/widgets.css"]')) {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = '/css/widgets.css';
      document.head.appendChild(link);
    }
  }

  window.GCPurchase = function(experienceSlug, amountCents, label) {
    loadCSS();

    const overlay = document.createElement('div');
    overlay.className = 'bw-overlay';
    overlay.id = 'gc-overlay';

    overlay.innerHTML = `
      <div class="bw-modal">
        <button class="bw-close" onclick="GCClose()">&times;</button>
        <div id="gc-content">
          <div class="bw-title">Acquista Gift Card</div>
          <div class="bw-sub">${label} — ${(amountCents / 100).toFixed(0)}€</div>
          <div class="bw-step active">
            <p class="bw-label">I tuoi dati</p>
            <div class="bw-row">
              <div><p class="bw-label">Nome *</p><input class="bw-input" id="gc-nome" required></div>
              <div><p class="bw-label">Cognome *</p><input class="bw-input" id="gc-cognome" required></div>
            </div>
            <p class="bw-label">Email *</p>
            <input class="bw-input" id="gc-email" type="email" required>
            <p class="bw-label" style="margin-top:16px">Destinatario (opzionale)</p>
            <div class="bw-row">
              <div><p class="bw-label">Nome</p><input class="bw-input" id="gc-rname"></div>
              <div><p class="bw-label">Email</p><input class="bw-input" id="gc-remail" type="email"></div>
            </div>
            <p class="bw-label">Messaggio personale</p>
            <textarea class="bw-input" id="gc-message" rows="2" placeholder="Buon compleanno!..."></textarea>
            <p class="bw-label">Metodo di Pagamento</p>
            <div class="bw-pay-methods">
              <div class="bw-pay-method" onclick="GCSelectPay('stripe', this)"><div class="pay-icon">💳</div>Carta</div>
              <div class="bw-pay-method" onclick="GCSelectPay('paypal', this)"><div class="pay-icon">🅿️</div>PayPal</div>
              <div class="bw-pay-method" onclick="GCSelectPay('satispay', this)"><div class="pay-icon">📱</div>Satispay</div>
            </div>
            <div class="bw-checkbox">
              <input type="checkbox" id="gc-privacy" required>
              <label for="gc-privacy">Acconsento al trattamento dei dati personali. <a href="/legal/privacy.html" target="_blank">Privacy</a> *</label>
            </div>
            <div id="gc-error"></div>
            <button class="bw-btn" id="gc-submit" disabled onclick="GCSubmit('${experienceSlug}', ${amountCents})">Acquista ${(amountCents / 100).toFixed(0)}€</button>
          </div>
        </div>
      </div>
    `;

    overlay.addEventListener('click', (e) => { if (e.target === overlay) GCClose(); });
    document.body.appendChild(overlay);
    setTimeout(() => overlay.classList.add('open'), 10);
  };

  let gcPayMethod = null;

  window.GCSelectPay = function(method, el) {
    gcPayMethod = method;
    document.querySelectorAll('#gc-overlay .bw-pay-method').forEach(e => e.classList.remove('selected'));
    el.classList.add('selected');
    document.getElementById('gc-submit').disabled = false;
  };

  window.GCSubmit = async function(experienceSlug, amountCents) {
    const nome = document.getElementById('gc-nome').value.trim();
    const cognome = document.getElementById('gc-cognome').value.trim();
    const email = document.getElementById('gc-email').value.trim();
    const privacy = document.getElementById('gc-privacy').checked;
    const errEl = document.getElementById('gc-error');
    const btn = document.getElementById('gc-submit');

    if (!nome || !cognome || !email) {
      errEl.innerHTML = '<p class="bw-error">Compila tutti i campi obbligatori</p>'; return;
    }
    if (!privacy) {
      errEl.innerHTML = '<p class="bw-error">Il consenso al trattamento dati è obbligatorio</p>'; return;
    }
    if (!gcPayMethod) {
      errEl.innerHTML = '<p class="bw-error">Seleziona un metodo di pagamento</p>'; return;
    }

    btn.disabled = true;
    btn.textContent = 'Elaborazione...';

    try {
      const res = await fetch('/api/giftcards/purchase', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          experienceSlug,
          amountCents,
          purchaserNome: nome,
          purchaserCognome: cognome,
          purchaserEmail: email,
          recipientName: document.getElementById('gc-rname').value.trim() || null,
          recipientEmail: document.getElementById('gc-remail').value.trim() || null,
          personalMessage: document.getElementById('gc-message').value.trim() || null,
          paymentMethod: gcPayMethod,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        errEl.innerHTML = `<p class="bw-error">${data.error}</p>`;
        btn.disabled = false; btn.textContent = 'Riprova'; return;
      }

      // Create payment session using the gift card code as booking ref concept
      // For gift cards we redirect to payment directly
      const payRes = await fetch('/api/payments/create-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bookingRef: `GC:${data.code}`, method: gcPayMethod }),
      });

      if (payRes.ok) {
        const payData = await payRes.json();
        window.location.href = payData.redirectUrl;
      } else {
        // Show success with code (payment can be handled manually)
        document.getElementById('gc-content').innerHTML = `
          <div class="bw-success">
            <h3>Gift Card Creata!</h3>
            <p>Il codice della tua Gift Card è:</p>
            <div class="ref">${data.code}</div>
            <p>Valida fino al ${new Date(data.expiresAt).toLocaleDateString('it-IT')}</p>
            <p style="margin-top:12px;color:#888;font-size:13px">Nota: configura i metodi di pagamento per abilitare il checkout automatico.</p>
            <button class="bw-btn" style="margin-top:24px;max-width:200px;margin-inline:auto;display:block" onclick="GCClose()">Chiudi</button>
          </div>
        `;
      }
    } catch (err) {
      errEl.innerHTML = '<p class="bw-error">Errore di connessione. Riprova.</p>';
      btn.disabled = false; btn.textContent = 'Riprova';
    }
  };

  window.GCClose = function() {
    const ov = document.getElementById('gc-overlay');
    if (ov) { ov.classList.remove('open'); setTimeout(() => ov.remove(), 300); }
    gcPayMethod = null;
  };

  // Attach to existing "Acquista" buttons on gift-card page
  document.addEventListener('DOMContentLoaded', () => {
    if (!window.location.pathname.includes('gift-card')) return;
    const buttons = document.querySelectorAll('.btn-primary, .gc-buy-btn');
    buttons.forEach(btn => {
      const text = btn.closest('.gc-option, .option, [class*="option"]');
      if (!text) return;
      const priceEl = text.querySelector('[class*="price"], .price-big, .option-price');
      if (!priceEl) return;
      const priceText = priceEl.textContent;
      const match = priceText.match(/(\d+)/);
      if (!match) return;
      const price = parseInt(match[1]) * 100;
      const nameEl = text.querySelector('h3, h2, [class*="title"], [class*="name"]');
      const name = nameEl ? nameEl.textContent.trim() : 'Gift Card';
      const slug = name.toLowerCase().includes('sunset') ? 'sunset' : name.toLowerCase().includes('night') ? 'night' : null;

      btn.addEventListener('click', (e) => {
        e.preventDefault();
        GCPurchase(slug, price, name);
      });
    });
  });
})();
