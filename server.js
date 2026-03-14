const express = require('express');
const session = require('express-session');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');
const config = require('./src/config');
const { getDb } = require('./src/db');
const bookingService = require('./src/services/booking.service');
const giftcardService = require('./src/services/giftcard.service');

const app = express();

// Security
app.use(helmet({
  contentSecurityPolicy: false, // Disabled for inline styles/scripts in existing HTML
  crossOriginEmbedderPolicy: false,
}));

// Rate limiting
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: { error: 'Troppe richieste, riprova tra qualche minuto' },
});
app.use('/api/', apiLimiter);

// Session
app.use(session({
  secret: config.sessionSecret,
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000, // 24h
    sameSite: 'lax',
  },
}));

// Body parsing (except Stripe webhook which needs raw body)
app.use((req, res, next) => {
  if (req.originalUrl === '/api/payments/webhook/stripe') return next();
  express.json()(req, res, next);
});
app.use(express.urlencoded({ extended: true }));

// Initialize database
getDb();

// Expire stale bookings and gift cards periodically
setInterval(() => {
  try {
    bookingService.expirePendingBookings(30);
    giftcardService.expireGiftCards();
  } catch (e) {
    console.error('Cleanup error:', e.message);
  }
}, 5 * 60 * 1000);

// --- STATIC FILES ---
// Serve uploaded gallery images
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
// Serve public JS/CSS widgets
app.use('/js', express.static(path.join(__dirname, 'public', 'js')));
app.use('/css', express.static(path.join(__dirname, 'public', 'css')));
// Serve legal pages
app.use('/legal', express.static(path.join(__dirname, 'public', 'legal')));
// Serve admin panel
app.use('/admin', express.static(path.join(__dirname, 'admin')));
// Serve existing HTML site
app.use(express.static(path.join(__dirname, 'html')));

// --- API ROUTES ---
app.use('/api', require('./src/routes/api/bookings'));
app.use('/api/payments', require('./src/routes/api/payments'));
app.use('/api/giftcards', require('./src/routes/api/giftcards'));
app.use('/api/gallery', require('./src/routes/api/gallery'));
app.use('/api/contact', require('./src/routes/api/contact'));

// --- ADMIN ROUTES ---
app.use('/api/admin', require('./src/routes/admin/index'));

// --- STRIPE CONFIG (public) ---
app.get('/api/config', (req, res) => {
  res.json({
    stripePublishableKey: config.stripe.publishableKey,
    paypalClientId: config.paypal.clientId,
    satispayEnabled: !!(config.satispay.keyId && config.satispay.keyId !== 'XXXXX'),
  });
});

// Fallback (Express 5 syntax)
app.get('/{*path}', (req, res) => {
  res.sendFile(path.join(__dirname, 'html', 'index.html'));
});

// Error handler (Express 5 requires 4 params)
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({ error: 'Errore del server' });
});

app.listen(config.port, () => {
  console.log(`\n  Snow Adventure server running on http://localhost:${config.port}`);
  console.log(`  Admin panel: http://localhost:${config.port}/admin/`);
  console.log(`  API: http://localhost:${config.port}/api/\n`);
});
