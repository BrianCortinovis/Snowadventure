// --- ADMIN PANEL JS (Supabase Auth) ---

let supabaseClient;
let authToken = null;
let DEMO_MODE = false;

// Init Supabase client
async function initSupabase() {
  const res = await fetch('/api/config');
  const config = await res.json();

  // Demo mode bypass — skip Supabase auth when not configured
  if (config.supabaseUrl === 'demo' || !config.supabaseUrl) {
    DEMO_MODE = true;
    authToken = 'demo-token';
    showApp();
    return;
  }

  const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2');
  supabaseClient = createClient(config.supabaseUrl, config.supabaseAnonKey);

  // Check existing session
  const { data: { session } } = await supabaseClient.auth.getSession();
  if (session) {
    authToken = session.access_token;
    showApp();
  }

  // Listen for auth changes
  supabaseClient.auth.onAuthStateChange((event, session) => {
    authToken = session?.access_token || null;
  });
}

initSupabase();

const ADMIN_API = '/api/admin';

function adminHeaders() {
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${authToken}`,
  };
}

async function apiFetch(url, opts = {}) {
  opts.headers = { ...adminHeaders(), ...opts.headers };
  if (opts.body && typeof opts.body === 'object' && !(opts.body instanceof FormData)) {
    opts.body = JSON.stringify(opts.body);
  }
  return fetch(url, opts);
}

// --- AUTH ---
document.getElementById('login-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const email = document.getElementById('login-user').value;
  const pass = document.getElementById('login-pass').value;

  const { data, error } = await supabaseClient.auth.signInWithPassword({
    email,
    password: pass,
  });

  if (error) {
    const err = document.getElementById('login-error');
    err.textContent = error.message || 'Credenziali non valide';
    err.style.display = 'block';
    return;
  }

  authToken = data.session.access_token;
  showApp();
});

function showApp() {
  document.getElementById('login-screen').style.display = 'none';
  document.getElementById('app').style.display = 'flex';
  loadExperiences().then(() => loadDashboard());
}

document.getElementById('logout-btn').addEventListener('click', async (e) => {
  e.preventDefault();
  await supabaseClient.auth.signOut();
  authToken = null;
  location.reload();
});

// --- NAVIGATION ---
document.querySelectorAll('.sidebar-nav a').forEach(a => {
  a.addEventListener('click', (e) => {
    e.preventDefault();
    const sec = a.dataset.section;
    document.querySelectorAll('.sidebar-nav a').forEach(x => x.classList.remove('active'));
    a.classList.add('active');
    document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
    document.getElementById(`sec-${sec}`).classList.add('active');
    const loaders = {
      dashboard: loadDashboard, calendar: loadCalendar, bookings: loadBookings,
      gallery: loadGallery, giftcards: loadGiftCards, vouchers: loadVouchers,
      contacts: loadContacts, experiences: loadExperiences, partners: loadPartners, apidocs: null,
    };
    if (loaders[sec]) loaders[sec]();
  });
});

// --- HELPERS ---
function formatCents(cents) { return (cents / 100).toFixed(2).replace('.', ',') + '€'; }
function formatDate(dateStr) {
  if (!dateStr) return '-';
  return new Date(dateStr).toLocaleDateString('it-IT');
}
function statusBadge(status) { return `<span class="status status-${status}">${status}</span>`; }

function showModal(title, html) {
  document.getElementById('modal-title').textContent = title;
  document.getElementById('modal-body').innerHTML = html;
  document.getElementById('modal-overlay').style.display = 'flex';
}
function closeModal() { document.getElementById('modal-overlay').style.display = 'none'; }

// --- DASHBOARD ---
async function loadDashboard() {
  const res = await apiFetch(`${ADMIN_API}/dashboard`);
  const data = await res.json();
  document.getElementById('dashboard-stats').innerHTML = `
    <div class="stat-card accent"><div class="stat-value">${data.todayBookings}</div><div class="stat-label">Prenotazioni Oggi</div></div>
    <div class="stat-card"><div class="stat-value">${data.upcomingBookings}</div><div class="stat-label">Prenotazioni Confermate</div></div>
    <div class="stat-card accent"><div class="stat-value">${formatCents(data.totalRevenue)}</div><div class="stat-label">Ricavo Totale</div></div>
    <div class="stat-card"><div class="stat-value">${data.activeGiftCards}</div><div class="stat-label">Gift Cards Attive</div></div>
    <div class="stat-card"><div class="stat-value">${data.unreadMessages}</div><div class="stat-label">Messaggi Non Letti</div></div>
  `;
  document.getElementById('dashboard-recent').innerHTML = data.recentBookings.length
    ? renderBookingsTable(data.recentBookings)
    : '<p style="color:#666">Nessuna prenotazione recente</p>';
}

// --- BOOKINGS ---
async function loadBookings() {
  const status = document.getElementById('bookings-status-filter').value;
  const experience = document.getElementById('bookings-exp-filter').value;
  const params = new URLSearchParams();
  if (status) params.set('status', status);
  if (experience) params.set('experience', experience);
  const res = await apiFetch(`${ADMIN_API}/bookings?${params}`);
  const bookings = await res.json();
  document.getElementById('bookings-table').innerHTML = bookings.length
    ? renderBookingsTable(bookings)
    : '<p style="color:#666">Nessuna prenotazione trovata</p>';
}

function renderBookingsTable(bookings) {
  return `<table>
    <thead><tr><th>Rif.</th><th>Esperienza</th><th>Data</th><th>Ora</th><th>Nome</th><th>Email</th><th>Slitte</th><th>Persone</th><th>Totale</th><th>Stato</th><th>Azioni</th></tr></thead>
    <tbody>${bookings.map(b => `<tr>
      <td>${b.booking_ref}</td>
      <td>${b.experience_name || '-'}</td>
      <td>${b.date || '-'}</td>
      <td>${b.time || '-'}</td>
      <td>${b.nome} ${b.cognome}</td>
      <td>${b.email}</td>
      <td>${b.num_sleds}</td>
      <td>${b.num_people}</td>
      <td>${formatCents(b.amount_cents - b.discount_cents)}</td>
      <td>${statusBadge(b.status)}</td>
      <td><select onchange="updateBookingStatus('${b.booking_ref}', this.value)" style="font-size:11px;padding:3px 6px">
        <option value="">Cambia...</option>
        <option value="confirmed">Conferma</option>
        <option value="cancelled">Cancella</option>
        <option value="completed">Completa</option>
      </select></td>
    </tr>`).join('')}</tbody>
  </table>`;
}

async function updateBookingStatus(ref, status) {
  if (!status) return;
  if (!confirm(`Cambiare stato prenotazione ${ref} a "${status}"?`)) return;
  await apiFetch(`${ADMIN_API}/bookings/${ref}/status`, { method: 'PATCH', body: { status } });
  loadBookings();
  loadDashboard();
}

// --- CALENDAR ---
function initCalMonth() {
  const now = new Date();
  document.getElementById('cal-month').value = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}
initCalMonth();

async function loadCalendar() {
  const month = document.getElementById('cal-month').value;
  const exp = document.getElementById('cal-experience').value;
  if (!month) return;

  const res = await apiFetch(`${ADMIN_API}/calendar?month=${month}&experience=${exp}`);
  const slots = await res.json();

  const [year, mon] = month.split('-').map(Number);
  const firstDay = new Date(year, mon - 1, 1).getDay();
  const daysInMonth = new Date(year, mon, 0).getDate();
  const today = new Date().toISOString().slice(0, 10);

  const slotsByDate = {};
  slots.forEach(s => { if (!slotsByDate[s.date]) slotsByDate[s.date] = []; slotsByDate[s.date].push(s); });

  let html = '<div class="cal-header">Lun</div><div class="cal-header">Mar</div><div class="cal-header">Mer</div><div class="cal-header">Gio</div><div class="cal-header">Ven</div><div class="cal-header">Sab</div><div class="cal-header">Dom</div>';
  const startDay = firstDay === 0 ? 6 : firstDay - 1;
  for (let i = 0; i < startDay; i++) html += '<div class="cal-day empty"></div>';

  // Store slots globally for day detail view
  window._calendarSlots = slots;

  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${year}-${String(mon).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    const isToday = dateStr === today;
    const daySlots = slotsByDate[dateStr] || [];
    const slotCount = daySlots.length;
    const hasBookings = daySlots.some(s => s.booked_sleds > 0);
    const allFull = daySlots.length > 0 && daySlots.every(s => s.max_sleds - s.booked_sleds === 0);
    const dayClass = slotCount === 0 ? '' : allFull ? 'day-full' : hasBookings ? 'day-partial' : 'day-available';
    html += `<div class="cal-day ${dayClass}" onclick="showDayDetail('${dateStr}')" style="cursor:pointer">
      <div class="day-num${isToday ? ' today' : ''}">${d}</div>
      ${daySlots.map(s => {
        const avail = s.max_sleds - s.booked_sleds;
        let cls = s.is_blocked ? 'blocked' : avail === 0 ? 'full' : s.booked_sleds > 0 ? 'partial' : 'available';
        return `<div class="cal-slot ${cls}" onclick="event.stopPropagation();showSlotDetail('${s.id}')" title="${s.time} - ${avail}/${s.max_sleds}">${s.time} (${avail}/${s.max_sleds})</div>`;
      }).join('')}
      ${slotCount === 0 ? '<div class="cal-empty-hint">+ Aggiungi</div>' : ''}
    </div>`;
  }
  document.getElementById('calendar-grid').innerHTML = html;
}

// Show day detail modal with all slots for that day
function showDayDetail(dateStr) {
  const exp = document.getElementById('cal-experience').value;
  const daySlots = (window._calendarSlots || []).filter(s => s.date === dateStr);
  const dayName = new Date(dateStr + 'T00:00:00').toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  let slotsHtml = '';
  if (daySlots.length === 0) {
    slotsHtml = '<p style="color:#888;margin-bottom:16px">Nessuno slot per questo giorno.</p>';
  } else {
    slotsHtml = '<div class="day-slots-list">' + daySlots.map(s => {
      const avail = s.max_sleds - s.booked_sleds;
      const statusCls = s.is_blocked ? 'blocked' : avail === 0 ? 'full' : s.booked_sleds > 0 ? 'partial' : 'available';
      return `<div class="day-slot-row">
        <div class="day-slot-info">
          <span class="day-slot-time">${s.time}</span>
          <span class="cal-slot ${statusCls}" style="display:inline-block">${avail}/${s.max_sleds} disponibili</span>
          ${s.is_blocked ? '<span style="color:#e74c3c;font-size:13px"> BLOCCATO</span>' : ''}
          ${s.notes ? `<span style="color:#888;font-size:13px"> — ${s.notes}</span>` : ''}
        </div>
        <div class="day-slot-actions">
          <button class="btn-outline btn-sm" onclick="closeModal();showSlotDetail('${s.id}')">Modifica</button>
          <button class="btn-danger" onclick="deleteSlot('${s.id}')">Elimina</button>
        </div>
      </div>`;
    }).join('') + '</div>';
  }

  showModal(dayName, `
    <div style="margin-bottom:8px;font-size:14px;color:var(--lime);text-transform:uppercase;letter-spacing:.1em">${exp}</div>
    ${slotsHtml}
    <div style="border-top:1px solid var(--border);padding-top:20px;margin-top:16px">
      <h4 style="font-size:16px;color:#fff;margin-bottom:14px">Aggiungi nuovo slot</h4>
      <form onsubmit="createSlotFromDay(event, '${dateStr}')">
        <div style="display:flex;gap:10px;align-items:flex-end;flex-wrap:wrap">
          <div class="form-group" style="margin-bottom:0;flex:1;min-width:120px">
            <label>Orario</label>
            <input type="time" id="day-slot-time" required>
          </div>
          <div class="form-group" style="margin-bottom:0;flex:1;min-width:120px">
            <label>Max Motoslitte</label>
            <input type="number" id="day-slot-max" value="6" min="1" max="20">
          </div>
          <button type="submit" class="btn-lime btn-sm" style="margin-bottom:0;height:44px">+ Aggiungi</button>
        </div>
      </form>
    </div>
  `);
}

async function createSlotFromDay(e, dateStr) {
  e.preventDefault();
  const exp = document.getElementById('cal-experience').value;
  await apiFetch(`${ADMIN_API}/calendar/slots`, { method: 'POST', body: {
    experienceSlug: exp,
    date: dateStr,
    time: document.getElementById('day-slot-time').value,
    maxSleds: parseInt(document.getElementById('day-slot-max').value),
  }});
  closeModal();
  loadCalendar();
  // Reopen the day detail after reload
  setTimeout(() => showDayDetail(dateStr), 300);
}

function showAddSlotModal() {
  const exp = document.getElementById('cal-experience').value;
  showModal('Aggiungi Slot', `
    <form onsubmit="createSlot(event)">
      <div class="form-group"><label>Esperienza</label><input type="text" value="${exp}" readonly id="slot-exp"></div>
      <div class="form-group"><label>Data</label><input type="date" id="slot-date" required></div>
      <div class="form-group"><label>Orario</label><input type="time" id="slot-time" required></div>
      <div class="form-group"><label>Max Motoslitte</label><input type="number" id="slot-max" value="6" min="1" max="20"></div>
      <div class="form-actions"><button type="button" class="btn-outline btn-sm" onclick="closeModal()">Annulla</button><button type="submit" class="btn-lime btn-sm">Crea</button></div>
    </form>
  `);
}

async function createSlot(e) {
  e.preventDefault();
  await apiFetch(`${ADMIN_API}/calendar/slots`, { method: 'POST', body: {
    experienceSlug: document.getElementById('slot-exp').value,
    date: document.getElementById('slot-date').value,
    time: document.getElementById('slot-time').value,
    maxSleds: parseInt(document.getElementById('slot-max').value),
  }});
  closeModal(); loadCalendar();
}

function showBulkSlotModal() {
  const exp = document.getElementById('cal-experience').value;
  showModal('Crea Slot in Blocco', `
    <form onsubmit="createBulkSlots(event)">
      <div class="form-group"><label>Esperienza</label><input type="text" value="${exp}" readonly id="bulk-exp"></div>
      <div class="form-group"><label>Data Inizio</label><input type="date" id="bulk-start" required></div>
      <div class="form-group"><label>Data Fine</label><input type="date" id="bulk-end" required></div>
      <div class="form-group"><label>Giorni</label>
        <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:4px">
          <label style="font-size:12px;color:#ccc"><input type="checkbox" value="1" class="bulk-day" checked> Lun</label>
          <label style="font-size:12px;color:#ccc"><input type="checkbox" value="2" class="bulk-day" checked> Mar</label>
          <label style="font-size:12px;color:#ccc"><input type="checkbox" value="3" class="bulk-day" checked> Mer</label>
          <label style="font-size:12px;color:#ccc"><input type="checkbox" value="4" class="bulk-day" checked> Gio</label>
          <label style="font-size:12px;color:#ccc"><input type="checkbox" value="5" class="bulk-day" checked> Ven</label>
          <label style="font-size:12px;color:#ccc"><input type="checkbox" value="6" class="bulk-day" checked> Sab</label>
          <label style="font-size:12px;color:#ccc"><input type="checkbox" value="0" class="bulk-day" checked> Dom</label>
        </div>
      </div>
      <div class="form-group"><label>Orari (uno per riga)</label><textarea id="bulk-times" rows="3">17:00\n18:30</textarea></div>
      <div class="form-group"><label>Max Motoslitte</label><input type="number" id="bulk-max" value="6" min="1" max="20"></div>
      <div class="form-actions"><button type="button" class="btn-outline btn-sm" onclick="closeModal()">Annulla</button><button type="submit" class="btn-lime btn-sm">Crea Slots</button></div>
    </form>
  `);
}

async function createBulkSlots(e) {
  e.preventDefault();
  const start = new Date(document.getElementById('bulk-start').value);
  const end = new Date(document.getElementById('bulk-end').value);
  const days = [...document.querySelectorAll('.bulk-day:checked')].map(c => parseInt(c.value));
  const times = document.getElementById('bulk-times').value.split('\n').map(t => t.trim()).filter(Boolean);
  const dates = [];
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    if (days.includes(d.getDay())) dates.push(d.toISOString().slice(0, 10));
  }
  const res = await apiFetch(`${ADMIN_API}/calendar/slots/bulk`, { method: 'POST', body: {
    experienceSlug: document.getElementById('bulk-exp').value, dates, times,
    maxSleds: parseInt(document.getElementById('bulk-max').value),
  }});
  const data = await res.json();
  alert(`Creati ${data.created} slot`);
  closeModal(); loadCalendar();
}

async function showSlotDetail(slotId) {
  const res = await apiFetch(`${ADMIN_API}/calendar`);
  const slots = await res.json();
  const slot = slots.find(s => s.id === slotId);
  if (!slot) return;
  showModal(`Slot ${slot.date} ${slot.time}`, `
    <div class="form-group"><label>Esperienza</label><p style="color:#ddd">${slot.experience_name}</p></div>
    <div class="form-group"><label>Prenotati</label><p style="color:#ddd">${slot.booked_sleds} / ${slot.max_sleds}</p></div>
    <div class="form-group"><label>Max Motoslitte</label><input type="number" id="edit-slot-max" value="${slot.max_sleds}" min="1"></div>
    <div class="form-group"><label>Note</label><textarea id="edit-slot-notes" rows="2">${slot.notes || ''}</textarea></div>
    <div class="form-group"><label><input type="checkbox" id="edit-slot-blocked" ${slot.is_blocked ? 'checked' : ''}> Bloccato</label></div>
    <div class="form-actions">
      <button class="btn-danger" onclick="deleteSlot('${slotId}')">Elimina</button>
      <button class="btn-outline btn-sm" onclick="closeModal()">Annulla</button>
      <button class="btn-lime btn-sm" onclick="saveSlot('${slotId}')">Salva</button>
    </div>
  `);
}

async function saveSlot(id) {
  await apiFetch(`${ADMIN_API}/calendar/slots/${id}`, { method: 'PATCH', body: {
    maxSleds: parseInt(document.getElementById('edit-slot-max').value),
    isBlocked: document.getElementById('edit-slot-blocked').checked,
    notes: document.getElementById('edit-slot-notes').value,
  }});
  closeModal(); loadCalendar();
}

async function deleteSlot(id) {
  if (!confirm('Eliminare questo slot?')) return;
  const res = await apiFetch(`${ADMIN_API}/calendar/slots/${id}`, { method: 'DELETE' });
  const data = await res.json();
  if (data.error) { alert(data.error); return; }
  closeModal(); loadCalendar();
}

// --- GALLERY ---
async function loadGallery() {
  const res = await apiFetch(`${ADMIN_API}/gallery`);
  const images = await res.json();
  document.getElementById('gallery-grid').innerHTML = images.length ? images.map(img => `
    <div class="gallery-item" data-id="${img.id}">
      <img src="${img.url}" alt="${img.alt_text || ''}">
      <div class="gallery-item-info">
        <input type="text" value="${img.alt_text || ''}" placeholder="Testo alt" onchange="updateGalleryItem('${img.id}', 'altText', this.value)">
        <div class="gallery-item-actions">
          <button class="btn-outline btn-sm" onclick="toggleGalleryVisibility('${img.id}', ${img.is_visible ? false : true})">${img.is_visible ? 'Nascondi' : 'Mostra'}</button>
          <button class="btn-danger" onclick="deleteGalleryItem('${img.id}')">Elimina</button>
        </div>
      </div>
    </div>
  `).join('') : '<p style="color:#666">Nessuna immagine. Carica la prima!</p>';
}

document.getElementById('gallery-upload-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const formData = new FormData(e.target);
  const res = await fetch('/api/gallery/upload', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${authToken}` },
    body: formData,
  });
  if (res.ok) { e.target.reset(); loadGallery(); }
  else { const d = await res.json(); alert(d.error); }
});

