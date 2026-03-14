const siteUrl = process.env.SITE_URL || 'https://snowadventure.it';

// --- STRIPE ---
let stripe;
function getStripe() {
  if (!stripe && process.env.STRIPE_SECRET_KEY && process.env.STRIPE_SECRET_KEY !== 'sk_test_XXXXX') {
    stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
  }
  return stripe;
}

async function createStripeSession(booking, experienceName) {
  const s = getStripe();
  if (!s) throw new Error('Stripe non configurato');

  const session = await s.checkout.sessions.create({
    payment_method_types: ['card'],
    locale: 'it',
    line_items: [{
      price_data: {
        currency: 'eur',
        product_data: {
          name: experienceName,
          description: `Prenotazione ${booking.bookingRef} - ${booking.date} ore ${booking.time}`,
        },
        unit_amount: booking.amountCents - (booking.discountCents || 0),
      },
      quantity: 1,
    }],
    mode: 'payment',
    success_url: `${siteUrl}/booking-success.html?ref=${booking.bookingRef}`,
    cancel_url: `${siteUrl}/booking-cancel.html?ref=${booking.bookingRef}`,
    metadata: { booking_ref: booking.bookingRef },
  });

  return { url: session.url, sessionId: session.id };
}

// --- PAYPAL ---
async function createPayPalOrder(booking, experienceName) {
  if (!process.env.PAYPAL_CLIENT_ID || process.env.PAYPAL_CLIENT_ID === 'XXXXX') {
    throw new Error('PayPal non configurato');
  }

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

  const amountEur = ((booking.amountCents - (booking.discountCents || 0)) / 100).toFixed(2);

  const orderResponse = await fetch(`${baseUrl}/v2/checkout/orders`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${authData.access_token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      intent: 'CAPTURE',
      purchase_units: [{
        reference_id: booking.bookingRef,
        description: `${experienceName} - ${booking.date} ore ${booking.time}`,
        amount: { currency_code: 'EUR', value: amountEur },
      }],
      application_context: {
        return_url: `${siteUrl}/api/payments/paypal-capture?ref=${booking.bookingRef}`,
        cancel_url: `${siteUrl}/booking-cancel.html?ref=${booking.bookingRef}`,
        locale: 'it-IT',
      },
    }),
  });
  const order = await orderResponse.json();
  const approveLink = order.links.find(l => l.rel === 'approve');
  return { url: approveLink.href, orderId: order.id };
}

// --- SATISPAY ---
async function createSatispayPayment(booking, experienceName) {
  if (!process.env.SATISPAY_KEY_ID || process.env.SATISPAY_KEY_ID === 'XXXXX') {
    throw new Error('Satispay non configurato');
  }

  const baseUrl = process.env.SATISPAY_ENVIRONMENT === 'production'
    ? 'https://authservices.satispay.com'
    : 'https://staging.authservices.satispay.com';

  const amountUnit = booking.amountCents - (booking.discountCents || 0);

  const response = await fetch(`${baseUrl}/g_business/v1/payments`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'KeyId': process.env.SATISPAY_KEY_ID,
    },
    body: JSON.stringify({
      flow: 'MATCH_CODE',
      amount_unit: amountUnit,
      currency: 'EUR',
      description: `${experienceName} - Ref: ${booking.bookingRef}`,
      callback_url: `${siteUrl}/api/payments/satispay-callback?ref=${booking.bookingRef}`,
      redirect_url: `${siteUrl}/booking-success.html?ref=${booking.bookingRef}`,
      metadata: { booking_ref: booking.bookingRef },
    }),
  });
  const payment = await response.json();
  return { url: payment.redirect_url, paymentId: payment.id };
}

module.exports = { createStripeSession, createPayPalOrder, createSatispayPayment, getStripe };
