// GDPR Cookie Consent Banner
(function() {
  'use strict';

  if (localStorage.getItem('sa_cookie_consent')) return;

  document.addEventListener('DOMContentLoaded', () => {
    if (!document.querySelector('link[href="/css/widgets.css"]')) {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = '/css/widgets.css';
      document.head.appendChild(link);
    }

    const banner = document.createElement('div');
    banner.className = 'cc-banner';
    banner.innerHTML = `
      <div>
        Questo sito utilizza cookie tecnici necessari al funzionamento. Continuando la navigazione accetti l'utilizzo dei cookie.
        <a href="/legal/cookies.html">Informativa Cookie</a> | <a href="/legal/privacy.html">Privacy Policy</a>
      </div>
      <div class="cc-buttons">
        <button class="cc-btn cc-btn-reject" onclick="ccReject()">Rifiuta</button>
        <button class="cc-btn cc-btn-accept" onclick="ccAccept()">Accetta</button>
      </div>
    `;
    document.body.appendChild(banner);
  });

  window.ccAccept = function() {
    localStorage.setItem('sa_cookie_consent', 'accepted');
    document.querySelector('.cc-banner')?.remove();
  };

  window.ccReject = function() {
    localStorage.setItem('sa_cookie_consent', 'rejected');
    document.querySelector('.cc-banner')?.remove();
  };
})();
