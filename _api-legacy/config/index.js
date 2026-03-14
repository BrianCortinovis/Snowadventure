module.exports = async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  res.json({
    stripePublishableKey: process.env.STRIPE_PUBLISHABLE_KEY || null,
    paypalClientId: process.env.PAYPAL_CLIENT_ID || null,
    satispayEnabled: !!(process.env.SATISPAY_KEY_ID && process.env.SATISPAY_KEY_ID !== 'XXXXX'),
    supabaseUrl: process.env.SUPABASE_URL,
    supabaseAnonKey: process.env.SUPABASE_ANON_KEY,
  });
};
