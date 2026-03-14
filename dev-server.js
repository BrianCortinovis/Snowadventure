// Local dev server - fully functional in-memory demo
// Usage: node dev-server.js
// All data is stored in memory + uploads saved to public/uploads/

const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const PORT = 3000;

const MIME_TYPES = {
  '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript',
  '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml',
  '.mp4': 'video/mp4', '.webm': 'video/webm', '.woff2': 'font/woff2', '.ico': 'image/x-icon'
};

// Load .env if exists
try {
  const envFile = fs.readFileSync(path.join(__dirname, '.env'), 'utf8');
  envFile.split('\n').forEach(line => {
    line = line.trim();
    if (!line || line.startsWith('#')) return;
    const [key, ...vals] = line.split('=');
    process.env[key.trim()] = vals.join('=').trim();
  });
  console.log('✓ .env loaded');
} catch (e) {
  console.log('⚠ No .env file found - running in full demo mode');
}

const DEMO_MODE = !process.env.SUPABASE_URL || process.env.SUPABASE_URL.includes('xxxxx');
if (DEMO_MODE) console.log('🎮 DEMO MODE — Tutto funzionante in locale con dati in memoria');

// Ensure uploads directory exists
const UPLOADS_DIR = path.join(__dirname, 'public', 'uploads');
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });

// --- IN-MEMORY DATA STORE ---
function uid() { return crypto.randomUUID(); }
function genApiKey() { return 'sa_partner_' + crypto.randomBytes(24).toString('hex'); }

const DB = {
  experiences: [
    { id: uid(), name: 'Orobic Sunset Tour', slug: 'sunset', description: 'Escursione al tramonto in motoslitta fino a 2.200m con aperitivo in quota nelle Alpi Orobie.', duration: '2 ore', price_cents: 9500, max_sleds: 8, photo_url: 'images/homepage_img_8.jpeg', is_active: true, is_default: true, sort_order: 1 },
    { id: uid(), name: 'Night Tour Adventure', slug: 'night', description: 'Escursione notturna in motoslitta con cena tipica in quota nelle Alpi Orobie.', duration: '3 ore', price_cents: 12000, max_sleds: 8, photo_url: 'images/homepage_img_9.jpeg', is_active: true, is_default: true, sort_order: 2 },
    { id: uid(), name: 'Private Freeride Ski Shuttle', slug: 'freeride', description: 'Servizio privato di shuttle in motoslitta per il freeride nella Val Carisole.', duration: '1.5 ore', price_cents: 0, max_sleds: 4, photo_url: 'images/slitta-3_img_6.jpeg', is_active: true, is_default: true, sort_order: 3 },
    { id: uid(), name: 'Family Snow Experience', slug: 'family', description: "Un'avventura sulla neve pensata per tutta la famiglia, con percorso facile e sosta merenda.", duration: '1.5 ore', price_cents: 7500, max_sleds: 6, photo_url: 'images/gallery_img_14.jpg', is_active: true, is_default: false, sort_order: 4 },
    { id: uid(), name: 'Corporate Team Building', slug: 'corporate', description: 'Esperienza esclusiva per aziende: motoslitte, aperitivo e attività di team building sulla neve.', duration: '4 ore', price_cents: 25000, max_sleds: 10, photo_url: 'images/homepage_img_12.jpeg', is_active: true, is_default: false, sort_order: 5 },
  ],
  bookings: [
    { id: uid(), booking_ref: 'SA-DEMO-0001', experience_slug: 'sunset', experience_name: 'Orobic Sunset Tour', date: '2026-03-14', time: '17:00', nome: 'Mario', cognome: 'Rossi', email: 'mario@test.it', phone: '+39 333 1111111', num_sleds: 2, num_people: 4, amount_cents: 19000, discount_cents: 0, status: 'confirmed', partner_id: null, created_at: '2026-03-10' },
    { id: uid(), booking_ref: 'SA-DEMO-0002', experience_slug: 'night', experience_name: 'Night Tour Adventure', date: '2026-03-15', time: '20:00', nome: 'Lucia', cognome: 'Bianchi', email: 'lucia@test.it', phone: '+39 333 2222222', num_sleds: 1, num_people: 2, amount_cents: 12000, discount_cents: 0, status: 'pending', partner_id: null, created_at: '2026-03-11' },
    { id: uid(), booking_ref: 'SA-DEMO-0003', experience_slug: 'freeride', experience_name: 'Private Freeride Ski Shuttle', date: '2026-03-16', time: '09:00', nome: 'Paolo', cognome: 'Verdi', email: 'paolo@test.it', phone: '', num_sleds: 3, num_people: 6, amount_cents: 30000, discount_cents: 5000, status: 'confirmed', partner_id: null, created_at: '2026-03-09' },
  ],
  slots: [], // Will be generated
  gallery: [],
  giftcards: [
    { id: uid(), code: 'GIFT-ABC123', amount_cents: 9500, purchaser_nome: 'Anna', purchaser_cognome: 'Neri', recipient_name: 'Marco Neri', status: 'active', expires_at: '2026-12-31', created_at: '2026-02-14' },
    { id: uid(), code: 'GIFT-XYZ789', amount_cents: 12000, purchaser_nome: 'Francesca', purchaser_cognome: 'Colombo', recipient_name: 'Luca Colombo', status: 'active', expires_at: '2026-12-31', created_at: '2026-03-01' },
  ],
  vouchers: [
    { id: uid(), code: 'SCONTO10', discount_type: 'percentage', discount_value: 10, description: 'Sconto 10% hotel partner', times_used: 3, max_uses: 50, expires_at: '2026-06-30', is_active: true },
    { id: uid(), code: 'WELCOME20', discount_type: 'fixed', discount_value: 2000, description: 'Sconto 20€ benvenuto', times_used: 0, max_uses: 10, expires_at: '2026-12-31', is_active: true },
  ],
  contacts: [
    { id: uid(), created_at: '2026-03-10', nome: 'Giulia', cognome: 'Ferrari', email: 'giulia@test.it', phone: '+39 333 1234567', message: 'Vorrei informazioni sulle escursioni per un gruppo di 8 persone.', is_read: false },
    { id: uid(), created_at: '2026-03-08', nome: 'Roberto', cognome: 'Conti', email: 'roberto@test.it', phone: '', message: 'Potete organizzare un tour privato per un compleanno?', is_read: true },
  ],
  partners: [
    { id: uid(), name: 'Hotel Cristallo', company: 'Hotel Cristallo Foppolo', email: 'info@hotelcristallo.it', api_key: genApiKey(), commission_pct: 15, custom_pricing: {}, allowed_experiences: [], is_active: true, notes: 'Partner storico, stagione 2025-2026', created_at: '2025-11-01' },
    { id: uid(), name: 'Rifugio Montano', company: 'Rifugio Montano SRL', email: 'booking@rifugiomontano.it', api_key: genApiKey(), commission_pct: 10, custom_pricing: {}, allowed_experiences: [], is_active: true, notes: 'Solo Sunset e Night', created_at: '2025-12-15' },
  ],
};

