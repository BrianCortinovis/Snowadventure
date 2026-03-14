const { supabase } = require('../_lib/supabase');

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const { data, error } = await supabase
    .from('gallery_images')
    .select('id, filename, url, alt_text, sort_order')
    .eq('is_visible', true)
    .order('sort_order')
    .order('created_at', { ascending: false });

  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
};