async function updateGalleryItem(id, field, value) {
  await apiFetch(`${ADMIN_API}/gallery/${id}`, { method: 'PATCH', body: { [field]: value } });
}
async function toggleGalleryVisibility(id, isVisible) {
  await apiFetch(`${ADMIN_API}/gallery/${id}`, { method: 'PATCH', body: { isVisible } });
  loadGallery();
}
async function deleteGalleryItem(id) {
  if (!confirm('Eliminare questa immagine?')) return;
  await apiFetch(`${ADMIN_API}/gallery/${id}`, { method: 'DELETE' });
  loadGallery();
}

// --- GIFT CARDS ---
async function loadGiftCards() {
  const res = await apiFetch(`${ADMIN_API}/giftcards`);
  const cards = await res.json();
  document.getElementById('giftcards-table').innerHTML = cards.length ? `<table>
    <thead><tr><th>Codice</th><th>Importo</th><th>Acquirente</th><th>Destinatario</th><th>Stato</th><th>Scadenza</th><th>Azioni</th></tr></thead>
    <tbody>${cards.map(gc => `<tr>
      <td style="font-family:monospace;color:var(--lime)">${gc.code}</td>
      <td>${formatCents(gc.amount_cents)}</td>
      <td>${gc.purchaser_nome} ${gc.purchaser_cognome}</td>
      <td>${gc.recipient_name || '-'}</td>
      <td>${statusBadge(gc.status)}</td>
      <td>${formatDate(gc.expires_at)}</td>
      <td><select onchange="updateGiftCardStatus('${gc.id}', this.value)" style="font-size:11px;padding:3px 6px">
        <option value="">Cambia...</option>
        <option value="active">Attiva</option><option value="used">Usata</option><option value="cancelled">Cancellata</option>
      </select></td>
    </tr>`).join('')}</tbody>
  </table>` : '<p style="color:#666">Nessuna gift card</p>';
}

