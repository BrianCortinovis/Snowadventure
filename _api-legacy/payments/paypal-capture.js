const { supabase } = require('../_lib/supabase');
const { sendBookingConfirmation } = require('../_lib/email');

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const { ref, token } = req.query;
  if (!ref || !token) return res.redirect('/booking-cancel.html');

  try {
    const baseUrl = process.env.PAYPAL_MODE === 'sandbox'
      ? 'https://api-m.sandbox.paypal.com'
      : 'https://api-m.paypal.com';

    const authResponse = await fetch(`${baseUrl}/v1/oauth2/token`, {
      method: 'POST',
      headers: {
        'Authorization': 'Basic ' + Buffer.from(`${process.env.PAYPAL_CLIENT_ID}:${process.env.PAYPAL_CLIENT_SECRET}`).toString('base64'),
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: 'grant_type=client_credentials',
    });
    const authData = await authResponse.json();

    const captureResponse = await fetch(`${baseUrl}/v2/checkout/orders/${token}/capture`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${authData.access_token}`,
        'Content-Type': 'application/json',
      },
    });
    const capture = await captureResponse.json();

    if (capture.status === 'COMPLETED') {
      await supabase.from('bookings').update({ status: 'confirmed', payment_id: token }).eq('booking_ref', ref);

      const { data: booking } = await supabase
        .from('bookings')
        .select('*, calendar_slots(date, time, experiences(name))')
        .eq('booking_ref', ref)
        .single();

      if (booking) {
        await sendBookingConfirmation({
          ...booking,
          date: booking.calendar_slots.date,
          time: booking.calendar_slots.time,
          experience_name: booking.calendar_slots.experiences.name,
        });
      }

      res.redirect(`/booking-success.html?ref=${ref}`);
    } else {
      res.redirect(`/booking-cancel.html?ref=${ref}`);
    }
  } catch (err) {
    console.error('PayPal capture error:', err);
    res.redirect(`/booking-cancel.html?ref=${ref}`);
  }
};
