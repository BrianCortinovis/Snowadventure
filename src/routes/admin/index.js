const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const { getDb } = require('../../db');
const { requireAdmin } = require('../../middleware/auth');
const bookingService = require('../../services/booking.service');
const giftcardService = require('../../services/giftcard.service');
const uploadService = require('../../services/upload.service');
const { generateVoucherCode } = require('../../utils/codes');

// --- AUTH ---
router.post('/login', (req, res) => {
  const { username, password } = req.body;
  const db = getDb();
  const user = db.prepare('SELECT * FROM admin_users WHERE username = ?').get(username);
  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    return res.status(401).json({ error: 'Credenziali non valide' });
  }
  req.session.isAdmin = true;
  req.session.adminId = user.id;
  res.json({ success: true });
});

router.post('/logout', (req, res) => {
  req.session.destroy();
  res.json({ success: true });
});

router.get('/me', requireAdmin, (req, res) => {
  res.json({ authenticated: true });
});

// --- DASHBOARD ---
router.get('/dashboard', requireAdmin, (req, res) => {
  const db = getDb();
  const today = new Date().toISOString().slice(0, 10);

  const todayBookings = db.prepare(`
    SELECT COUNT(*) as c FROM bookings b JOIN calendar_slots cs ON cs.id = b.slot_id
    WHERE cs.date = ? AND b.status IN ('confirmed','pending')
  `).get(today).c;

  const upcomingBookings = db.prepare(`
    SELECT COUNT(*) as c FROM bookings b JOIN calendar_slots cs ON cs.id = b.slot_id
    WHERE cs.date >= ? AND b.status = 'confirmed'
  `).get(today).c;

  const totalRevenue = db.prepare(`
    SELECT COALESCE(SUM(amount_cents - discount_cents), 0) as total FROM bookings WHERE status = 'confirmed'
  `).get().total;

  const activeGiftCards = db.prepare(`SELECT COUNT(*) as c FROM gift_cards WHERE status = 'active'`).get().c;

  const recentBookings = db.prepare(`
    SELECT b.*, cs.date, cs.time, e.name as experience_name
    FROM bookings b JOIN calendar_slots cs ON cs.id = b.slot_id JOIN experiences e ON e.id = cs.experience_id
    ORDER BY b.created_at DESC LIMIT 10
  `).all();

  const unreadMessages = db.prepare(`SELECT COUNT(*) as c FROM contact_messages WHERE is_read = 0`).get().c;

  res.json({ todayBookings, upcomingBookings, totalRevenue, activeGiftCards, recentBookings, unreadMessages });
});

// --- BOOKINGS ---
router.get('/bookings', requireAdmin, (req, res) => {
  const bookings = bookingService.getAllBookings(req.query);
  res.json(bookings);
});

router.patch('/bookings/:ref/status', requireAdmin, (req, res) => {
  const { status } = req.body;
  const valid = ['pending', 'confirmed', 'cancelled', 'completed'];
  if (!valid.includes(status)) return res.status(400).json({ error: 'Stato non valido' });
  bookingService.updateBookingStatus(req.params.ref, status);
  res.json({ success: true });
});

// --- CALENDAR ---
router.get('/calendar', requireAdmin, (req, res) => {
  const db = getDb();
  const { month, experience } = req.query;
  let where = '1=1';
  const params = [];
  if (month) { where += ' AND cs.date LIKE ?'; params.push(`${month}%`); }
  if (experience) { where += ' AND e.slug = ?'; params.push(experience); }

  const slots = db.prepare(`
    SELECT cs.*, e.name as experience_name, e.slug as experience_slug,
           COALESCE(SUM(CASE WHEN b.status IN ('pending','confirmed') THEN b.num_sleds ELSE 0 END), 0) as booked_sleds
    FROM calendar_slots cs
    JOIN experiences e ON e.id = cs.experience_id
    LEFT JOIN bookings b ON b.slot_id = cs.id
    WHERE ${where}
    GROUP BY cs.id
    ORDER BY cs.date, cs.time
  `).all(...params);
  res.json(slots);
});

router.post('/calendar/slots', requireAdmin, (req, res) => {
  const { experienceSlug, date, time, maxSleds } = req.body;
  if (!experienceSlug || !date || !time) {
    return res.status(400).json({ error: 'Tutti i campi sono obbligatori' });
  }
  const db = getDb();
  const exp = db.prepare('SELECT id FROM experiences WHERE slug = ?').get(experienceSlug);
  if (!exp) return res.status(404).json({ error: 'Esperienza non trovata' });

  try {
    db.prepare('INSERT INTO calendar_slots (experience_id, date, time, max_sleds) VALUES (?, ?, ?, ?)')
      .run(exp.id, date, time, maxSleds || 6);
    res.json({ success: true });
  } catch (err) {
    if (err.message.includes('UNIQUE')) {
      return res.status(409).json({ error: 'Slot già esistente per questa data e orario' });
    }
    throw err;
  }
});