async function updateGiftCardStatus(id, status) {
  if (!status) return;
  await apiFetch(`${ADMIN_API}/giftcards/${id}/status`, { method: 'PATCH', body: { status } });
  loadGiftCards();
}

// --- VOUCHERS ---
async function loadVouchers() {
  const res = await apiFetch(`${ADMIN_API}/vouchers`);
  const vouchers = await res.json();
  document.getElementById('vouchers-table').innerHTML = vouchers.length ? `<table>
    <thead><tr><th>Codice</th><th>Sconto</th><th>Descrizione</th><th>Usi</th><th>Scadenza</th><th>Stato</th><th>Azioni</th></tr></thead>
    <tbody>${vouchers.map(v => `<tr>
      <td style="font-family:monospace;color:var(--lime)">${v.code}</td>
      <td>${v.discount_type === 'percentage' ? v.discount_value + '%' : formatCents(v.discount_value)}</td>
      <td>${v.description || '-'}</td>
      <td>${v.times_used}/${v.max_uses}</td>
      <td>${v.expires_at ? formatDate(v.expires_at) : 'Mai'}</td>
      <td>${statusBadge(v.is_active ? 'active' : 'expired')}</td>
      <td>
        <button class="btn-outline btn-sm" onclick="toggleVoucher('${v.id}', ${v.is_active ? false : true})">${v.is_active ? 'Disattiva' : 'Attiva'}</button>
        <button class="btn-danger" onclick="deleteVoucher('${v.id}')">Elimina</button>
      </td>
    </tr>`).join('')}</tbody>
  </table>` : '<p style="color:#666">Nessun voucher</p>';
}

