const { supabase } = require('../_lib/supabase');
const { sendContactNotification } = require('../_lib/email');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { nome, cognome, email, phone, message, privacyConsent } = req.body;

  if (!nome || !cognome || !email || !message) {
    return res.status(400).json({ error: 'Compila tutti i campi obbligatori' });
  }
  if (!privacyConsent) {
    return res.status(400).json({ error: 'Il consenso al trattamento dei dati è obbligatorio' });
  }

  const { error } = await supabase
    .from('contact_messages')
    .insert({ nome, cognome, email, phone: phone || null, message, privacy_consent: true });

  if (error) return res.status(500).json({ error: error.message });

  await sendContactNotification({ nome, cognome, email, phone, message });

  res.json({ success: true, message: 'Messaggio inviato con successo' });
};
