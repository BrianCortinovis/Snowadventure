const express = require('express');
const router = express.Router();
const giftcardService = require('../../services/giftcard.service');

// POST /api/giftcards/purchase
router.post('/purchase', (req, res) => {
  const { experienceSlug, amountCents, purchaserNome, purchaserCognome, purchaserEmail, recipientName, recipientEmail, personalMessage, paymentMethod } = req.body;

  if (!amountCents || !purchaserNome || !purchaserCognome || !purchaserEmail) {
    return res.status(400).json({ error: 'Compila tutti i campi obbligatori' });
  }

  try {
    const gc = giftcardService.createGiftCard({
      experienceSlug, amountCents, purchaserNome, purchaserCognome, purchaserEmail,
      recipientName, recipientEmail, personalMessage, paymentMethod,
    });
    res.json(gc);
  } catch (err) {
    console.error('Gift card error:', err);
    res.status(500).json({ error: 'Errore nella creazione della gift card' });
  }
});

// GET /api/giftcards/validate/:code
router.get('/validate/:code', (req, res) => {
  const gc = giftcardService.validateGiftCard(req.params.code);
  if (!gc) return res.status(404).json({ error: 'Gift card non valida o scaduta' });
  res.json(gc);
});

module.exports = router;