function showCreateVoucherModal() {
  showModal('Crea Voucher', `
    <form onsubmit="createVoucher(event)">
      <div class="form-group"><label>Tipo Sconto</label><select id="voucher-type"><option value="percentage">Percentuale (%)</option><option value="fixed">Fisso (€)</option></select></div>
      <div class="form-group"><label>Valore</label><input type="number" id="voucher-value" required min="1" placeholder="es. 10"></div>
      <div class="form-group"><label>Descrizione</label><input type="text" id="voucher-desc" placeholder="es. Sconto hotel partner"></div>
      <div class="form-group"><label>Usi Massimi</label><input type="number" id="voucher-uses" value="1" min="1"></div>
      <div class="form-group"><label>Scadenza</label><input type="date" id="voucher-expires"></div>
      <div class="form-actions"><button type="button" class="btn-outline btn-sm" onclick="closeModal()">Annulla</button><button type="submit" class="btn-lime btn-sm">Crea</button></div>
    </form>
  `);
}

async function createVoucher(e) {
  e.preventDefault();
  const discountType = document.getElementById('voucher-type').value;
  const discountValue = parseInt(document.getElementById('voucher-value').value);
  const value = discountType === 'fixed' ? discountValue * 100 : discountValue;
  const res = await apiFetch(`${ADMIN_API}/vouchers`, { method: 'POST', body: {
    discountType, discountValue: value,
    description: document.getElementById('voucher-desc').value,
    maxUses: parseInt(document.getElementById('voucher-uses').value),
    expiresAt: document.getElementById('voucher-expires').value || null,
  }});
  const data = await res.json();
  alert(`Voucher creato: ${data.code}`);
  closeModal(); loadVouchers();
}

