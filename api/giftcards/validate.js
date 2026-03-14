const { supabase } = require('../_lib/supabase');

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const { code } = req.query;
  if (!code) return res.status(400).json({ error: 'Codice richiesto' });

  const { data: gc } = await supabase
    .from('gift_cards')
    .select('code, amount_cents, experience_slug, expires_at')
    .eq('code', code)
    .eq('status', 'active')
    .gt('expires_at', new Date().toISOString())
    .single();

  if (!gc) return res.status(404).json({ error: 'Gift card non valida o scaduta' });

  res.json({
    code: gc.code,
    amountCents: gc.amount_cents,
    experienceSlug: gc.experience_slug,
    expiresAt: gc.expires_at,
  });
};