router.post('/calendar/slots/bulk', requireAdmin, (req, res) => {
  const { experienceSlug, dates, times, maxSleds } = req.body;
  if (!experienceSlug || !dates || !times) {
    return res.status(400).json({ error: 'Tutti i campi sono obbligatori' });
  }
  const db = getDb();
  const exp = db.prepare('SELECT id FROM experiences WHERE slug = ?').get(experienceSlug);
  if (!exp) return res.status(404).json({ error: 'Esperienza non trovata' });

  const insert = db.prepare('INSERT OR IGNORE INTO calendar_slots (experience_id, date, time, max_sleds) VALUES (?, ?, ?, ?)');
  let created = 0;
  db.transaction(() => {
    for (const date of dates) {
      for (const time of times) {
        const r = insert.run(exp.id, date, time, maxSleds || 6);
        if (r.changes) created++;
      }
    }
  })();

  res.json({ success: true, created });
});

router.patch('/calendar/slots/:id', requireAdmin, (req, res) => {
  const { maxSleds, isBlocked, notes } = req.body;
  const db = getDb();
  const sets = [];
  const params = [];
  if (maxSleds !== undefined) { sets.push('max_sleds = ?'); params.push(maxSleds); }
  if (isBlocked !== undefined) { sets.push('is_blocked = ?'); params.push(isBlocked ? 1 : 0); }
  if (notes !== undefined) { sets.push('notes = ?'); params.push(notes); }
  if (sets.length === 0) return res.status(400).json({ error: 'Nessuna modifica' });

  params.push(req.params.id);
  db.prepare(`UPDATE calendar_slots SET ${sets.join(', ')} WHERE id = ?`).run(...params);
  res.json({ success: true });
});

