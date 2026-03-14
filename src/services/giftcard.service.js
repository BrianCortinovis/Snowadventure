const { getDb } = require('../db');
const { generateGiftCardCode } = require('../utils/codes');

function createGiftCard({ experienceSlug, amountCents, purchaserNome, purchaserCognome, purchaserEmail, recipientName, recipientEmail, personalMessage, paymentMethod }) {
  const db = getDb();
  const code = generateGiftCardCode();
  const expiresAt = new Date();
  expiresAt.setFullYear(expiresAt.getFullYear() + 1);

  db.prepare(`
    INSERT INTO gift_cards (code, experience_slug, amount_cents, purchaser_nome, purchaser_cognome, purchaser_email,
      recipient_name, recipient_email, personal_message, payment_method, expires_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(code, experienceSlug || null, amountCents, purchaserNome, purchaserCognome, purchaserEmail,
    recipientName || null, recipientEmail || null, personalMessage || null,
    paymentMethod || null, expiresAt.toISOString());

  return { code, amountCents, expiresAt: expiresAt.toISOString() };
}

function validateGiftCard(code) {
  const db = getDb();
  const gc = db.prepare(`
    SELECT * FROM gift_cards WHERE code = ? AND status = 'active' AND expires_at > datetime('now')
  `).get(code);
  if (!gc) return null;
  return {
    code: gc.code,
    amountCents: gc.amount_cents,
    experienceSlug: gc.experience_slug,
    expiresAt: gc.expires_at,
  };
}

function activateGiftCard(code, paymentId) {
  const db = getDb();
  db.prepare('UPDATE gift_cards SET status = ?, payment_id = ? WHERE code = ?')
    .run('active', paymentId, code);
}

function useGiftCard(code, bookingId) {
  const db = getDb();
  db.prepare('UPDATE gift_cards SET status = ?, used_booking_id = ? WHERE code = ?')
    .run('used', bookingId, code);
}

function getAllGiftCards() {
  const db = getDb();
  return db.prepare('SELECT * FROM gift_cards ORDER BY created_at DESC').all();
}

function expireGiftCards() {
  const db = getDb();
  db.prepare(`UPDATE gift_cards SET status = 'expired' WHERE status = 'active' AND expires_at <= datetime('now')`).run();
}

module.exports = { createGiftCard, validateGiftCard, activateGiftCard, useGiftCard, getAllGiftCards, expireGiftCards };
