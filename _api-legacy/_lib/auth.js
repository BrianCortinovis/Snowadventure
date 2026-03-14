const { createClient } = require('@supabase/supabase-js');

async function verifyAdmin(req) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;

  const token = authHeader.split(' ')[1];
  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_ANON_KEY
  );

  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) return null;
  return user;
}

function unauthorized(res) {
  return res.status(401).json({ error: 'Non autorizzato' });
}

module.exports = { verifyAdmin, unauthorized };