router.delete('/calendar/slots/:id', requireAdmin, (req, res) => {
  const db = getDb();
  const hasBookings = db.prepare(`SELECT COUNT(*) as c FROM bookings WHERE slot_id = ? AND status IN ('pending','confirmed')`).get(req.params.id).c;
  if (hasBookings > 0) {
    return res.status(400).json({ error: 'Impossibile eliminare: ci sono prenotazioni attive' });
  }
  db.prepare('DELETE FROM calendar_slots WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

// --- GALLERY ---
router.get('/gallery', requireAdmin, (req, res) => {
  const db = getDb();
  const images = db.prepare('SELECT * FROM gallery_images ORDER BY sort_order ASC, created_at DESC').all();
  res.json(images);
});

router.post('/gallery/upload', requireAdmin, uploadService.upload.single('image'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Nessun file caricato' });
  try {
    const { filename, originalName } = await uploadService.processAndSave(req.file.buffer, req.file.originalname);
    const db = getDb();
    const maxOrder = db.prepare('SELECT MAX(sort_order) as m FROM gallery_images').get().m || 0;
    db.prepare('INSERT INTO gallery_images (filename, original_name, alt_text, sort_order) VALUES (?, ?, ?, ?)')
      .run(filename, originalName, req.body.altText || '', maxOrder + 1);
    res.json({ success: true, filename });
  } catch (err) {
    console.error('Upload error:', err);
    res.status(500).json({ error: 'Errore nel caricamento' });
  }
});

router.patch('/gallery/:id', requireAdmin, (req, res) => {
  const { altText, sortOrder, isVisible } = req.body;
  const db = getDb();
  const sets = [];
  const params = [];
  if (altText !== undefined) { sets.push('alt_text = ?'); params.push(altText); }
  if (sortOrder !== undefined) { sets.push('sort_order = ?'); params.push(sortOrder); }
  if (isVisible !== undefined) { sets.push('is_visible = ?'); params.push(isVisible ? 1 : 0); }
  if (sets.length === 0) return res.status(400).json({ error: 'Nessuna modifica' });
  params.push(req.params.id);
  db.prepare(`UPDATE gallery_images SET ${sets.join(', ')} WHERE id = ?`).run(...params);
  res.json({ success: true });
});

router.post('/gallery/reorder', requireAdmin, (req, res) => {
  const { order } = req.body; // Array of { id, sortOrder }
  if (!order || !Array.isArray(order)) return res.status(400).json({ error: 'Array order richiesto' });
  const db = getDb();
  const update = db.prepare('UPDATE gallery_images SET sort_order = ? WHERE id = ?');
  db.transaction(() => {
    for (const item of order) {
      update.run(item.sortOrder, item.id);
    }
  })();
  res.json({ success: true });
});

router.delete('/gallery/:id', requireAdmin, (req, res) => {
  const db = getDb();
  const img = db.prepare('SELECT filename FROM gallery_images WHERE id = ?').get(req.params.id);
  if (img) {
    uploadService.deleteFile(img.filename);
    db.prepare('DELETE FROM gallery_images WHERE id = ?').run(req.params.id);
  }
  res.json({ success: true });
});

// --- GIFT CARDS ---
router.get('/giftcards', requireAdmin, (req, res) => {
  const giftCards = giftcardService.getAllGiftCards();
  res.json(giftCards);
});

router.patch('/giftcards/:id/status', requireAdmin, (req, res) => {
  const { status } = req.body;
  const db = getDb();
  db.prepare('UPDATE gift_cards SET status = ? WHERE id = ?').run(status, req.params.id);
  res.json({ success: true });
});

// --- VOUCHERS ---
router.get('/vouchers', requireAdmin, (req, res) => {
  const db = getDb();
  const vouchers = db.prepare('SELECT * FROM vouchers ORDER BY created_at DESC').all();
  res.json(vouchers);
});

router.post('/vouchers', requireAdmin, (req, res) => {
  const { discountType, discountValue, description, maxUses, expiresAt } = req.body;
  if (!discountType || !discountValue) {
    return res.status(400).json({ error: 'Tipo e valore sconto obbligatori' });
  }
  const db = getDb();
  const code = generateVoucherCode();
  db.prepare('INSERT INTO vouchers (code, discount_type, discount_value, description, max_uses, expires_at) VALUES (?, ?, ?, ?, ?, ?)')
    .run(code, discountType, discountValue, description || null, maxUses || 1, expiresAt || null);
  res.json({ success: true, code });
});

router.patch('/vouchers/:id', requireAdmin, (req, res) => {
  const { isActive, maxUses, expiresAt, description } = req.body;
  const db = getDb();
  const sets = [];
  const params = [];
  if (isActive !== undefined) { sets.push('is_active = ?'); params.push(isActive ? 1 : 0); }
  if (maxUses !== undefined) { sets.push('max_uses = ?'); params.push(maxUses); }
  if (expiresAt !== undefined) { sets.push('expires_at = ?'); params.push(expiresAt); }
  if (description !== undefined) { sets.push('description = ?'); params.push(description); }
  if (sets.length === 0) return res.status(400).json({ error: 'Nessuna modifica' });
  params.push(req.params.id);
  db.prepare(`UPDATE vouchers SET ${sets.join(', ')} WHERE id = ?`).run(...params);
  res.json({ success: true });
});

router.delete('/vouchers/:id', requireAdmin, (req, res) => {
  const db = getDb();
  db.prepare('DELETE FROM vouchers WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

// --- CONTACTS ---
router.get('/contacts', requireAdmin, (req, res) => {
  const db = getDb();
  const messages = db.prepare('SELECT * FROM contact_messages ORDER BY created_at DESC').all();
  res.json(messages);
});

router.patch('/contacts/:id/read', requireAdmin, (req, res) => {
  const db = getDb();
  db.prepare('UPDATE contact_messages SET is_read = 1 WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

// --- EXPERIENCES ---
router.get('/experiences', requireAdmin, (req, res) => {
  const db = getDb();
  res.json(db.prepare('SELECT * FROM experiences').all());
});

router.patch('/experiences/:id', requireAdmin, (req, res) => {
  const { name, duration, priceCents, maxSleds, description, isActive } = req.body;
  const db = getDb();
  const sets = [];
  const params = [];
  if (name !== undefined) { sets.push('name = ?'); params.push(name); }
  if (duration !== undefined) { sets.push('duration = ?'); params.push(duration); }
  if (priceCents !== undefined) { sets.push('price_cents = ?'); params.push(priceCents); }
  if (maxSleds !== undefined) { sets.push('max_sleds = ?'); params.push(maxSleds); }
  if (description !== undefined) { sets.push('description = ?'); params.push(description); }
  if (isActive !== undefined) { sets.push('is_active = ?'); params.push(isActive ? 1 : 0); }
  if (sets.length === 0) return res.status(400).json({ error: 'Nessuna modifica' });
  params.push(req.params.id);
  db.prepare(`UPDATE experiences SET ${sets.join(', ')} WHERE id = ?`).run(...params);
  res.json({ success: true });
});

module.exports = router;
