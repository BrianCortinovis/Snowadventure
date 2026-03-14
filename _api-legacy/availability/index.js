const { supabase } = require('../_lib/supabase');

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const { experience, month } = req.query;
  if (!experience || !month) {
    return res.status(400).json({ error: 'Parametri experience e month richiesti' });
  }

  // Get experience
  const { data: exp } = await supabase
    .from('experiences')
    .select('id')
    .eq('slug', experience)
    .single();

  if (!exp) return res.json([]);

  // Get slots for month
  const startDate = `${month}-01`;
  const [year, mon] = month.split('-').map(Number);
  const endDate = `${year}-${String(mon + 1).padStart(2, '0')}-01`;

  const { data: slots, error } = await supabase
    .from('calendar_slots')
    .select('id, date, time, max_sleds, is_blocked, notes')
    .eq('experience_id', exp.id)
    .eq('is_blocked', false)
    .gte('date', startDate)
    .lt('date', endDate)
    .order('date')
    .order('time');

  if (error) return res.status(500).json({ error: error.message });

  // Get bookings count for each slot
  const slotIds = slots.map(s => s.id);
  const { data: bookings } = await supabase
    .from('bookings')
    .select('slot_id, num_sleds')
    .in('slot_id', slotIds.length ? slotIds : ['00000000-0000-0000-0000-000000000000'])
    .in('status', ['pending', 'confirmed']);

  // Sum booked sleds per slot
  const bookedMap = {};
  (bookings || []).forEach(b => {
    bookedMap[b.slot_id] = (bookedMap[b.slot_id] || 0) + b.num_sleds;
  });

  const result = slots.map(s => ({
    id: s.id,
    date: s.date,
    time: s.time,
    maxSleds: s.max_sleds,
    bookedSleds: bookedMap[s.id] || 0,
    availableSleds: s.max_sleds - (bookedMap[s.id] || 0),
    notes: s.notes,
  }));

  res.json(result);
};
