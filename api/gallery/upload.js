const { supabase } = require('../_lib/supabase');
const { verifyAdmin, unauthorized } = require('../_lib/auth');
const formidable = require('formidable');
const fs = require('fs');

module.exports.config = { api: { bodyParser: false } };

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const user = await verifyAdmin(req);
  if (!user) return unauthorized(res);

  const form = formidable({ maxFileSize: 10 * 1024 * 1024 });

  try {
    const [fields, files] = await form.parse(req);
    const file = files.image?.[0];
    if (!file) return res.status(400).json({ error: 'Nessun file caricato' });

    const fileBuffer = fs.readFileSync(file.filepath);
    const fileName = `${Date.now()}-${file.originalFilename.replace(/[^a-zA-Z0-9.-]/g, '_')}`;

    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('gallery')
      .upload(fileName, fileBuffer, {
        contentType: file.mimetype,
        upsert: false,
      });

    if (uploadError) {
      console.error('Upload error:', uploadError);
      return res.status(500).json({ error: 'Errore nel caricamento' });
    }

    const { data: { publicUrl } } = supabase.storage
      .from('gallery')
      .getPublicUrl(fileName);

    // Get max sort order
    const { data: maxOrder } = await supabase
      .from('gallery_images')
      .select('sort_order')
      .order('sort_order', { ascending: false })
      .limit(1)
      .single();

    await supabase.from('gallery_images').insert({
      filename: file.originalFilename,
      storage_path: uploadData.path,
      url: publicUrl,
      alt_text: fields.altText?.[0] || '',
      sort_order: (maxOrder?.sort_order || 0) + 1,
    });

    res.json({ success: true, url: publicUrl });
  } catch (err) {
    console.error('Upload handler error:', err);
    res.status(500).json({ error: 'Errore nel caricamento' });
  }
};