async function toggleVoucher(id, isActive) {
  await apiFetch(`${ADMIN_API}/vouchers/${id}`, { method: 'PATCH', body: { isActive } });
  loadVouchers();
}

async function deleteVoucher(id) {
  if (!confirm('Eliminare?')) return;
  await apiFetch(`${ADMIN_API}/vouchers/${id}`, { method: 'DELETE' });
  loadVouchers();
}

// --- CONTACTS ---
async function loadContacts() {
  const res = await apiFetch(`${ADMIN_API}/contacts`);
  const messages = await res.json();
  document.getElementById('contacts-table').innerHTML = messages.length ? `<table>
    <thead><tr><th>Data</th><th>Nome</th><th>Email</th><th>Telefono</th><th>Messaggio</th><th>Stato</th></tr></thead>
    <tbody>${messages.map(m => `<tr style="${m.is_read ? '' : 'background:rgba(200,230,53,.04)'}">
      <td>${formatDate(m.created_at)}</td>
      <td>${m.nome} ${m.cognome}</td>
      <td><a href="mailto:${m.email}">${m.email}</a></td>
      <td>${m.phone || '-'}</td>
      <td style="max-width:300px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${m.message}">${m.message}</td>
      <td>${m.is_read ? '<span style="color:#666">Letto</span>' : `<button class="btn-lime btn-sm" onclick="markRead('${m.id}')">Segna letto</button>`}</td>
    </tr>`).join('')}</tbody>
  </table>` : '<p style="color:#666">Nessun messaggio</p>';
}

