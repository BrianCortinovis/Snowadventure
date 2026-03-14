const { getDb } = require('../db');
const { generateBookingRef } = require('../utils/codes');

function getAvailability(experienceSlug, month) {
  const db = getDb();
  const exp = db.prepare('SELECT id FROM experiences WHERE slug = ?').get(experienceSlug);
  if (!exp) return [];

  const likePattern = `${month}%`;
  const slots = db.prepare(`
    SELECT cs.id, cs.date, cs.time, cs.max_sleds, cs.is_blocked, cs.notes,
           COALESCE(SUM(CASE WHEN b.status IN ('pending','confirmed') THEN b.num_sleds ELSE 0 END), 0) as booked_sleds
    FROM calendar_slots cs
    LEFT JOIN bookings b ON b.slot_id = cs.id
    WHERE cs.experience_id = ? AND cs.date LIKE ? AND cs.is_blocked = 0
    GROUP BY cs.id
    ORDER BY cs.date, cs.time
  `).all(exp.id, likePattern);

  return slots.map(s => ({
    id: s.id,
    date: s.date,
    time: s.time,
    maxSleds: s.max_sleds,
    bookedSleds: s.booked_sleds,
    availableSleds: s.max_sleds - s.booked_sleds,
    notes: s.notes,
  }));
}

function createBooking({ slotId, nome, cognome, email, phone, numSleds, numPeople, giftCardCode, voucherCode, paymentMethod, amountCents, discountCents, privacyConsent, marketingConsent, notes }) {
  const db = getDb();

  const result = db.transaction(() => {
    // Check availability with lock
    const slot = db.prepare(`
      SELECT cs.id, cs.max_sleds, cs.experience_id, cs.date, cs.time,
             COALESCE(SUM(CASE WHEN b.status IN ('pending','confirmed') THEN b.num_sleds ELSE 0 END), 0) as booked_sleds
      FROM calendar_slots cs
      LEFT JOIN bookings b ON b.slot_id = cs.id
      WHERE cs.id = ? AND cs.is_blocked = 0
      GROUP BY cs.id
    `).get(slotId);

    if (!slot) throw new Error('SLOT_NOT_FOUND');

    const available = slot.max_sleds - slot.booked_sleds;
    if (numSleds > available) throw new Error('SLOT_FULL');

    const bookingRef = generateBookingRef();

    db.prepare(`
      INSERT INTO bookings (booking_ref, slot_id, nome, cognome, email, phone, num_sleds, num_people,
        gift_card_code, voucher_code, payment_method, amount_cents, discount_cents, privacy_consent, marketing_consent, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(bookingRef, slotId, nome, cognome, email, phone, numSleds, numPeople,
      giftCardCode || null, voucherCode || null, paymentMethod || null,
      amountCents, discountCents || 0, privacyConsent ? 1 : 0, marketingConsent ? 1 : 0, notes || null);

    return {
      bookingRef,
      slotId,
      date: slot.date,
      time: slot.time,
      amountCents,
    };
  })();

  return result;
}

function getBookingByRef(ref) {
  const db = getDb();
  return db.prepare(`
    SELECT b.*, cs.date, cs.time, e.name as experience_name, e.slug as experience_slug
    FROM bookings b
    JOIN calendar_slots cs ON cs.id = b.slot_id
    JOIN experiences e ON e.id = cs.experience_id
    WHERE b.booking_ref = ?
  `).get(ref);
}

function updateBookingStatus(bookingRef, status, paymentId) {
  const db = getDb();
  if (paymentId) {
    db.prepare('UPDATE bookings SET status = ?, payment_id = ? WHERE booking_ref = ?')
      .run(status, paymentId, bookingRef);
  } else {
    db.prepare('UPDATE bookings SET status = ? WHERE booking_ref = ?')
      .run(status, bookingRef);
  }
}

function expirePendingBookings(minutesOld = 30) {
  const db = getDb();
  db.prepare(`
    UPDATE bookings SET status = 'expired'
    WHERE status = 'pending'
    AND created_at < datetime('now', '-' || ? || ' minutes')
  `).run(minutesOld);
}

function getAllBookings(filters = {}) {
  const db = getDb();
  let where = '1=1';
  const params = [];

  if (filters.status) { where += ' AND b.status = ?'; params.push(filters.status); }
  if (filters.date) { where += ' AND cs.date = ?'; params.push(filters.date); }
  if (filters.experience) {
    where += ' AND e.slug = ?'; params.push(filters.experience);
  }

  return db.prepare(`
    SELECT b.*, cs.date, cs.time, e.name as experience_name, e.slug as experience_slug
    FROM bookings b
    JOIN calendar_slots cs ON cs.id = b.slot_id
    JOIN experiences e ON e.id = cs.experience_id
    WHERE ${where}
    ORDER BY cs.date DESC, cs.time DESC
  `).all(...params);
}

module.exports = {
  getAvailability,
  createBooking,
  getBookingByRef,
  updateBookingStatus,
  expirePendingBookings,
  getAllBookings,
};
