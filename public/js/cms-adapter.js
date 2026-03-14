// CMS Adapter - Bridges Snowadventure frontend to CMS_Alp API
// Include this script BEFORE booking-widget.js, giftcard-checkout.js, etc.
(function() {
  'use strict';

  // =====================================================================
  // CONFIGURATION — update these after deployment
  // =====================================================================
  const CMS_BASE_URL = 'https://cms-alp.vercel.app/api/v1/snowadventure';
  const CMS_API_KEY = 'd7a8f3fe-9e3f-4d4f-b61b-426fa9795c1b';

  // Experience slug → CMS service_id mapping (populated at runtime)
  let serviceMap = {};

  // =====================================================================
  // CMS API helpers
  // =====================================================================
  async function cmsGet(path) {
    const res = await fetch(`${CMS_BASE_URL}${path}`, {
      headers: { 'Authorization': `Bearer ${CMS_API_KEY}` },
    });
    if (!res.ok) throw new Error(`CMS API error: ${res.status}`);
    const json = await res.json();
    return json.data;
  }

  async function cmsPost(path, body) {
    const res = await fetch(`${CMS_BASE_URL}${path}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${CMS_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error?.message || `CMS API error: ${res.status}`);
    return json.data;
  }

  // =====================================================================
  // Load services at startup and build slug→id map
  // =====================================================================
  async function loadServiceMap() {
    try {
      const services = await cmsGet('/booking');
      for (const svc of services) {
        const name = svc.name.toLowerCase();
        if (name.includes('sunset')) serviceMap['sunset'] = svc;
        else if (name.includes('night')) serviceMap['night'] = svc;
        else if (name.includes('freeride')) serviceMap['freeride'] = svc;
      }
    } catch (e) {
      console.warn('CMS: Failed to load services', e);
    }
  }

  // =====================================================================
  // Override native fetch to intercept API calls
  // =====================================================================
  const originalFetch = window.fetch;

  window.fetch = async function(url, options = {}) {
    const urlStr = typeof url === 'string' ? url : url.toString();

    // Only intercept /api/* calls (not external URLs)
    if (!urlStr.startsWith('/api/')) {
      return originalFetch.call(this, url, options);
    }

    try {
      // ---------------------------------------------------------------
      // GET /api/availability?experience=X&month=YYYY-MM
      // ---------------------------------------------------------------
      if (urlStr.startsWith('/api/availability')) {
        const params = new URLSearchParams(urlStr.split('?')[1]);
        const expSlug = params.get('experience');
        const month = params.get('month');

        if (!serviceMap[expSlug]) await loadServiceMap();
        const svc = serviceMap[expSlug];
        if (!svc) return mockResponse([]);

        // Get all dates in the month
        const [year, mon] = month.split('-').map(Number);
        const daysInMonth = new Date(year, mon, 0).getDate();
        const allSlots = [];

        for (let d = 1; d <= daysInMonth; d++) {
          const dateStr = `${year}-${String(mon).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
          try {
            const daySlots = await cmsGet(`/booking/availability?service_id=${svc.id}&date=${dateStr}`);
            for (const slot of daySlots) {
              if (!slot.is_blocked) {
                allSlots.push({
                  id: slot.slot_id,
                  date: slot.date,
                  time: slot.start_time.substring(0, 5),
                  availableSleds: slot.available_count,
                  maxSleds: slot.max_bookings,
                });
              }
            }
          } catch { /* no slots for this date */ }
        }

        return mockResponse(allSlots);
      }

      // ---------------------------------------------------------------
      // GET /api/experiences
      // ---------------------------------------------------------------
      if (urlStr === '/api/experiences') {
        if (Object.keys(serviceMap).length === 0) await loadServiceMap();
        const exps = Object.entries(serviceMap).map(([slug, svc]) => ({
          id: svc.id,
          slug,
          name: svc.name,
          duration: `${svc.duration_minutes} min`,
          priceCents: svc.price ? Math.round(svc.price * 100) : 0,
          maxSleds: svc.max_capacity,
          description: svc.description,
          isActive: svc.is_active,
        }));
        return mockResponse(exps);
      }

      // ---------------------------------------------------------------
      // POST /api/bookings
      // ---------------------------------------------------------------
      if (urlStr === '/api/bookings' && options.method === 'POST') {
        const body = JSON.parse(options.body);
        const expSlug = body.experience;

        if (!serviceMap[expSlug]) await loadServiceMap();
        const svc = serviceMap[expSlug];
        if (!svc) return mockErrorResponse('Servizio non trovato');

        const booking = await cmsPost('/booking/create', {
          service_id: svc.id,
          booking_date: body.date,
          booking_time: body.time,
          customer_name: `${body.nome} ${body.cognome}`.trim(),
          customer_email: body.email,
          customer_phone: body.phone || '',
          guests: body.numPeople || 2,
          num_sleds: body.numSleds || 1,
          num_people: body.numPeople || 2,
          voucher_code: body.voucherCode || undefined,
          gift_card_code: body.giftCardCode || undefined,
          payment_method: body.paymentMethod || undefined,
          amount_cents: svc.price ? Math.round(svc.price * 100) * (body.numSleds || 1) : 0,
          privacy_consent: body.privacyConsent || false,
          marketing_consent: body.marketingConsent || false,
          notes: body.notes || '',
        });

        const needsPayment = svc.requires_payment && svc.price > 0 && !body.giftCardCode;

        return mockResponse({
          bookingRef: booking.booking_ref || booking.id.substring(0, 8).toUpperCase(),
          paymentRequired: needsPayment,
        });
      }

      // ---------------------------------------------------------------
      // GET /api/giftcards/validate?code=XXX
      // ---------------------------------------------------------------
      if (urlStr.startsWith('/api/giftcards/validate')) {
        const params = new URLSearchParams(urlStr.split('?')[1]);
        const code = params.get('code');

        const result = await cmsPost('/gift-cards/validate', { code });
        if (result.valid) {
          return mockResponse({ amountCents: Math.round(result.amount * 100) });
        }
        return mockErrorResponse(result.reason || 'Codice non valido', 400);
      }

      // ---------------------------------------------------------------
      // POST /api/giftcards/purchase
      // ---------------------------------------------------------------
      if (urlStr === '/api/giftcards/purchase' && options.method === 'POST') {
        const body = JSON.parse(options.body);

        // Find the gift card ID from CMS
        const giftCards = await cmsGet('/gift-cards');
        const gc = giftCards.find(g =>
          (body.experienceSlug === 'sunset' && g.name.toLowerCase().includes('sunset')) ||
          (body.experienceSlug === 'night' && g.name.toLowerCase().includes('night'))
        );

        if (!gc) return mockErrorResponse('Gift card non trovata');

        const purchase = await cmsPost('/gift-cards/purchase', {
          gift_card_id: gc.id,
          buyer_name: `${body.purchaserNome} ${body.purchaserCognome}`,
          buyer_email: body.purchaserEmail,
          recipient_name: body.recipientName || '',
          recipient_email: body.recipientEmail || '',
          amount: body.amountCents / 100,
          message: body.personalMessage || '',
        });

        return mockResponse({
          code: purchase.code,
          expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
        });
      }

      // ---------------------------------------------------------------
      // POST /api/payments/create-session
      // ---------------------------------------------------------------
      if (urlStr === '/api/payments/create-session' && options.method === 'POST') {
        const body = JSON.parse(options.body);

        const result = await cmsPost('/payments/create-session', {
          provider: body.method,
          module: body.bookingRef?.startsWith('GC:') ? 'gift_card' : 'booking',
          reference_id: body.bookingRef,
          amount: body.amount || 15000, // fallback
          currency: 'EUR',
          description: 'Snow Adventure - Prenotazione',
          customer_email: body.email || 'customer@email.com',
          customer_name: body.name || 'Cliente',
          success_url: `${window.location.origin}/booking-success`,
          cancel_url: window.location.href,
        });

        return mockResponse({ redirectUrl: result.checkout_url });
      }

      // ---------------------------------------------------------------
      // GET /api/gallery
      // ---------------------------------------------------------------
      if (urlStr === '/api/gallery') {
        const items = await cmsGet('/gallery');
        return mockResponse(items.map(i => ({
          url: i.image_url,
          alt_text: i.alt_text,
          caption: i.caption,
        })));
      }

      // ---------------------------------------------------------------
      // POST /api/contact
      // ---------------------------------------------------------------
      if (urlStr === '/api/contact' && options.method === 'POST') {
        const body = JSON.parse(options.body);
        await cmsPost('/forms/contatto/submit', {
          nome: body.nome,
          cognome: body.cognome || '',
          email: body.email,
          telefono: body.phone || '',
          messaggio: body.message || '',
        });
        return mockResponse({ success: true });
      }

      // ---------------------------------------------------------------
      // GET /api/config (payment provider public keys)
      // ---------------------------------------------------------------
      if (urlStr === '/api/config') {
        // Return placeholder config — real keys are server-side only
        return mockResponse({
          stripePublishableKey: null,
          paypalClientId: null,
        });
      }

    } catch (err) {
      console.error('CMS Adapter error:', err);
      return mockErrorResponse(err.message || 'Errore di connessione', 500);
    }

    // Fallback: pass through to original server
    return originalFetch.call(this, url, options);
  };

  // =====================================================================
  // Helper functions
  // =====================================================================
  function mockResponse(data, status = 200) {
    return new Response(JSON.stringify(data), {
      status,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  function mockErrorResponse(message, status = 400) {
    return new Response(JSON.stringify({ error: message }), {
      status,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Pre-load service map
  loadServiceMap();

  console.log('CMS Adapter loaded — API calls will be routed to:', CMS_BASE_URL);
})();