async function markRead(id) {
  await apiFetch(`${ADMIN_API}/contacts/${id}/read`, { method: 'PATCH' });
  loadContacts(); loadDashboard();
}

// --- EXPERIENCES (Full CRUD) ---
let _experiencesList = [];

async function loadExperiences() {
  const res = await apiFetch(`${ADMIN_API}/experiences`);
  _experiencesList = await res.json();
  populateExperienceSelects();
  document.getElementById('experiences-table').innerHTML = _experiencesList.length ? `<table>
    <thead><tr><th>Foto</th><th>Nome</th><th>Slug</th><th>Descrizione</th><th>Durata</th><th>Prezzo</th><th>Max Slitte</th><th>Ordine</th><th>Attivo</th><th>Tipo</th><th>Azioni</th></tr></thead>
    <tbody>${_experiencesList.map(e => `<tr>
      <td>${e.photo_url ? `<img src="${e.photo_url}" class="exp-thumb">` : '<span style="color:#555">—</span>'}</td>
      <td><strong>${e.name}</strong></td>
      <td style="font-family:monospace;color:var(--lime)">${e.slug}</td>
      <td style="max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${(e.description || '').replace(/"/g, '&quot;')}">${e.description || '-'}</td>
      <td>${e.duration || '-'}</td>
      <td>${e.price_cents ? formatCents(e.price_cents) : 'Su richiesta'}</td>
      <td>${e.max_sleds}</td>
      <td>${e.sort_order ?? 0}</td>
      <td>${e.is_active ? '✅' : '❌'}</td>
      <td>${e.is_default ? '<span class="badge-default">Predefinita</span>' : '<span style="color:#888">Occasionale</span>'}</td>
      <td style="white-space:nowrap">
        <button class="btn-outline btn-sm" onclick="editExperience('${e.id}')">Modifica</button>
        <button class="btn-danger" onclick="deleteExperience('${e.id}', ${!!e.is_default})">Elimina</button>
      </td>
    </tr>`).join('')}</tbody>
  </table>` : '<p style="color:#666">Nessuna esperienza</p>';
}

function populateExperienceSelects() {
  const calSel = document.getElementById('cal-experience');
  const bookSel = document.getElementById('bookings-exp-filter');
  calSel.innerHTML = _experiencesList.map(e => `<option value="${e.slug}">${e.name}</option>`).join('');
  bookSel.innerHTML = '<option value="">Tutte le esperienze</option>' + _experiencesList.map(e => `<option value="${e.slug}">${e.name}</option>`).join('');
}

function slugify(text) {
  return text.toLowerCase().replace(/[àáâã]/g,'a').replace(/[èéêë]/g,'e').replace(/[ìíîï]/g,'i').replace(/[òóôõ]/g,'o').replace(/[ùúûü]/g,'u').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
}

function showCreateExperienceModal() {
  showModal('Nuova Esperienza', `
    <form onsubmit="createExperience(event)">
      <div class="form-group"><label>Nome</label><input type="text" id="exp-name" required oninput="document.getElementById('exp-slug').value=slugify(this.value)"></div>
      <div class="form-group"><label>Slug (URL)</label><input type="text" id="exp-slug" required style="font-family:monospace"></div>
      <div class="form-group"><label>Descrizione</label><textarea id="exp-desc" rows="3" placeholder="Descrizione dell'esperienza..."></textarea></div>
      <div class="form-group"><label>Foto URL</label><input type="text" id="exp-photo" placeholder="URL immagine (es. images/foto.jpg)"></div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
        <div class="form-group"><label>Durata</label><input type="text" id="exp-duration" placeholder="es. 2 ore"></div>
        <div class="form-group"><label>Prezzo (€)</label><input type="number" id="exp-price" min="0" step="0.01" placeholder="0 = Su richiesta"></div>
        <div class="form-group"><label>Max Motoslitte</label><input type="number" id="exp-sleds" value="6" min="1" max="20"></div>
        <div class="form-group"><label>Ordine</label><input type="number" id="exp-order" value="10" min="0"></div>
      </div>
      <div class="form-group"><label><input type="checkbox" id="exp-active" checked> Attiva</label></div>
      <div class="form-actions"><button type="button" class="btn-outline btn-sm" onclick="closeModal()">Annulla</button><button type="submit" class="btn-lime btn-sm">Crea Esperienza</button></div>
    </form>
  `);
}

async function createExperience(e) {
  e.preventDefault();
  const res = await apiFetch(`${ADMIN_API}/experiences`, { method: 'POST', body: {
    name: document.getElementById('exp-name').value,
    slug: document.getElementById('exp-slug').value,
    description: document.getElementById('exp-desc').value,
    photoUrl: document.getElementById('exp-photo').value,
    duration: document.getElementById('exp-duration').value,
    priceCents: Math.round(parseFloat(document.getElementById('exp-price').value || 0) * 100),
    maxSleds: parseInt(document.getElementById('exp-sleds').value),
    sortOrder: parseInt(document.getElementById('exp-order').value),
    isActive: document.getElementById('exp-active').checked,
  }});
  const data = await res.json();
  if (data.error) { alert(data.error); return; }
  closeModal(); loadExperiences();
}

