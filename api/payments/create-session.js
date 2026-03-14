const { supabase } = require('../_lib/supabase');
const { createStripeSession, createPayPalOrder, createSatispayPayment } = require('../_lib/payments');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { bookingRef, method } = req.body;
  if (!bookingRef || !method) {
    return res.status(400).json({ error: 'bookingRef e method richiesti' });
  }

  const { data: booking } = await supabase
    .from('bookings')
    .select('*, calendar_slots(date, time, experiences(name))')
    .eq('booking_ref', bookingRef)
    .single();

  if (!booking) return res.status(404).json({ error: 'Prenotazione non trovata' });
  if (booking.status !== 'pending') {
    return res.status(400).json({ error: 'Prenotazione non in stato pending' });
  }

  const bookingData = {
    bookingRef: booking.booking_ref,
    date: booking.calendar_slots.date,
    time: booking.calendar_slots.time,
    amountCents: booking.amount_cents,
    discountCents: booking.discount_cents,
  };

  try {
    let result;
    switch (method) {
      case 'stripe':
        result = await createStripeSession(bookingData, booking.calendar_slots.experiences.name);
        await supabase.from('bookings').update({ payment_id: result.sessionId, payment_method: 'stripe' }).eq('id', booking.id);
        break;
      case 'paypal':
        result = await createPayPalOrder(bookingData, booking.calendar_slots.experiences.name);
        await supabase.from('bookings').update({ payment_id: result.orderId, payment_method: 'paypal' }).eq('id', booking.id);
        break;
      case 'satispay':
        result = await createSatispayPayment(bookingData, booking.calendar_slots.experiences.name);
        await supabase.from('bookings').update({ payment_id: result.paymentId, payment_method: 'satispay' }).eq('id', booking.id);
        break;
      default:
        return res.status(400).json({ error: 'Metodo di pagamento non supportato' });
    }

    res.json({ redirectUrl: result.url });
  } catch (err) {
    console.error('Payment error:', err);
    res.status(500).json({ error: err.message || 'Errore nella creazione del pagamento' });
  }
};
