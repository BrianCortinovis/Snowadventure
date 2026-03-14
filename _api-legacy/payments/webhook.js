const { supabase } = require('../_lib/supabase');
const { sendBookingConfirmation } = require('../_lib/email');

// Disable body parsing for Stripe signature verification
module.exports.config = { api: { bodyParser: false } };

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  // Collect raw body
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
  }
  const rawBody = Buffer.concat(chunks);

  const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
  const sig = req.headers['stripe-signature'];

  let event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    const bookingRef = session.metadata.booking_ref;
    if (bookingRef) {
      await confirmBooking(bookingRef, session.payment_intent);
    }
  }

  res.json({ received: true });
};

async function confirmBooking(bookingRef, paymentId) {
  await supabase.from('bookings').update({ status: 'confirmed', payment_id: paymentId }).eq('booking_ref', bookingRef);

  const { data: booking } = await supabase
    .from('bookings')
    .select('*, calendar_slots(date, time, experiences(name))')
    .eq('booking_ref', bookingRef)
    .single();

  if (!booking) return;

  // Use gift card
  if (booking.gift_card_code) {
    await supabase.from('gift_cards').update({ status: 'used', used_booking_id: booking.id }).eq('code', booking.gift_card_code);
  }

  // Use voucher
  if (booking.voucher_code) {
    const { data: voucher } = await supabase.from('vouchers').select('times_used').eq('code', booking.voucher_code).single();
    if (voucher) {
      await supabase.from('vouchers').update({ times_used: voucher.times_used + 1 }).eq('code', booking.voucher_code);
    }
  }

  await sendBookingConfirmation({
    ...booking,
    date: booking.calendar_slots.date,
    time: booking.calendar_slots.time,
    experience_name: booking.calendar_slots.experiences.name,
  });
}
