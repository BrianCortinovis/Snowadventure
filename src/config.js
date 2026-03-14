require('dotenv').config();

module.exports = {
  port: process.env.PORT || 3000,
  sessionSecret: process.env.SESSION_SECRET || 'dev-secret-change-me',
  admin: {
    username: process.env.ADMIN_USERNAME || 'admin',
    password: process.env.ADMIN_PASSWORD || 'snowadventure2026',
  },
  stripe: {
    secretKey: process.env.STRIPE_SECRET_KEY,
    publishableKey: process.env.STRIPE_PUBLISHABLE_KEY,
    webhookSecret: process.env.STRIPE_WEBHOOK_SECRET,
  },
  paypal: {
    clientId: process.env.PAYPAL_CLIENT_ID,
    clientSecret: process.env.PAYPAL_CLIENT_SECRET,
    mode: process.env.PAYPAL_MODE || 'sandbox',
  },
  satispay: {
    keyId: process.env.SATISPAY_KEY_ID,
    privateKeyPath: process.env.SATISPAY_PRIVATE_KEY_PATH,
    environment: process.env.SATISPAY_ENVIRONMENT || 'staging',
  },
  smtp: {
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT || '587'),
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
    from: process.env.EMAIL_FROM || 'Snow Adventure <info@snowadventure.it>',
  },
  siteUrl: process.env.SITE_URL || 'http://localhost:3000',
  businessName: process.env.BUSINESS_NAME || 'Snow Adventure Foppolo',
};
