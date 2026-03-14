// Contact Form Handler - replaces mailto with API
(function() {
  'use strict';

  document.addEventListener('DOMContentLoaded', () => {
    if (!window.location.pathname.includes('contatti')) return;

    const form = document.querySelector('form');
    if (!form) return;

    // Add privacy checkbox if not present
    if (!form.querySelector('#contact-privacy')) {
      const submitBtn = form.querySelector('button[type="submit"], input[type="submit"], .btn-primary');
      if (submitBtn) {
        const privacyDiv = document.createElement('div');
        privacyDiv.style.cssText = 'display:flex;align-items:flex-start;gap:8px;margin:16px 0;font-size:12px;color:#aaa';
        privacyDiv.innerHTML = `
          <input type="checkbox" id="contact-privacy" required style="margin-top:2px;accent-color:#c8e635">
          <label for="contact-privacy">Acconsento al trattamento dei dati personali ai sensi del GDPR. <a href="/legal/privacy.html" style="color:#c8e635" target="_blank">Privacy Policy</a> *</label>
        `;
        submitBtn.parentNode.insertBefore(privacyDiv, submitBtn);
      }
    }

    form.addEventListener('submit', async (e) => {
      e.preventDefault();

      const nome = form.querySelector('[name="nome"], #nome, input[placeholder*="Nome"]');
      const cognome = form.querySelector('[name="cognome"], #cognome, input[placeholder*="Cognome"]');
      const email = form.querySelector('[name="email"], #email, input[type="email"]');
      const phone = form.querySelector('[name="phone"], #phone, input[type="tel"]');
      const message = form.querySelector('[name="message"], #message, textarea');
      const privacy = document.getElementById('contact-privacy');

      if (!privacy || !privacy.checked) {
        alert('Il consenso al trattamento dati è obbligatorio');
        return;
      }

      const btn = form.querySelector('button[type="submit"], input[type="submit"], .btn-primary');
      const origText = btn.textContent;
      btn.textContent = 'Invio...';
      btn.disabled = true;

      try {
        const res = await fetch('/api/contact', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            nome: nome?.value || '',
            cognome: cognome?.value || '',
            email: email?.value || '',
            phone: phone?.value || '',
            message: message?.value || '',
            privacyConsent: true,
          }),
        });

        if (res.ok) {
          form.innerHTML = `
            <div style="text-align:center;padding:32px 0">
              <h3 style="color:#c8e635;margin-bottom:12px">Messaggio Inviato!</h3>
              <p style="color:#ccc">Ti risponderemo il prima possibile.</p>
            </div>
          `;
        } else {
          const data = await res.json();
          alert(data.error || 'Errore nell\'invio del messaggio');
          btn.textContent = origText;
          btn.disabled = false;
        }
      } catch (err) {
        alert('Errore di connessione. Riprova.');
        btn.textContent = origText;
        btn.disabled = false;
      }
    });
  });
})();
