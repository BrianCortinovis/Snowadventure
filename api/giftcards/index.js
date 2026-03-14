const { supabase } = require('../_lib/supabase');
const { generateGiftCardCode } = require('../_lib/codes');

module.exports = async function handler(req, res) {
  if (req.method === 'POST') return purchaseGiftCard(req, res);
  return res.status(405).json({ error: 'Method not allowed' });
};

async function purchaseGiftCard(req, res) {
  const { experienceSlug, amountCents, purchaserNome, purchaserCognome, purchaserEmail, recipientName, recipientEmail, personalMessage, paymentMethod } = req.body;

  if (!amountCents || !purchaserNome || !purchaserCognome || !purchaserEmail) {
    return res.status(400).json({ error: 'Compila tutti i campi obbligatori' });
  }

  const code = generateGiftCardCode();
  const expiresAt = new Date();
  expiresAt.setFullYear(expiresAt.getFullYear() + 1);

  const { data, error } = await supabase
    .from('gift_cards')
    .insert({
      code,
      experience_slug: experienceSlug || null,
      amount_cents: amountCents,
      purchaser_nome: purchaserNome,
      purchaser_cognome: purchaserCognome,
      purchaser_email: purchaserEmail,
      recipient_name: recipientName || null,
      recipient_email: recipientEmail || null,
      personal_message: personalMessage || null,
      payment_method: paymentMethod || null,
      expires_at: expiresAt.toISOString(),
    })
    .select()
    .single();

  if (error) {
    console.error('Gift card error:', error);
    return res.status(500).json({ error: 'Errore nella creazione della gift card' });
  }

  res.json({ code, amountCents, expiresAt: expiresAt.toISOString() });
}
