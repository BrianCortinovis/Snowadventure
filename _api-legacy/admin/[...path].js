const { supabase } = require('../_lib/supabase');
const { verifyAdmin, unauthorized } = require('../_lib/auth');
const { generateVoucherCode } = require('../_lib/codes');

module.exports = async function handler(req, res) {
  // All admin routes require auth
  const user = await verifyAdmin(req);
  if (!user) return unauthorized(res);

  const pathParts = req.query.path || [];
  const route = pathParts.join('/');

  try {
    // --- DASHBOARD ---
    if (route === 'dashboard' && req.method === 'GET') {
      const today = new Date().toISOString().slice(0, 10);

      const [todayRes, upcomingRes, revenueRes, gcRes, msgsRes, recentRes] = await Promise.all([
        supabase.from('bookings').select('id', { count: 'exact', head: true })
          .in('status', ['confirmed', 'pending'])
          .eq('calendar_slots.date', today),
        supabase.from('bookings').select('id', { count: 'exact', head: true })
          .eq('status', 'confirmed'),
        supabase.from('bookings').select('amount_cents, discount_cents')
          .eq('status', 'confirmed'),
        supabase.from('gift_cards').select('id', { count: 'exact', head: true })
          .eq('status', 'active'),
        supabase.from('contact_messages').select('id', { count: 'exact', head: true })
          .eq('is_read', false),
        supabase.from('bookings')
          .select('*, calendar_slots(date, time, experiences(name))')
          .order('created_at', { ascending: false })
          .limit(10),
      ]);

      const totalRevenue = (revenueRes.data || []).reduce((sum, b) => sum + b.amount_cents - b.discount_cents, 0);

      return res.json({
        todayBookings: todayRes.count || 0,
        upcomingBookings: upcomingRes.count || 0,
        totalRevenue,
        activeGiftCards: gcRes.count || 0,
        unreadMessages: msgsRes.count || 0,
        recentBookings: (recentRes.data || []).map(b => ({
          ...b,
          date: b.calendar_slots?.date,
          time: b.calendar_slots?.time,
          experience_name: b.calendar_slots?.experiences?.name,
        })),
      });
    }

    // --- BOOKINGS ---
    if (route === 'bookings' && req.method === 'GET') {
      let query = supabase.from('bookings')
        .select('*, calendar_slots(date, time, experiences(name, slug))')
        .order('created_at', { ascending: false });

      if (req.query.status) query = query.eq('status', req.query.status);
      if (req.query.experience) {
        // Filter by experience slug via join
      }

      const { data } = await query;
      return res.json((data || []).map(b => ({
        ...b,
        date: b.calendar_slots?.date,
        time: b.calendar_slots?.time,
        experience_name: b.calendar_slots?.experiences?.name,
        experience_slug: b.calendar_slots?.experiences?.slug,
      })));
    }

    // PATCH bookings/:ref/status
    if (pathParts[0] === 'bookings' && pathParts[2] === 'status' && req.method === 'PATCH') {
      const ref = pathParts[1];
      const { status } = req.body;
      const valid = ['pending', 'confirmed', 'cancelled', 'completed'];
      if (!valid.includes(status)) return res.status(400).json({ error: 'Stato non valido' });
      await supabase.from('bookings').update({ status }).eq('booking_ref', ref);
      return res.json({ success: true });
    }

    // --- CALENDAR ---
    if (route === 'calendar' && req.method === 'GET') {
      let query = supabase.from('calendar_slots')
        .select('*, experiences(name, slug)')
        .order('date')
        .order('time');

      if (req.query.month) {
        const startDate = `${req.query.month}-01`;
        const [year, mon] = req.query.month.split('-').map(Number);
        const endDate = mon === 12 ? `${year + 1}-01-01` : `${year}-${String(mon + 1).padStart(2, '0')}-01`;
        query = query.gte('date', startDate).lt('date', endDate);
      }
      if (req.query.experience) {
        const { data: exp } = await supabase.from('experiences').select('id').eq('slug', req.query.experience).single();
        if (exp) query = query.eq('experience_id', exp.id);
      }

      const { data: slots } = await query;

      // Get booking counts
      const slotIds = (slots || []).map(s => s.id);
      const { data: bookings } = await supabase.from('bookings')
        .select('slot_id, num_sleds')
        .in('slot_id', slotIds.length ? slotIds : ['00000000-0000-0000-0000-000000000000'])
        .in('status', ['pending', 'confirmed']);

      const bookedMap = {};
      (bookings || []).forEach(b => {
        bookedMap[b.slot_id] = (bookedMap[b.slot_id] || 0) + b.num_sleds;
      });

      return res.json((slots || []).map(s => ({
        ...s,
        experience_name: s.experiences?.name,
        experience_slug: s.experiences?.slug,
        booked_sleds: bookedMap[s.id] || 0,
      })));
    }

    // POST calendar/slots
    if (route === 'calendar/slots' && req.method === 'POST') {
      const { experienceSlug, date, time, maxSleds } = req.body;
      const { data: exp } = await supabase.from('experiences').select('id').eq('slug', experienceSlug).single();
      if (!exp) return res.status(404).json({ error: 'Esperienza non trovata' });

      const { error } = await supabase.from('calendar_slots').insert({
        experience_id: exp.id, date, time, max_sleds: maxSleds || 6,
      });
      if (error) {
        if (error.code === '23505') return res.status(409).json({ error: 'Slot già esistente' });
        return res.status(500).json({ error: error.message });
      }
      return res.json({ success: true });
    }

    // POST calendar/slots/bulk
    if (route === 'calendar/slots/bulk' && req.method === 'POST') {
      const { experienceSlug, dates, times, maxSleds } = req.body;
      const { data: exp } = await supabase.from('experiences').select('id').eq('slug', experienceSlug).single();
      if (!exp) return res.status(404).json({ error: 'Esperienza non trovata' });

      const rows = [];
      for (const date of dates) {
        for (const time of times) {
          rows.push({ experience_id: exp.id, date, time, max_sleds: maxSleds || 6 });
        }
      }

      const { data, error } = await supabase.from('calendar_slots').upsert(rows, { onConflict: 'experience_id,date,time', ignoreDuplicates: true });
      return res.json({ success: true, created: rows.length });
    }

    // PATCH calendar/slots/:id
    if (pathParts[0] === 'calendar' && pathParts[1] === 'slots' && pathParts[2] && req.method === 'PATCH') {
      const id = pathParts[2];
      const updates = {};
      if (req.body.maxSleds !== undefined) updates.max_sleds = req.body.maxSleds;
      if (req.body.isBlocked !== undefined) updates.is_blocked = req.body.isBlocked;
      if (req.body.notes !== undefined) updates.notes = req.body.notes;
      await supabase.from('calendar_slots').update(updates).eq('id', id);
      return res.json({ success: true });
    }

    // DELETE calendar/slots/:id
    if (pathParts[0] === 'calendar' && pathParts[1] === 'slots' && pathParts[2] && req.method === 'DELETE') {
      const id = pathParts[2];
      const { count } = await supabase.from('bookings').select('id', { count: 'exact', head: true })
        .eq('slot_id', id).in('status', ['pending', 'confirmed']);
      if (count > 0) return res.status(400).json({ error: 'Impossibile eliminare: ci sono prenotazioni attive' });
      await supabase.from('calendar_slots').delete().eq('id', id);
      return res.json({ success: true });
    }

    // --- GALLERY ---
    if (route === 'gallery' && req.method === 'GET') {
      const { data } = await supabase.from('gallery_images').select('*').order('sort_order').order('created_at', { ascending: false });
      return res.json(data || []);
    }

    // PATCH gallery/:id
    if (pathParts[0] === 'gallery' && pathParts[1] && req.method === 'PATCH') {
      const id = pathParts[1];
      const updates = {};
      if (req.body.altText !== undefined) updates.alt_text = req.body.altText;
      if (req.body.sortOrder !== undefined) updates.sort_order = req.body.sortOrder;
      if (req.body.isVisible !== undefined) updates.is_visible = req.body.isVisible;
      await supabase.from('gallery_images').update(updates).eq('id', id);
      return res.json({ success: true });
    }

    // POST gallery/reorder
    if (route === 'gallery/reorder' && req.method === 'POST') {
      const { order } = req.body;
      for (const item of order) {
        await supabase.from('gallery_images').update({ sort_order: item.sortOrder }).eq('id', item.id);
      }
      return res.json({ success: true });
    }

    // DELETE gallery/:id
    if (pathParts[0] === 'gallery' && pathParts[1] && req.method === 'DELETE') {
      const id = pathParts[1];
      const { data: img } = await supabase.from('gallery_images').select('storage_path').eq('id', id).single();
      if (img) {
        await supabase.storage.from('gallery').remove([img.storage_path]);
        await supabase.from('gallery_images').delete().eq('id', id);
      }
      return res.json({ success: true });
    }

    // --- GIFT CARDS ---
    if (route === 'giftcards' && req.method === 'GET') {
      const { data } = await supabase.from('gift_cards').select('*').order('created_at', { ascending: false });
      return res.json(data || []);
    }

    // PATCH giftcards/:id/status
    if (pathParts[0] === 'giftcards' && pathParts[2] === 'status' && req.method === 'PATCH') {
      await supabase.from('gift_cards').update({ status: req.body.status }).eq('id', pathParts[1]);
      return res.json({ success: true });
    }

    // --- VOUCHERS ---
    if (route === 'vouchers' && req.method === 'GET') {
      const { data } = await supabase.from('vouchers').select('*').order('created_at', { ascending: false });
      return res.json(data || []);
    }

    if (route === 'vouchers' && req.method === 'POST') {
      const { discountType, discountValue, description, maxUses, expiresAt } = req.body;
      const code = generateVoucherCode();
      await supabase.from('vouchers').insert({
        code, discount_type: discountType, discount_value: discountValue,
        description: description || null, max_uses: maxUses || 1, expires_at: expiresAt || null,
      });
      return res.json({ success: true, code });
    }

    // PATCH vouchers/:id
    if (pathParts[0] === 'vouchers' && pathParts[1] && req.method === 'PATCH') {
      const updates = {};
      if (req.body.isActive !== undefined) updates.is_active = req.body.isActive;
      if (req.body.maxUses !== undefined) updates.max_uses = req.body.maxUses;
      if (req.body.expiresAt !== undefined) updates.expires_at = req.body.expiresAt;
      if (req.body.description !== undefined) updates.description = req.body.description;
      await supabase.from('vouchers').update(updates).eq('id', pathParts[1]);
      return res.json({ success: true });
    }

    // DELETE vouchers/:id
    if (pathParts[0] === 'vouchers' && pathParts[1] && req.method === 'DELETE') {
      await supabase.from('vouchers').delete().eq('id', pathParts[1]);
      return res.json({ success: true });
    }

    // --- CONTACTS ---
    if (route === 'contacts' && req.method === 'GET') {
      const { data } = await supabase.from('contact_messages').select('*').order('created_at', { ascending: false });
      return res.json(data || []);
    }

    // PATCH contacts/:id/read
    if (pathParts[0] === 'contacts' && pathParts[2] === 'read' && req.method === 'PATCH') {
      await supabase.from('contact_messages').update({ is_read: true }).eq('id', pathParts[1]);
      return res.json({ success: true });
    }

    // --- EXPERIENCES ---
    if (route === 'experiences' && req.method === 'GET') {
      const { data } = await supabase.from('experiences').select('*');
      return res.json(data || []);
    }

    // PATCH experiences/:id
    if (pathParts[0] === 'experiences' && pathParts[1] && req.method === 'PATCH') {
      const updates = {};
      if (req.body.name !== undefined) updates.name = req.body.name;
      if (req.body.duration !== undefined) updates.duration = req.body.duration;
      if (req.body.priceCents !== undefined) updates.price_cents = req.body.priceCents;
      if (req.body.maxSleds !== undefined) updates.max_sleds = req.body.maxSleds;
      if (req.body.description !== undefined) updates.description = req.body.description;
      if (req.body.isActive !== undefined) updates.is_active = req.body.isActive;
      await supabase.from('experiences').update(updates).eq('id', pathParts[1]);
      return res.json({ success: true });
    }

    return res.status(404).json({ error: 'Route non trovata' });
  } catch (err) {
    console.error('Admin API error:', err);
    return res.status(500).json({ error: 'Errore del server' });
  }
};
