const express = require('express');
const router = express.Router();
const { getDb } = require('../../db');
const emailService = require('../../services/email.service');

// POST /api/contact
router.post('/', async (req, res) => {
  const { nome, cognome, email, phone, message, privacyConsent } = req.body;

  if (!nome || !cognome || !email || !message) {
    return res.status(400).json({ error: 'Compila tutti i campi obbligatori' });
  }
  if (!privacyConsent) {
    return res.status(400).json({ error: 'Il consenso al trattamento dei dati è obbligatorio' });
  }

  const db = getDb();
  db.prepare('INSERT INTO contact_messages (nome, cognome, email, phone, message, privacy_consent) VALUES (?, ?, ?, ?, ?, ?)')
    .run(nome, cognome, email, phone || null, message, 1);

  await emailService.sendContactNotification({ nome, cognome, email, phone, message });

  res.json({ success: true, message: 'Messaggio inviato con successo' });
});

module.exports = router;