function editExperience(id) {
  const e = _experiencesList.find(x => x.id === id);
  if (!e) return;
  showModal('Modifica Esperienza', `
    <form onsubmit="saveExperience(event, '${id}')">
      <div class="form-group"><label>Nome</label><input type="text" id="exp-name" value="${e.name}" required></div>
      <div class="form-group"><label>Slug (URL)</label><input type="text" id="exp-slug" value="${e.slug}" required style="font-family:monospace"></div>
      <div class="form-group"><label>Descrizione</label><textarea id="exp-desc" rows="3">${e.description || ''}</textarea></div>
      <div class="form-group"><label>Foto URL</label>
        ${e.photo_url ? `<img src="${e.photo_url}" style="width:100%;max-height:150px;object-fit:cover;border-radius:6px;margin-bottom:8px">` : ''}
        <input type="text" id="exp-photo" value="${e.photo_url || ''}" placeholder="URL immagine">
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
        <div class="form-group"><label>Durata</label><input type="text" id="exp-duration" value="${e.duration || ''}"></div>
        <div class="form-group"><label>Prezzo (€)</label><input type="number" id="exp-price" value="${(e.price_cents || 0) / 100}" min="0" step="0.01"></div>
        <div class="form-group"><label>Max Motoslitte</label><input type="number" id="exp-sleds" value="${e.max_sleds}" min="1"></div>
        <div class="form-group"><label>Ordine</label><input type="number" id="exp-order" value="${e.sort_order ?? 0}" min="0"></div>
      </div>
      <div class="form-group"><label><input type="checkbox" id="exp-active" ${e.is_active ? 'checked' : ''}> Attiva</label></div>
      <div class="form-actions">
        <button type="button" class="btn-outline btn-sm" onclick="closeModal()">Annulla</button>
        <button type="submit" class="btn-lime btn-sm">Salva</button>
      </div>
    </form>
  `);
}

async function saveExperience(e, id) {
  e.preventDefault();
  await apiFetch(`${ADMIN_API}/experiences/${id}`, { method: 'PATCH', body: {
    name: document.getElementById('exp-name').value,
    slug: document.getElementById('exp-slug').value,
    description: document.getElementById('exp-desc').value,
    photoUrl: document.getElementById('exp-photo').value,
    duration: document.getElementById('exp-duration').value,
    priceCents: Math.round(parseFloat(document.getElementById('exp-price').value || 0) * 100),
    maxSleds: parseInt(document.getElementById('exp-sleds').value),
    sortOrder: parseInt(document.getElementById('exp-order').value),
    isActive: document.getElementById('exp-active').checked,
  }});
  closeModal(); loadExperiences();
}

async function deleteExperience(id, isDefault) {
  const msg = isDefault
    ? 'Questa è un\'esperienza predefinita. Eliminarla rimuoverà anche il link dalla navigazione. Continuare?'
    : 'Eliminare questa esperienza?';
  if (!confirm(msg)) return;
  await apiFetch(`${ADMIN_API}/experiences/${id}`, { method: 'DELETE' });
  loadExperiences();
}

// --- PARTNERS ---
let _partnersList = [];

async function loadPartners() {
  const res = await apiFetch(`${ADMIN_API}/partners`);
  _partnersList = await res.json();
  document.getElementById('partners-table').innerHTML = _partnersList.length ? `<table>
    <thead><tr><th>Nome</th><th>Azienda</th><th>Email</th><th>API Key</th><th>Commissione</th><th>Esperienze</th><th>Attivo</th><th>Azioni</th></tr></thead>
    <tbody>${_partnersList.map(p => `<tr>
      <td><strong>${p.name}</strong></td>
      <td>${p.company || '-'}</td>
      <td><a href="mailto:${p.email}">${p.email}</a></td>
      <td class="api-key-cell">
        <code>${p.api_key.slice(0, 12)}...</code>
        <button class="btn-copy" onclick="copyApiKey('${p.api_key}')" title="Copia API Key">📋</button>
      </td>
      <td>${p.commission_pct}%</td>
      <td>${p.allowed_experiences && p.allowed_experiences.length ? p.allowed_experiences.length + ' esp.' : 'Tutte'}</td>
      <td>${p.is_active ? '✅' : '❌'}</td>
      <td style="white-space:nowrap">
        <button class="btn-outline btn-sm" onclick="editPartner('${p.id}')">Modifica</button>
        <button class="btn-danger" onclick="deletePartner('${p.id}')">Elimina</button>
      </td>
    </tr>`).join('')}</tbody>
  </table>` : '<p style="color:#666">Nessun partner</p>';
}

function copyApiKey(key) {
  navigator.clipboard.writeText(key).then(() => alert('API Key copiata!')).catch(() => prompt('Copia:', key));
}