// Generate initial calendar slots
function generateInitialSlots() {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth(); // 0-based
  DB.experiences.forEach(exp => {
    const times = exp.slug === 'freeride' ? ['09:00','14:00'] : exp.slug === 'sunset' ? ['16:00','17:00'] : ['20:00','21:00'];
    for (let m = month; m <= month + 2; m++) {
      const y = m > 11 ? year + 1 : year;
      const mo = (m % 12) + 1;
      const daysInMonth = new Date(y, mo, 0).getDate();
      for (let d = 1; d <= daysInMonth; d++) {
        const dow = new Date(y, mo - 1, d).getDay();
        if (dow === 0 || dow === 2) continue; // skip Sun, Wed
        const dateStr = `${y}-${String(mo).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
        times.forEach(time => {
          DB.slots.push({
            id: uid(), experience_slug: exp.slug, experience_name: exp.name,
            date: dateStr, time, max_sleds: exp.max_sleds,
            booked_sleds: Math.floor(Math.random() * 3), is_blocked: false, notes: ''
          });
        });
      }
    }
  });
}
generateInitialSlots();

let bookingCounter = 3;

// --- MULTIPART PARSER (simple, for file uploads) ---
function parseMultipart(buffer, contentType) {
  const boundary = contentType.split('boundary=')[1];
  if (!boundary) return { fields: {}, files: [] };
  const parts = [];
  const boundaryBuf = Buffer.from('--' + boundary);
  let start = buffer.indexOf(boundaryBuf) + boundaryBuf.length + 2; // skip first boundary + \r\n
  while (true) {
    const end = buffer.indexOf(boundaryBuf, start);
    if (end === -1) break;
    parts.push(buffer.slice(start, end - 2)); // -2 for \r\n before boundary
    start = end + boundaryBuf.length;
    if (buffer[start] === 0x2D && buffer[start + 1] === 0x2D) break; // -- = end
    start += 2; // skip \r\n
  }
  const fields = {};
  const files = [];
  for (const part of parts) {
    const headerEnd = part.indexOf('\r\n\r\n');
    if (headerEnd === -1) continue;
    const headers = part.slice(0, headerEnd).toString();
    const body = part.slice(headerEnd + 4);
    const nameMatch = headers.match(/name="([^"]+)"/);
    const filenameMatch = headers.match(/filename="([^"]+)"/);
    if (!nameMatch) continue;
    if (filenameMatch) {
      const ctMatch = headers.match(/Content-Type:\s*(.+)/i);
      files.push({ fieldname: nameMatch[1], filename: filenameMatch[1], data: body, mimetype: ctMatch ? ctMatch[1].trim() : 'application/octet-stream' });
    } else {
      fields[nameMatch[1]] = body.toString().trim();
    }
  }
  return { fields, files };
}

// --- SERVER ---
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);

  if (req.method === 'OPTIONS') {
    res.writeHead(204, { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type,Authorization,X-API-Key' });
    res.end();
    return;
  }

  // --- API ROUTES ---
  if (DEMO_MODE && url.pathname.startsWith('/api/')) {
    const apiPath = url.pathname;
    const query = Object.fromEntries(url.searchParams);

    // Collect raw body
    const chunks = [];
    await new Promise(resolve => { req.on('data', c => chunks.push(c)); req.on('end', resolve); });
    const rawBody = Buffer.concat(chunks);
    const bodyStr = rawBody.toString();
    const contentType = req.headers['content-type'] || '';
    const isMultipart = contentType.includes('multipart/form-data');
    const jsonBody = (!isMultipart && bodyStr) ? tryParseJSON(bodyStr) : {};

    const sendJSON = (data, status = 200) => {
      res.writeHead(status, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
      res.end(JSON.stringify(data));
    };

    // ========== PUBLIC API ==========

    // /api/config
    if (apiPath === '/api/config') return sendJSON({ supabaseUrl: 'demo', supabaseAnonKey: 'demo' });

    // /api/experiences (public catalog)
    if (apiPath === '/api/experiences') {
      return sendJSON(DB.experiences.filter(e => e.is_active).sort((a,b) => (a.sort_order||0) - (b.sort_order||0)));
    }

    // /api/availability
    if (apiPath === '/api/availability') {
      const filtered = DB.slots.filter(s =>
        s.experience_slug === (query.experience || 'sunset') &&
        !s.is_blocked &&
        (s.max_sleds - s.booked_sleds) > 0
      );
      if (query.month) {
        return sendJSON(filtered.filter(s => s.date.startsWith(query.month)));
      }
      return sendJSON(filtered);
    }

    // /api/bookings POST
    if (apiPath === '/api/bookings' && req.method === 'POST') {
      bookingCounter++;
      const ref = `SA-${new Date().toISOString().slice(0,10).replace(/-/g,'')}-${String(bookingCounter).padStart(4,'0')}`;
      const exp = DB.experiences.find(e => e.slug === jsonBody.experienceSlug);
      const booking = {
        id: uid(), booking_ref: ref, experience_slug: jsonBody.experienceSlug,
        experience_name: exp ? exp.name : jsonBody.experienceSlug,
        date: jsonBody.date, time: jsonBody.time,
        nome: jsonBody.nome, cognome: jsonBody.cognome, email: jsonBody.email, phone: jsonBody.phone || '',
        num_sleds: jsonBody.numSleds || 1, num_people: jsonBody.numPeople || 2,
        amount_cents: (jsonBody.numSleds || 1) * (exp ? exp.price_cents : 0),
        discount_cents: 0, status: 'pending', partner_id: null,
        created_at: new Date().toISOString().slice(0, 10)
      };
      DB.bookings.push(booking);
      console.log(`📋 Booking: ${booking.nome} ${booking.cognome} - ${ref}`);
      return sendJSON({ bookingRef: ref, paymentRequired: true });
    }

    // /api/payments/create-session POST
    if (apiPath === '/api/payments/create-session' && req.method === 'POST') {
      console.log(`💳 Payment: ${jsonBody.method} for ${jsonBody.bookingRef}`);
      const booking = DB.bookings.find(b => b.booking_ref === jsonBody.bookingRef);
      if (booking) booking.status = 'confirmed';
      return sendJSON({ redirectUrl: '/booking-success.html?ref=' + jsonBody.bookingRef + '&demo=1' });
    }

    // /api/giftcards/validate
    if (apiPath === '/api/giftcards/validate') {
      const gc = DB.giftcards.find(g => g.code === query.code && g.status === 'active');
      if (gc) return sendJSON({ amountCents: gc.amount_cents, code: gc.code });
      return sendJSON({ error: 'Codice non valido' }, 404);
    }

    // /api/gallery (public)
    if (apiPath === '/api/gallery') return sendJSON(DB.gallery.filter(g => g.is_visible));

    // /api/contact POST
    if (apiPath === '/api/contact' && req.method === 'POST') {
      DB.contacts.unshift({ id: uid(), created_at: new Date().toISOString().slice(0,10), nome: jsonBody.nome, cognome: jsonBody.cognome, email: jsonBody.email, phone: jsonBody.phone || '', message: jsonBody.message, is_read: false });
      console.log(`✉️ Contact: ${jsonBody.email}`);
      return sendJSON({ success: true });
    }

    // ========== GALLERY UPLOAD ==========
    if (apiPath === '/api/gallery/upload' && req.method === 'POST') {
      if (!isMultipart) return sendJSON({ error: 'Multipart form required' }, 400);
      const { fields, files } = parseMultipart(rawBody, contentType);
      if (!files.length) return sendJSON({ error: 'Nessun file caricato' }, 400);
      const file = files[0];
      const ext = path.extname(file.filename) || '.jpg';
      const filename = `gallery_${Date.now()}${ext}`;
      fs.writeFileSync(path.join(UPLOADS_DIR, filename), file.data);
      const item = { id: uid(), url: `/uploads/${filename}`, alt_text: fields.altText || '', is_visible: true, sort_order: DB.gallery.length, created_at: new Date().toISOString() };
      DB.gallery.push(item);
      console.log(`🖼️ Upload: ${filename}`);
      return sendJSON(item, 201);
    }

    // ========== ADMIN ROUTES ==========

    // Dashboard
    if (apiPath === '/api/admin/dashboard') {
      const today = new Date().toISOString().slice(0, 10);
      return sendJSON({
        todayBookings: DB.bookings.filter(b => b.date === today).length,
        upcomingBookings: DB.bookings.filter(b => b.status === 'confirmed' && b.date >= today).length,
        totalRevenue: DB.bookings.filter(b => b.status === 'confirmed' || b.status === 'completed').reduce((s,b) => s + b.amount_cents - b.discount_cents, 0),
        activeGiftCards: DB.giftcards.filter(g => g.status === 'active').length,
        unreadMessages: DB.contacts.filter(c => !c.is_read).length,
        recentBookings: DB.bookings.slice(-5).reverse()
      });
    }

    // Bookings
    if (apiPath === '/api/admin/bookings' && req.method === 'GET') {
      let list = [...DB.bookings];
      if (query.status) list = list.filter(b => b.status === query.status);
      if (query.experience) list = list.filter(b => b.experience_slug === query.experience);
      return sendJSON(list.reverse());
    }
    if (apiPath.match(/^\/api\/admin\/bookings\/[^/]+\/status$/) && req.method === 'PATCH') {
      const ref = apiPath.split('/')[4];
      const booking = DB.bookings.find(b => b.booking_ref === ref);
      if (!booking) return sendJSON({ error: 'Not found' }, 404);
      booking.status = jsonBody.status;
      console.log(`📋 Booking ${ref} → ${jsonBody.status}`);
      return sendJSON({ success: true });
    }

    // Calendar
    if (apiPath === '/api/admin/calendar' && req.method === 'GET') {
      let slots = DB.slots;
      if (query.experience) slots = slots.filter(s => s.experience_slug === query.experience);
      if (query.month) slots = slots.filter(s => s.date.startsWith(query.month));
      return sendJSON(slots);
    }
    if (apiPath === '/api/admin/calendar/slots' && req.method === 'POST') {
      const slot = {
        id: uid(), experience_slug: jsonBody.experienceSlug,
        experience_name: (DB.experiences.find(e => e.slug === jsonBody.experienceSlug) || {}).name || jsonBody.experienceSlug,
        date: jsonBody.date, time: jsonBody.time, max_sleds: jsonBody.maxSleds || 6,
        booked_sleds: 0, is_blocked: false, notes: ''
      };
      DB.slots.push(slot);
      console.log(`📅 Slot created: ${slot.date} ${slot.time} (${slot.experience_slug})`);
      return sendJSON(slot, 201);
    }
    if (apiPath === '/api/admin/calendar/slots/bulk' && req.method === 'POST') {
      let created = 0;
      const expName = (DB.experiences.find(e => e.slug === jsonBody.experienceSlug) || {}).name || jsonBody.experienceSlug;
      (jsonBody.dates || []).forEach(date => {
        (jsonBody.times || []).forEach(time => {
          DB.slots.push({ id: uid(), experience_slug: jsonBody.experienceSlug, experience_name: expName, date, time, max_sleds: jsonBody.maxSleds || 6, booked_sleds: 0, is_blocked: false, notes: '' });
          created++;
        });
      });
      console.log(`📅 Bulk: ${created} slots created`);
      return sendJSON({ created });
    }
    if (apiPath.match(/^\/api\/admin\/calendar\/slots\/[^/]+$/) && req.method === 'PATCH') {
      const slotId = apiPath.split('/').pop();
      const slot = DB.slots.find(s => s.id === slotId);
      if (!slot) return sendJSON({ error: 'Not found' }, 404);
      if (jsonBody.maxSleds !== undefined) slot.max_sleds = jsonBody.maxSleds;
      if (jsonBody.isBlocked !== undefined) slot.is_blocked = jsonBody.isBlocked;
      if (jsonBody.notes !== undefined) slot.notes = jsonBody.notes;
      return sendJSON(slot);
    }
    if (apiPath.match(/^\/api\/admin\/calendar\/slots\/[^/]+$/) && req.method === 'DELETE') {
      const slotId = apiPath.split('/').pop();
      const idx = DB.slots.findIndex(s => s.id === slotId);
      if (idx === -1) return sendJSON({ error: 'Not found' }, 404);
      const slot = DB.slots[idx];
      if (slot.booked_sleds > 0) return sendJSON({ error: 'Impossibile eliminare: ci sono prenotazioni attive su questo slot' }, 400);
      DB.slots.splice(idx, 1);
      return sendJSON({ success: true });
    }

    // Gallery (admin)
    if (apiPath === '/api/admin/gallery' && req.method === 'GET') return sendJSON(DB.gallery);
    if (apiPath.match(/^\/api\/admin\/gallery\/[^/]+$/) && req.method === 'PATCH') {
      const id = apiPath.split('/').pop();
      const item = DB.gallery.find(g => g.id === id);
      if (!item) return sendJSON({ error: 'Not found' }, 404);
      if (jsonBody.altText !== undefined) item.alt_text = jsonBody.altText;
      if (jsonBody.isVisible !== undefined) item.is_visible = jsonBody.isVisible;
      return sendJSON(item);
    }
    if (apiPath.match(/^\/api\/admin\/gallery\/[^/]+$/) && req.method === 'DELETE') {
      const id = apiPath.split('/').pop();
      const idx = DB.gallery.findIndex(g => g.id === id);
      if (idx === -1) return sendJSON({ error: 'Not found' }, 404);
      // Delete file too
      const filePath = path.join(__dirname, 'public', DB.gallery[idx].url);
      try { fs.unlinkSync(filePath); } catch {}
      DB.gallery.splice(idx, 1);
      return sendJSON({ success: true });
    }

    // Gift Cards
    if (apiPath === '/api/admin/giftcards' && req.method === 'GET') return sendJSON(DB.giftcards);
    if (apiPath.match(/^\/api\/admin\/giftcards\/[^/]+\/status$/) && req.method === 'PATCH') {
      const id = apiPath.split('/')[4];
      const gc = DB.giftcards.find(g => g.id === id);
      if (!gc) return sendJSON({ error: 'Not found' }, 404);
      gc.status = jsonBody.status;
      return sendJSON(gc);
    }

    // Vouchers
    if (apiPath === '/api/admin/vouchers' && req.method === 'GET') return sendJSON(DB.vouchers);
    if (apiPath === '/api/admin/vouchers' && req.method === 'POST') {
      const code = 'V-' + crypto.randomBytes(4).toString('hex').toUpperCase();
      const v = {
        id: uid(), code, discount_type: jsonBody.discountType, discount_value: jsonBody.discountValue,
        description: jsonBody.description || '', times_used: 0, max_uses: jsonBody.maxUses || 1,
        expires_at: jsonBody.expiresAt || null, is_active: true
      };
      DB.vouchers.push(v);
      console.log(`🏷️ Voucher: ${code}`);
      return sendJSON(v, 201);
    }
    if (apiPath.match(/^\/api\/admin\/vouchers\/[^/]+$/) && req.method === 'PATCH') {
      const id = apiPath.split('/').pop();
      const v = DB.vouchers.find(x => x.id === id);
      if (!v) return sendJSON({ error: 'Not found' }, 404);
      if (jsonBody.isActive !== undefined) v.is_active = jsonBody.isActive;
      return sendJSON(v);
    }
    if (apiPath.match(/^\/api\/admin\/vouchers\/[^/]+$/) && req.method === 'DELETE') {
      const id = apiPath.split('/').pop();
      const idx = DB.vouchers.findIndex(x => x.id === id);
      if (idx === -1) return sendJSON({ error: 'Not found' }, 404);
      DB.vouchers.splice(idx, 1);
      return sendJSON({ success: true });
    }

    // Contacts
    if (apiPath === '/api/admin/contacts' && req.method === 'GET') return sendJSON(DB.contacts);
    if (apiPath.match(/^\/api\/admin\/contacts\/[^/]+\/read$/) && req.method === 'PATCH') {
      const id = apiPath.split('/')[4];
      const c = DB.contacts.find(x => x.id === id);
      if (c) c.is_read = true;
      return sendJSON({ success: true });
    }

    // Experiences CRUD
    if (apiPath === '/api/admin/experiences' && req.method === 'GET') {
      return sendJSON(DB.experiences.sort((a,b) => (a.sort_order||0) - (b.sort_order||0)));
    }
    if (apiPath === '/api/admin/experiences' && req.method === 'POST') {
      const exp = {
        id: uid(), name: jsonBody.name, slug: jsonBody.slug,
        description: jsonBody.description || '', photo_url: jsonBody.photoUrl || '',
        duration: jsonBody.duration || '', price_cents: jsonBody.priceCents || 0,
        max_sleds: jsonBody.maxSleds || 6, sort_order: jsonBody.sortOrder || 10,
        is_active: jsonBody.isActive !== false, is_default: false
      };
      DB.experiences.push(exp);
      console.log(`⛷️ Experience created: ${exp.name}`);
      return sendJSON(exp, 201);
    }
    if (apiPath.match(/^\/api\/admin\/experiences\/[^/]+$/) && req.method === 'PATCH') {
      const id = apiPath.split('/').pop();
      const exp = DB.experiences.find(e => e.id === id);
      if (!exp) return sendJSON({ error: 'Not found' }, 404);
      if (jsonBody.name !== undefined) exp.name = jsonBody.name;
      if (jsonBody.slug !== undefined) exp.slug = jsonBody.slug;
      if (jsonBody.description !== undefined) exp.description = jsonBody.description;
      if (jsonBody.photoUrl !== undefined) exp.photo_url = jsonBody.photoUrl;
      if (jsonBody.duration !== undefined) exp.duration = jsonBody.duration;
      if (jsonBody.priceCents !== undefined) exp.price_cents = jsonBody.priceCents;
      if (jsonBody.maxSleds !== undefined) exp.max_sleds = jsonBody.maxSleds;
      if (jsonBody.sortOrder !== undefined) exp.sort_order = jsonBody.sortOrder;
      if (jsonBody.isActive !== undefined) exp.is_active = jsonBody.isActive;
      // Update name in slots too
      DB.slots.filter(s => s.experience_slug === exp.slug).forEach(s => s.experience_name = exp.name);
      console.log(`⛷️ Experience updated: ${exp.name}`);
      return sendJSON(exp);
    }
    if (apiPath.match(/^\/api\/admin\/experiences\/[^/]+$/) && req.method === 'DELETE') {
      const id = apiPath.split('/').pop();
      const idx = DB.experiences.findIndex(e => e.id === id);
      if (idx === -1) return sendJSON({ error: 'Not found' }, 404);
      const exp = DB.experiences[idx];
      DB.experiences.splice(idx, 1);
      // Remove related slots
      DB.slots = DB.slots.filter(s => s.experience_slug !== exp.slug);
      console.log(`⛷️ Experience deleted: ${exp.name}`);
      return sendJSON({ success: true });
    }

    // Partners CRUD
    if (apiPath === '/api/admin/partners' && req.method === 'GET') return sendJSON(DB.partners);
    if (apiPath === '/api/admin/partners' && req.method === 'POST') {
      const p = {
        id: uid(), name: jsonBody.name, email: jsonBody.email,
        company: jsonBody.company || '', api_key: genApiKey(),
        commission_pct: jsonBody.commissionPct || 10, custom_pricing: {},
        allowed_experiences: jsonBody.allowedExperiences || [],
        is_active: true, notes: jsonBody.notes || '',
        created_at: new Date().toISOString().slice(0, 10)
      };
      DB.partners.push(p);
      console.log(`🤝 Partner created: ${p.name} (API Key: ${p.api_key.slice(0,20)}...)`);
      return sendJSON(p, 201);
    }
    if (apiPath.match(/^\/api\/admin\/partners\/[^/]+$/) && req.method === 'PATCH') {
      const id = apiPath.split('/').pop();
      const p = DB.partners.find(x => x.id === id);
      if (!p) return sendJSON({ error: 'Not found' }, 404);
      if (jsonBody.regenerateKey) {
        p.api_key = genApiKey();
        console.log(`🔑 API Key regenerated for ${p.name}`);
        return sendJSON(p);
      }
      if (jsonBody.name !== undefined) p.name = jsonBody.name;
      if (jsonBody.email !== undefined) p.email = jsonBody.email;
      if (jsonBody.company !== undefined) p.company = jsonBody.company;
      if (jsonBody.commissionPct !== undefined) p.commission_pct = jsonBody.commissionPct;
      if (jsonBody.customPricing !== undefined) p.custom_pricing = jsonBody.customPricing;
      if (jsonBody.allowedExperiences !== undefined) p.allowed_experiences = jsonBody.allowedExperiences;
      if (jsonBody.isActive !== undefined) p.is_active = jsonBody.isActive;
      if (jsonBody.notes !== undefined) p.notes = jsonBody.notes;
      console.log(`🤝 Partner updated: ${p.name}`);
      return sendJSON(p);
    }
    if (apiPath.match(/^\/api\/admin\/partners\/[^/]+$/) && req.method === 'DELETE') {
      const id = apiPath.split('/').pop();
      const idx = DB.partners.findIndex(x => x.id === id);
      if (idx === -1) return sendJSON({ error: 'Not found' }, 404);
      console.log(`🤝 Partner deleted: ${DB.partners[idx].name}`);
      DB.partners.splice(idx, 1);
      return sendJSON({ success: true });
    }

    // ========== PARTNER API ==========
    if (apiPath.startsWith('/api/partner/')) {
      const apiKey = req.headers['x-api-key'];
      const partner = DB.partners.find(p => p.api_key === apiKey && p.is_active);
      // In demo we allow without key too
      if (!partner && apiKey) return sendJSON({ error: 'API Key non valida' }, 401);

      if (apiPath === '/api/partner/experiences') {
        let exps = DB.experiences.filter(e => e.is_active);
        if (partner && partner.allowed_experiences.length > 0) {
          exps = exps.filter(e => partner.allowed_experiences.includes(e.id));
        }
        return sendJSON(exps.map(e => ({ id: e.id, slug: e.slug, name: e.name, description: e.description, duration: e.duration, price_cents: e.price_cents, max_sleds: e.max_sleds, photo_url: e.photo_url })));
      }
      if (apiPath === '/api/partner/availability') {
        let slots = DB.slots.filter(s => s.experience_slug === (query.experience || 'sunset') && !s.is_blocked && (s.max_sleds - s.booked_sleds) > 0);
        if (query.from) slots = slots.filter(s => s.date >= query.from);
        if (query.to) slots = slots.filter(s => s.date <= query.to);
        return sendJSON(slots.map(s => ({ date: s.date, time: s.time, available_sleds: s.max_sleds - s.booked_sleds, max_sleds: s.max_sleds, price_cents: (DB.experiences.find(e => e.slug === s.experience_slug) || {}).price_cents || 0 })));
      }
      if (apiPath === '/api/partner/bookings' && req.method === 'POST') {
        bookingCounter++;
        const ref = `SA-P-${String(bookingCounter).padStart(4,'0')}`;
        const exp = DB.experiences.find(e => e.slug === jsonBody.experience_slug);
        const amount = (jsonBody.num_sleds || 1) * ((exp ? exp.price_cents : 0));
        const commission = Math.round(amount * ((partner ? partner.commission_pct : 10) / 100));
        const booking = {
          id: uid(), booking_ref: ref, experience_slug: jsonBody.experience_slug,
          experience_name: exp ? exp.name : jsonBody.experience_slug,
          date: jsonBody.date, time: jsonBody.time,
          nome: jsonBody.nome, cognome: jsonBody.cognome, email: jsonBody.email, phone: jsonBody.phone || '',
          num_sleds: jsonBody.num_sleds || 1, num_people: jsonBody.num_people || 2,
          amount_cents: amount, discount_cents: 0, status: 'pending',
          partner_id: partner ? partner.id : null, created_at: new Date().toISOString().slice(0, 10)
        };
        DB.bookings.push(booking);
        // Update slot
        const slot = DB.slots.find(s => s.experience_slug === jsonBody.experience_slug && s.date === jsonBody.date && s.time === jsonBody.time);
        if (slot) slot.booked_sleds += (jsonBody.num_sleds || 1);
        console.log(`🤝 Partner booking: ${ref} by ${partner ? partner.name : 'anonymous'}`);
        return sendJSON({ booking_ref: ref, status: 'pending', experience: booking.experience_name, date: booking.date, time: booking.time, amount_cents: amount, commission_cents: commission, message: 'Prenotazione creata con successo' }, 201);
      }
      if (apiPath === '/api/partner/bookings' && req.method === 'GET') {
        let list = DB.bookings;
        if (partner) list = list.filter(b => b.partner_id === partner.id);
        if (query.status) list = list.filter(b => b.status === query.status);
        return sendJSON(list.map(b => ({ booking_ref: b.booking_ref, experience: b.experience_name, date: b.date, time: b.time, nome: b.nome, cognome: b.cognome, num_sleds: b.num_sleds, num_people: b.num_people, amount_cents: b.amount_cents, commission_cents: Math.round(b.amount_cents * ((partner ? partner.commission_pct : 10) / 100)), status: b.status })));
      }
      return sendJSON({ error: 'Endpoint non trovato' }, 404);
    }

    // Catch-all
    return sendJSON({ error: 'Route not found: ' + apiPath }, 404);
  }

  // API routes (real Supabase mode - unchanged)
  if (url.pathname.startsWith('/api/')) {
    try {
      let apiPath = url.pathname.replace('/api/', '');
      let handlerPath;
      const attempts = [
        path.join(__dirname, 'api', apiPath + '.js'),
        path.join(__dirname, 'api', apiPath, 'index.js'),
      ];
      if (apiPath.startsWith('admin/')) {
        const subPath = apiPath.replace('admin/', '').split('/');
        attempts.push(path.join(__dirname, 'api', 'admin', '[...path].js'));
        url.searchParams.set('path', subPath.join('/'));
      }
      for (const attempt of attempts) {
        if (fs.existsSync(attempt)) { handlerPath = attempt; break; }
      }
      if (!handlerPath) {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'API route not found' }));
        return;
      }
      let body = '';
      let rawBody = Buffer.alloc(0);
      await new Promise((resolve) => {
        req.on('data', chunk => { body += chunk; rawBody = Buffer.concat([rawBody, chunk]); });
        req.on('end', resolve);
      });
      const query = Object.fromEntries(url.searchParams);
      if (apiPath.startsWith('admin/') && query.path) query.path = query.path.split('/');
      const vercelReq = Object.assign(req, { query, body: body ? tryParseJSON(body) : undefined, rawBody });
      const vercelRes = {
        statusCode: 200, headers: {},
        setHeader(key, val) { this.headers[key] = val; },
        status(code) { this.statusCode = code; return this; },
        json(data) { res.writeHead(this.statusCode, { ...this.headers, 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }); res.end(JSON.stringify(data)); },
        send(data) { res.writeHead(this.statusCode, { ...this.headers, 'Access-Control-Allow-Origin': '*' }); res.end(data); },
        end(data) { res.writeHead(this.statusCode, { ...this.headers, 'Access-Control-Allow-Origin': '*' }); res.end(data); },
        redirect(url) { res.writeHead(302, { Location: url }); res.end(); }
      };
      delete require.cache[require.resolve(handlerPath)];
      const handler = require(handlerPath);
      await (typeof handler === 'function' ? handler : handler.default || handler)(vercelReq, vercelRes);
    } catch (err) {
      console.error('API Error:', err);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: err.message }));
    }
    return;
  }

  // Static files from public/
  let filePath = path.join(__dirname, 'public', url.pathname === '/' ? 'index.html' : url.pathname);
  if (filePath.endsWith('/') || (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory())) {
    filePath = path.join(filePath, 'index.html');
  }
  if (!path.extname(filePath)) {
    if (fs.existsSync(filePath + '.html')) filePath += '.html';
    else if (fs.existsSync(path.join(filePath, 'index.html'))) filePath = path.join(filePath, 'index.html');
  }
  try {
    if (!fs.existsSync(filePath)) { res.writeHead(404); res.end('Not found'); return; }
    const ext = path.extname(filePath);
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': contentType });
    res.end(fs.readFileSync(filePath));
  } catch (err) { res.writeHead(500); res.end('Server error'); }
});

function tryParseJSON(str) { try { return JSON.parse(str); } catch { return str; } }

server.listen(PORT, () => {
  console.log(`\n🏔️  Snow Adventure dev server`);
  console.log(`   http://localhost:${PORT}`);
  console.log(`   Admin: http://localhost:${PORT}/admin/`);
  console.log(`\n   Tutto funzionante in locale!`);
  console.log(`   Upload foto → public/uploads/`);
  console.log(`   Dati in memoria (si resettano al riavvio)\n`);
});
