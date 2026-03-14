const express = require('express');
const router = express.Router();
const bookingService = require('../../services/booking.service');
const { getDb } = require('../../db');

// GET /api/availability?experience=sunset&month=2026-01
router.get('/availability', (req, res) => {
  const { experience, month } = req.query;
  if (!experience || !month) {
    return res.status(400).json({ error: 'Parametri experience e month richiesti' });
  }
  const slots = bookingService.getAvailability(experience, month);
  res.json(slots);
});

// GET /api/experiences
router.get('/experiences', (req, res) => {
  const db = getDb();
  const experiences = db.prepare('SELECT * FROM experiences WHERE is_active = 1').all();
  res.json(experiences);
});

// POST /api/bookings
router.post('/bookings', (req, res) => {
  const { slotId, nome, cognome, email, phone, numSleds, numPeople, giftCardCode, voucherCode, paymentMethod, privacyConsent, marketingConsent, notes } = req.body;

  // Validation
  if (!slotId || !nome || !cognome || !email || !numSleds || !numPeople) {
    return res.status(400).json({ error: 'Compila tutti i campi obbligatori' });
  }
  if (!privacyConsent) {
    return res.status(400).json({ error: 'Il consenso al trattamento dei dati è obbligatorio' });
  }
  if (numSleds < 1 || numSleds > 10) {
    return res.status(400).json({ error: 'Numero motoslitte non valido' });
  }

  // Get experience price
  const db = getDb();
  const slot = db.prepare(`
    SELECT cs.*, e.price_cents, e.slug FROM calendar_slots cs
    JOIN experiences e ON e.id = cs.experience_id WHERE cs.id = ?
  `).get(slotId);

  if (!slot) return res.status(404).json({ error: 'Slot non trovato' });

  let amountCents = slot.price_cents * numSleds;
  let discountCents = 0;

  // Validate gift card
  if (giftCardCode) {
    const gc = require('../../services/giftcard.service').validateGiftCard(giftCardCode);
    if (!gc) return res.status(400).json({ error: 'Gift card non valida o scaduta' });
    if (gc.experienceSlug && gc.experienceSlug !== slot.slug) {
      return res.status(400).json({ error: 'Gift card non valida per questa esperienza' });
    }
    discountCents = Math.min(gc.amountCents, amountCents);
  }

  // Validate voucher
  if (voucherCode) {
    const voucher = db.prepare(`SELECT * FROM vouchers WHERE code = ? AND is_active = 1 AND (expires_at IS NULL OR expires_at > datetime('now')) AND times_used < max_uses`).get(voucherCode);
    if (!voucher) return res.status(400).json({ error: 'Codice sconto non valido o scaduto' });
    if (voucher.discount_type === 'percentage') {
      discountCents += Math.floor(amountCents * voucher.discount_value / 100);
    } else {
      discountCents += voucher.discount_value;
    }
    discountCents = Math.min(discountCents, amountCents);
  }

  try {
    const booking = bookingService.createBooking({
      slotId, nome, cognome, email, phone, numSleds, numPeople,
      giftCardCode, voucherCode, paymentMethod,
      amountCents, discountCents,
      privacyConsent, marketingConsent, notes,
    });

    // If fully covered by gift card, confirm immediately
    if (discountCents >= amountCents) {
      bookingService.updateBookingStatus(booking.bookingRef, 'confirmed');
      if (giftCardCode) {
        const gcService = require('../../services/giftcard.service');
        const bk = bookingService.getBookingByRef(booking.bookingRef);
        gcService.useGiftCard(giftCardCode, bk.id);
      }
      if (voucherCode) {
        db.prepare('UPDATE vouchers SET times_used = times_used + 1 WHERE code = ?').run(voucherCode);
      }
      // Send confirmation email
      const fullBooking = bookingService.getBookingByRef(booking.bookingRef);
      require('../../services/email.service').sendBookingConfirmation(fullBooking);
      return res.json({ ...booking, status: 'confirmed', paymentRequired: false });
    }

    res.json({ ...booking, status: 'pending', paymentRequired: true, totalCents: amountCents - discountCents });
  } catch (err) {
    if (err.message === 'SLOT_FULL') {
      return res.status(409).json({ error: 'Slot pieno, scegli un\'altra data o orario' });
    }
    if (err.message === 'SLOT_NOT_FOUND') {
      return res.status(404).json({ error: 'Slot non trovato' });
    }
    console.error('Booking error:', err);
    res.status(500).json({ error: 'Errore nella creazione della prenotazione' });
  }
});

// GET /api/bookings/:ref
router.get('/bookings/:ref', (req, res) => {
  const booking = bookingService.getBookingByRef(req.params.ref);
  if (!booking) return res.status(404).json({ error: 'Prenotazione non trovata' });
  res.json({
    bookingRef: booking.booking_ref,
    status: booking.status,
    experience: booking.experience_name,
    date: booking.date,
    time: booking.time,
    nome: booking.nome,
    numSleds: booking.num_sleds,
    numPeople: booking.num_people,
  });
});

module.exports = router;