function showCreatePartnerModal() {
  const expOptions = _experiencesList.map(e => `<label style="display:block;padding:4px 0;color:#ccc"><input type="checkbox" value="${e.id}" class="partner-exp"> ${e.name}</label>`).join('');
  showModal('Nuovo Partner', `
    <form onsubmit="createPartner(event)">
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
        <div class="form-group"><label>Nome</label><input type="text" id="partner-name" required></div>
        <div class="form-group"><label>Azienda</label><input type="text" id="partner-company"></div>
      </div>
      <div class="form-group"><label>Email</label><input type="email" id="partner-email" required></div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
        <div class="form-group"><label>Commissione (%)</label><input type="number" id="partner-commission" value="10" min="0" max="100" step="0.5"></div>
      </div>
      <div class="form-group"><label>Esperienze consentite</label>
        <div class="exp-checklist">${expOptions || '<p style="color:#666">Carica prima le esperienze</p>'}</div>
        <small style="color:#888">Lascia tutto deselezionato per concedere tutte le esperienze</small>
      </div>
      <div class="form-group"><label>Note</label><textarea id="partner-notes" rows="2"></textarea></div>
      <div class="form-actions"><button type="button" class="btn-outline btn-sm" onclick="closeModal()">Annulla</button><button type="submit" class="btn-lime btn-sm">Crea Partner</button></div>
    </form>
  `);
}

async function createPartner(e) {
  e.preventDefault();
  const allowed = [...document.querySelectorAll('.partner-exp:checked')].map(c => c.value);
  const res = await apiFetch(`${ADMIN_API}/partners`, { method: 'POST', body: {
    name: document.getElementById('partner-name').value,
    email: document.getElementById('partner-email').value,
    company: document.getElementById('partner-company').value,
    commissionPct: parseFloat(document.getElementById('partner-commission').value),
    allowedExperiences: allowed,
    notes: document.getElementById('partner-notes').value,
  }});
  const data = await res.json();
  if (data.api_key) alert(`Partner creato!\nAPI Key: ${data.api_key}\n\nSalvala ora, non sarà più visibile per intero.`);
  closeModal(); loadPartners();
}

function editPartner(id) {
  const p = _partnersList.find(x => x.id === id);
  if (!p) return;
  const allowed = p.allowed_experiences || [];
  const expOptions = _experiencesList.map(e => `<label style="display:block;padding:4px 0;color:#ccc"><input type="checkbox" value="${e.id}" class="partner-exp" ${allowed.includes(e.id) ? 'checked' : ''}> ${e.name}</label>`).join('');

  showModal('Modifica Partner', `
    <form onsubmit="savePartner(event, '${id}')">
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
        <div class="form-group"><label>Nome</label><input type="text" id="partner-name" value="${p.name}" required></div>
        <div class="form-group"><label>Azienda</label><input type="text" id="partner-company" value="${p.company || ''}"></div>
      </div>
      <div class="form-group"><label>Email</label><input type="email" id="partner-email" value="${p.email}" required></div>
      <div class="form-group"><label>API Key</label>
        <div style="display:flex;gap:8px;align-items:center">
          <code style="background:#1a1a1a;padding:8px 12px;border-radius:6px;flex:1;word-break:break-all;color:var(--lime)">${p.api_key}</code>
          <button type="button" class="btn-outline btn-sm" onclick="regenerateApiKey('${id}')">Rigenera</button>
        </div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
        <div class="form-group"><label>Commissione (%)</label><input type="number" id="partner-commission" value="${p.commission_pct}" min="0" max="100" step="0.5"></div>
      </div>
      <div class="form-group"><label>Prezzi personalizzati (JSON)</label><textarea id="partner-pricing" rows="2" style="font-family:monospace;font-size:13px">${JSON.stringify(p.custom_pricing || {})}</textarea>
        <small style="color:#888">Formato: {"experience-id": prezzo_centesimi}</small>
      </div>
      <div class="form-group"><label>Esperienze consentite</label>
        <div class="exp-checklist">${expOptions}</div>
      </div>
      <div class="form-group"><label><input type="checkbox" id="partner-active" ${p.is_active ? 'checked' : ''}> Attivo</label></div>
      <div class="form-group"><label>Note</label><textarea id="partner-notes" rows="2">${p.notes || ''}</textarea></div>
      <div class="form-actions"><button type="button" class="btn-outline btn-sm" onclick="closeModal()">Annulla</button><button type="submit" class="btn-lime btn-sm">Salva</button></div>
    </form>
  `);
}

async function savePartner(e, id) {
  e.preventDefault();
  const allowed = [...document.querySelectorAll('.partner-exp:checked')].map(c => c.value);
  let customPricing = {};
  try { customPricing = JSON.parse(document.getElementById('partner-pricing').value); } catch {}
  await apiFetch(`${ADMIN_API}/partners/${id}`, { method: 'PATCH', body: {
    name: document.getElementById('partner-name').value,
    email: document.getElementById('partner-email').value,
    company: document.getElementById('partner-company').value,
    commissionPct: parseFloat(document.getElementById('partner-commission').value),
    customPricing,
    allowedExperiences: allowed,
    isActive: document.getElementById('partner-active').checked,
    notes: document.getElementById('partner-notes').value,
  }});
  closeModal(); loadPartners();
}

async function regenerateApiKey(id) {
  if (!confirm('Rigenerare la API Key? La chiave attuale smetterà di funzionare.')) return;
  const res = await apiFetch(`${ADMIN_API}/partners/${id}`, { method: 'PATCH', body: { regenerateKey: true } });
  const data = await res.json();
  if (data.api_key) alert(`Nuova API Key: ${data.api_key}`);
  closeModal(); loadPartners();
}

async function deletePartner(id) {
  if (!confirm('Eliminare questo partner?')) return;
  await apiFetch(`${ADMIN_API}/partners/${id}`, { method: 'DELETE' });
  loadPartners();
}
