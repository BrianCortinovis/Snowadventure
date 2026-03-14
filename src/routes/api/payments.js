const express = require('express');
const router = express.Router();
const paymentService = require('../../services/payment.service');
const bookingService = require('../../services/booking.service');
const giftcardService = require('../../services/giftcard.service');
const emailService = require('../../services/email.service');
const config = require('../../config');

// POST /api/payments/create-session
router.post('/create-session', async (req, res) => {
  const { bookingRef, method } = req.body;
  if (!bookingRef || !method) {
    return res.status(400).json({ error: 'bookingRef e method richiesti' });
  }

  const booking = bookingService.getBookingByRef(bookingRef);
  if (!booking) return res.status(404).json({ error: 'Prenotazione non trovata' });
  if (booking.status !== 'pending') {
    return res.status(400).json({ error: 'Prenotazione non in stato pending' });
  }

  try {
    let result;
    const finalAmount = booking.amount_cents - booking.discount_cents;

    const bookingData = {
      bookingRef: booking.booking_ref,
      date: booking.date,
      time: booking.time,
      amountCents: booking.amount_cents,
      discountCents: booking.discount_cents,
    };

    switch (method) {
      case 'stripe':
        result = await paymentService.createStripeSession(bookingData, booking.experience_name);
        bookingService.updateBookingStatus(bookingRef, 'pending', result.sessionId);
        break;
      case 'paypal':
        result = await paymentService.createPayPalOrder(bookingData, booking.experience_name);
        bookingService.updateBookingStatus(bookingRef, 'pending', result.orderId);
        break;
      case 'satispay':
        result = await paymentService.createSatispayPayment(bookingData, booking.experience_name);
        bookingService.updateBookingStatus(bookingRef, 'pending', result.paymentId);
        break;
      default:
        return res.status(400).json({ error: 'Metodo di pagamento non supportato' });
    }

    res.json({ redirectUrl: result.url });
  } catch (err) {
    console.error('Payment error:', err);
    res.status(500).json({ error: err.message || 'Errore nella creazione del pagamento' });
  }
});

// POST /api/payments/webhook/stripe
router.post('/webhook/stripe', express.raw({ type: 'application/json' }), (req, res) => {
  const stripe = require('stripe')(config.stripe.secretKey);
  const sig = req.headers['stripe-signature'];

  let event;
  try {
    event = stripe.webhooks.constructEvent(req.body, sig, config.stripe.webhookSecret);
  } catch (err) {
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    const bookingRef = session.metadata.booking_ref;
    if (bookingRef) {
      confirmBooking(bookingRef, session.payment_intent);
    }
  }

  res.json({ received: true });
});

// GET /api/payments/paypal/capture?ref=XX&token=XX
router.get('/paypal/capture', async (req, res) => {
  const { ref, token } = req.query;
  if (!ref || !token) return res.redirect('/booking-cancel.html');

  try {
    const baseUrl = config.paypal.mode === 'sandbox'
      ? 'https://api-m.sandbox.paypal.com'
      : 'https://api-m.paypal.com';

    const authResponse = await fetch(`${baseUrl}/v1/oauth2/token`, {
      method: 'POST',
      headers: {
        'Authorization': 'Basic ' + Buffer.from(`${config.paypal.clientId}:${config.paypal.clientSecret}`).toString('base64'),
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
      confirmBooking(ref, token);
      res.redirect(`/booking-success.html?ref=${ref}`);
    } else {
      res.redirect(`/booking-cancel.html?ref=${ref}`);
    }
  } catch (err) {
    console.error('PayPal capture error:', err);
    res.redirect(`/booking-cancel.html?ref=${ref}`);
  }
});

// POST /api/payments/satispay/callback
router.post('/satispay/callback', (req, res) => {
  const { ref } = req.query;
  const { status, id } = req.body;

  if (status === 'ACCEPTED' && ref) {
    confirmBooking(ref, id);
  }

  res.json({ received: true });
});

async function confirmBooking(bookingRef, paymentId) {
  bookingService.updateBookingStatus(bookingRef, 'confirmed', paymentId);
  const booking = bookingService.getBookingByRef(bookingRef);

  // Use gift card if present
  if (booking.gift_card_code) {
    giftcardService.useGiftCard(booking.gift_card_code, booking.id);
  }

  // Use voucher if present
  if (booking.voucher_code) {
    const { getDb } = require('../../db');
    getDb().prepare('UPDATE vouchers SET times_used = times_used + 1 WHERE code = ?').run(booking.voucher_code);
  }

  // Send confirmation email
  await emailService.sendBookingConfirmation(booking);
}

module.exports = router;
