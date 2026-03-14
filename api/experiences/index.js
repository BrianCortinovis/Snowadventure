const { supabase } = require('../_lib/supabase');

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const { data, error } = await supabase
    .from('experiences')
    .select('*')
    .eq('is_active', true);

  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
};
