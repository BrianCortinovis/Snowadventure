const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

// Service role client - bypasses RLS, for server-side operations
const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Anon client - respects RLS
const supabasePublic = createClient(supabaseUrl, supabaseAnonKey);

module.exports = { supabase, supabasePublic };
