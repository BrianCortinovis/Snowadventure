const { supabase } = require('../_lib/supabase');
const { generateBookingRef } = require('../_lib/codes');
const { sendBookingConfirmation } = require('../_lib/email');

module.exports = async function handler(req, res) {
  if (req.method === 'POST') return createBooking(req, res);
  if (req.method === 'GET') return getBooking(req, res);
  return res.status(405).json({ error: 'Method not allowed' });
};

async function createBooking(req, res) {
  const { slotId, nome, cognome, email, phone, numSleds, numPeople, giftCardCode, voucherCode, paymentMethod, privacyConsent, marketingConsent, notes } = req.body;

  if (!slotId || !nome || !cognome || !email || !numSleds || !numPeople) {
    return res.status(400).json({ error: 'Compila tutti i campi obbligatori' });
  }
  if (!privacyConsent) {
    return res.status(400).json({ error: 'Il consenso al trattamento dei dati è obbligatorio' });
  }

  // Get slot with experience
  const { data: slot } = await supabase
    .from('calendar_slots')
    .select('*, experiences(price_cents, slug, name)')
    .eq('id', slotId)
    .single();

  if (!slot) return res.status(404).json({ error: 'Slot non trovato' });

  // Check availability
  const { data: existingBookings } = await supabase
    .from('bookings')
    .select('num_sleds')
    .eq('slot_id', slotId)
    .in('status', ['pending', 'confirmed']);

  const bookedSleds = (existingBookings || []).reduce((sum, b) => sum + b.num_sleds, 0);
  const available = slot.max_sleds - bookedSleds;

  if (numSleds > available) {
    return res.status(409).json({ error: "Slot pieno, scegli un'altra data o orario" });
  }

  let amountCents = slot.experiences.price_cents * numSleds;
  let discountCents = 0;

  // Validate gift card
  if (giftCardCode) {
    const { data: gc } = await supabase
      .from('gift_cards')
      .select('*')
      .eq('code', giftCardCode)
      .eq('status', 'active')
      .gt('expires_at', new Date().toISOString())
      .single();

    if (!gc) return res.status(400).json({ error: 'Gift card non valida o scaduta' });
    if (gc.experience_slug && gc.experience_slug !== slot.experiences.slug) {
      return res.status(400).json({ error: 'Gift card non valida per questa esperienza' });
    }
    discountCents = Math.min(gc.amount_cents, amountCents);
  }

  // Validate voucher
  if (voucherCode) {
    const { data: voucher } = await supabase
      .from('vouchers')
      .select('*')
      .eq('code', voucherCode)
      .eq('is_active', true)
      .single();

    if (!voucher || (voucher.expires_at && new Date(voucher.expires_at) < new Date()) || voucher.times_used >= voucher.max_uses) {
      return res.status(400).json({ error: 'Codice sconto non valido o scaduto' });
    }
    if (voucher.discount_type === 'percentage') {
      discountCents += Math.floor(amountCents * voucher.discount_value / 100);
    } else {
      discountCents += voucher.discount_value;
    }
    discountCents = Math.min(discountCents, amountCents);
  }

  const bookingRef = generateBookingRef();

  const { data: booking, error } = await supabase
    .from('bookings')
    .insert({
      booking_ref: bookingRef,
      slot_id: slotId,
      nome, cognome, email, phone,
      num_sleds: numSleds,
      num_people: numPeople,
      gift_card_code: giftCardCode || null,
      voucher_code: voucherCode || null,
      payment_method: paymentMethod || null,
      amount_cents: amountCents,
      discount_cents: discountCents,
      privacy_consent: privacyConsent,
      marketing_consent: marketingConsent || false,
      notes: notes || null,
    })
    .select()
    .single();

  if (error) {
    console.error('Booking insert error:', error);
    return res.status(500).json({ error: 'Errore nella creazione della prenotazione' });
  }

  // If fully covered by gift card/voucher
  if (discountCents >= amountCents) {
    await supabase.from('bookings').update({ status: 'confirmed' }).eq('id', booking.id);

    if (giftCardCode) {
      await supabase.from('gift_cards').update({ status: 'used', used_booking_id: booking.id }).eq('code', giftCardCode);
    }
    if (voucherCode) {
      await supabase.rpc('increment_voucher_usage', { voucher_code: voucherCode });
    }

    await sendBookingConfirmation({
      ...booking,
      date: slot.date,
      time: slot.time,
      experience_name: slot.experiences.name,
    });

    return res.json({ bookingRef, date: slot.date, time: slot.time, status: 'confirmed', paymentRequired: false });
  }

  res.json({
    bookingRef,
    date: slot.date,
    time: slot.time,
    status: 'pending',
    paymentRequired: true,
    totalCents: amountCents - discountCents,
  });
}

async function getBooking(req, res) {
  const { ref } = req.query;
  if (!ref) return res.status(400).json({ error: 'Parametro ref richiesto' });

  const { data: booking } = await supabase
    .from('bookings')
    .select('*, calendar_slots(date, time, experiences(name, slug))')
    .eq('booking_ref', ref)
    .single();

  if (!booking) return res.status(404).json({ error: 'Prenotazione non trovata' });

  res.json({
    bookingRef: booking.booking_ref,
    status: booking.status,
    experience: booking.calendar_slots.experiences.name,
    date: booking.calendar_slots.date,
    time: booking.calendar_slots.time,
    nome: booking.nome,
    numSleds: booking.num_sleds,
    numPeople: booking.num_people,
  });
}
