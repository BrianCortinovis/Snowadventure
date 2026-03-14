// --- ADMIN PANEL JS ---
const API = '/api/admin';

// --- AUTH ---
document.getElementById('login-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const user = document.getElementById('login-user').value;
  const pass = document.getElementById('login-pass').value;
  const res = await fetch(`${API}/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: user, password: pass }),
  });
  if (res.ok) {
    document.getElementById('login-screen').style.display = 'none';
    document.getElementById('app').style.display = 'flex';
    loadDashboard();
  } else {
    const err = document.getElementById('login-error');
    err.textContent = 'Credenziali non valide';
    err.style.display = 'block';
  }
});

// Check if already logged in
(async () => {
  const res = await fetch(`${API}/me`);
  if (res.ok) {
    document.getElementById('login-screen').style.display = 'none';
    document.getElementById('app').style.display = 'flex';
    loadDashboard();
  }
})();

document.getElementById('logout-btn').addEventListener('click', async (e) => {
  e.preventDefault();
  await fetch(`${API}/logout`, { method: 'POST' });
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
    // Load data
    const loaders = {
      dashboard: loadDashboard,
      calendar: loadCalendar,
      bookings: loadBookings,
      gallery: loadGallery,
      giftcards: loadGiftCards,
      vouchers: loadVouchers,
      contacts: loadContacts,
      experiences: loadExperiences,
    };
    if (loaders[sec]) loaders[sec]();
  });
});

// --- HELPERS ---
function formatCents(cents) {
  return (cents / 100).toFixed(2).replace('.', ',') + '€';
}

function formatDate(dateStr) {
  if (!dateStr) return '-';
  const d = new Date(dateStr);
  return d.toLocaleDateString('it-IT');
}

function statusBadge(status) {
  return `<span class="status status-${status}">${status}</span>`;
}

function showModal(title, html) {
  document.getElementById('modal-title').textContent = title;
  document.getElementById('modal-body').innerHTML = html;
  document.getElementById('modal-overlay').style.display = 'flex';
}

function closeModal() {
  document.getElementById('modal-overlay').style.display = 'none';
}

async function apiFetch(url, opts = {}) {
  if (opts.body && typeof opts.body === 'object' && !(opts.body instanceof FormData)) {
    opts.headers = { 'Content-Type': 'application/json', ...opts.headers };
    opts.body = JSON.stringify(opts.body);
  }
  const res = await fetch(url, opts);
  return res;
}

// --- DASHBOARD ---
async function loadDashboard() {
  const res = await fetch(`${API}/dashboard`);
  const data = await res.json();
  document.getElementById('dashboard-stats').innerHTML = `
    <div class="stat-card accent"><div class="stat-value">${data.todayBookings}</div><div class="stat-label">Prenotazioni Oggi</div></div>
    <div class="stat-card"><div class="stat-value">${data.upcomingBookings}</div><div class="stat-label">Prenotazioni Future</div></div>
    <div class="stat-card accent"><div class="stat-value">${formatCents(data.totalRevenue)}</div><div class="stat-label">Ricavo Totale</div></div>
    <div class="stat-card"><div class="stat-value">${data.activeGiftCards}</div><div class="stat-label">Gift Cards Attive</div></div>
    <div class="stat-card"><div class="stat-value">${data.unreadMessages}</div><div class="stat-label">Messaggi Non Letti</div></div>
  `;
  if (data.recentBookings.length) {
    document.getElementById('dashboard-recent').innerHTML = renderBookingsTable(data.recentBookings);
  } else {
    document.getElementById('dashboard-recent').innerHTML = '<p style="color:#666">Nessuna prenotazione recente</p>';
  }
}

// --- BOOKINGS ---
async function loadBookings() {
  const status = document.getElementById('bookings-status-filter').value;
  const experience = document.getElementById('bookings-exp-filter').value;
  const params = new URLSearchParams();
  if (status) params.set('status', status);
  if (experience) params.set('experience', experience);
  const res = await fetch(`${API}/bookings?${params}`);
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
      <td>${b.experience_name}</td>
      <td>${b.date}</td>
      <td>${b.time}</td>
      <td>${b.nome} ${b.cognome}</td>
      <td>${b.email}</td>
      <td>${b.num_sleds}</td>
      <td>${b.num_people}</td>
      <td>${formatCents(b.amount_cents - b.discount_cents)}</td>
      <td>${statusBadge(b.status)}</td>
      <td>
        <select onchange="updateBookingStatus('${b.booking_ref}', this.value)" style="font-size:11px;padding:3px 6px">
          <option value="">Cambia...</option>
          <option value="confirmed">Conferma</option>
          <option value="cancelled">Cancella</option>
          <option value="completed">Completa</option>
        </select>
      </td>
    </tr>`).join('')}</tbody>
  </table>`;
}

async function updateBookingStatus(ref, status) {
  if (!status) return;
  if (!confirm(`Vuoi cambiare lo stato della prenotazione ${ref} a "${status}"?`)) return;
  await apiFetch(`${API}/bookings/${ref}/status`, { method: 'PATCH', body: { status } });
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

  const res = await fetch(`${API}/calendar?month=${month}&experience=${exp}`);
  const slots = await res.json();

  // Build calendar
  const [year, mon] = month.split('-').map(Number);
  const firstDay = new Date(year, mon - 1, 1).getDay();
  const daysInMonth = new Date(year, mon, 0).getDate();
  const today = new Date().toISOString().slice(0, 10);

  // Group slots by date
  const slotsByDate = {};
  slots.forEach(s => {
    if (!slotsByDate[s.date]) slotsByDate[s.date] = [];
    slotsByDate[s.date].push(s);
  });

  let html = '<div class="cal-header">Lun</div><div class="cal-header">Mar</div><div class="cal-header">Mer</div><div class="cal-header">Gio</div><div class="cal-header">Ven</div><div class="cal-header">Sab</div><div class="cal-header">Dom</div>';

  // Adjust for Monday start (JS Sunday=0)
  const startDay = firstDay === 0 ? 6 : firstDay - 1;
  for (let i = 0; i < startDay; i++) html += '<div class="cal-day empty"></div>';

  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${year}-${String(mon).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    const isToday = dateStr === today;
    const daySlots = slotsByDate[dateStr] || [];

    html += `<div class="cal-day">
      <div class="day-num${isToday ? ' today' : ''}">${d}</div>
      ${daySlots.map(s => {
        const avail = s.max_sleds - s.booked_sleds;
        let cls = 'available';
        if (s.is_blocked) cls = 'blocked';
        else if (avail === 0) cls = 'full';
        else if (s.booked_sleds > 0) cls = 'partial';
        return `<div class="cal-slot ${cls}" onclick="showSlotDetail(${s.id})" title="${s.time} - ${avail}/${s.max_sleds} disponibili">${s.time} (${avail}/${s.max_sleds})</div>`;
      }).join('')}
    </div>`;
  }

  document.getElementById('calendar-grid').innerHTML = html;
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
  await apiFetch(`${API}/calendar/slots`, {
    method: 'POST',
    body: {
      experienceSlug: document.getElementById('slot-exp').value,
      date: document.getElementById('slot-date').value,
      time: document.getElementById('slot-time').value,
      maxSleds: parseInt(document.getElementById('slot-max').value),
    },
  });
  closeModal();
  loadCalendar();
}

function showBulkSlotModal() {
  const exp = document.getElementById('cal-experience').value;
  const month = document.getElementById('cal-month').value;
  showModal('Crea Slot in Blocco', `
    <form onsubmit="createBulkSlots(event)">
      <div class="form-group"><label>Esperienza</label><input type="text" value="${exp}" readonly id="bulk-exp"></div>
      <div class="form-group"><label>Data Inizio</label><input type="date" id="bulk-start" required></div>
      <div class="form-group"><label>Data Fine</label><input type="date" id="bulk-end" required></div>
      <div class="form-group"><label>Giorni della settimana</label>
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
      <div class="form-group"><label>Orari (uno per riga)</label><textarea id="bulk-times" rows="3" placeholder="17:00\n18:30">17:00\n18:30</textarea></div>
      <div class="form-group"><label>Max Motoslitte per Slot</label><input type="number" id="bulk-max" value="6" min="1" max="20"></div>
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
  const maxSleds = parseInt(document.getElementById('bulk-max').value);
  const exp = document.getElementById('bulk-exp').value;

  const dates = [];
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    if (days.includes(d.getDay())) {
      dates.push(d.toISOString().slice(0, 10));
    }
  }

  const res = await apiFetch(`${API}/calendar/slots/bulk`, {
    method: 'POST',
    body: { experienceSlug: exp, dates, times, maxSleds },
  });
  const data = await res.json();
  alert(`Creati ${data.created} slot`);
  closeModal();
  loadCalendar();
}

async function showSlotDetail(slotId) {
  const res = await fetch(`${API}/calendar`);
  const slots = await res.json();
  const slot = slots.find(s => s.id === slotId);
  if (!slot) return;

  showModal(`Slot ${slot.date} ${slot.time}`, `
    <div class="form-group"><label>Esperienza</label><p style="color:#ddd">${slot.experience_name}</p></div>
    <div class="form-group"><label>Prenotati</label><p style="color:#ddd">${slot.booked_sleds} / ${slot.max_sleds} motoslitte</p></div>
    <div class="form-group"><label>Max Motoslitte</label><input type="number" id="edit-slot-max" value="${slot.max_sleds}" min="1"></div>
    <div class="form-group"><label>Note</label><textarea id="edit-slot-notes" rows="2">${slot.notes || ''}</textarea></div>
    <div class="form-group">
      <label><input type="checkbox" id="edit-slot-blocked" ${slot.is_blocked ? 'checked' : ''}> Bloccato</label>
    </div>
    <div class="form-actions">
      <button class="btn-danger" onclick="deleteSlot(${slotId})">Elimina</button>
      <button class="btn-outline btn-sm" onclick="closeModal()">Annulla</button>
      <button class="btn-lime btn-sm" onclick="saveSlot(${slotId})">Salva</button>
    </div>
  `);
}

async function saveSlot(id) {
  await apiFetch(`${API}/calendar/slots/${id}`, {
    method: 'PATCH',
    body: {
      maxSleds: parseInt(document.getElementById('edit-slot-max').value),
      isBlocked: document.getElementById('edit-slot-blocked').checked,
      notes: document.getElementById('edit-slot-notes').value,
    },
  });
  closeModal();
  loadCalendar();
}

async function deleteSlot(id) {
  if (!confirm('Eliminare questo slot?')) return;
  const res = await apiFetch(`${API}/calendar/slots/${id}`, { method: 'DELETE' });
  const data = await res.json();
  if (data.error) { alert(data.error); return; }
  closeModal();
  loadCalendar();
}

// --- GALLERY ---
async function loadGallery() {
  const res = await fetch(`${API}/gallery`);
  const images = await res.json();
  document.getElementById('gallery-grid').innerHTML = images.length ? images.map(img => `
    <div class="gallery-item" data-id="${img.id}">
      <img src="/uploads/gallery/${img.filename}" alt="${img.alt_text || ''}">
      <div class="gallery-item-info">
        <input type="text" value="${img.alt_text || ''}" placeholder="Testo alt" onchange="updateGalleryItem(${img.id}, 'altText', this.value)">
        <div class="gallery-item-actions">
          <button class="btn-outline btn-sm" onclick="toggleGalleryVisibility(${img.id}, ${img.is_visible ? 0 : 1})">${img.is_visible ? 'Nascondi' : 'Mostra'}</button>
          <button class="btn-danger" onclick="deleteGalleryItem(${img.id})">Elimina</button>
        </div>
      </div>
    </div>
  `).join('') : '<p style="color:#666">Nessuna immagine nella gallery. Carica la prima!</p>';
}

document.getElementById('gallery-upload-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const form = e.target;
  const formData = new FormData(form);
  const res = await fetch(`${API}/gallery/upload`, { method: 'POST', body: formData });
  if (res.ok) { form.reset(); loadGallery(); }
  else { const d = await res.json(); alert(d.error); }
});

async function updateGalleryItem(id, field, value) {
  await apiFetch(`${API}/gallery/${id}`, { method: 'PATCH', body: { [field]: value } });
}

async function toggleGalleryVisibility(id, isVisible) {
  await apiFetch(`${API}/gallery/${id}`, { method: 'PATCH', body: { isVisible: !!isVisible } });
  loadGallery();
}

async function deleteGalleryItem(id) {
  if (!confirm('Eliminare questa immagine?')) return;
  await apiFetch(`${API}/gallery/${id}`, { method: 'DELETE' });
  loadGallery();
}

// --- GIFT CARDS ---
async function loadGiftCards() {
  const res = await fetch(`${API}/giftcards`);
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
      <td>
        <select onchange="updateGiftCardStatus(${gc.id}, this.value)" style="font-size:11px;padding:3px 6px">
          <option value="">Cambia...</option>
          <option value="active">Attiva</option>
          <option value="used">Usata</option>
          <option value="cancelled">Cancellata</option>
        </select>
      </td>
    </tr>`).join('')}</tbody>
  </table>` : '<p style="color:#666">Nessuna gift card</p>';
}

async function updateGiftCardStatus(id, status) {
  if (!status) return;
  await apiFetch(`${API}/giftcards/${id}/status`, { method: 'PATCH', body: { status } });
  loadGiftCards();
}

// --- VOUCHERS ---
async function loadVouchers() {
  const res = await fetch(`${API}/vouchers`);
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
        <button class="btn-outline btn-sm" onclick="toggleVoucher(${v.id}, ${v.is_active ? 0 : 1})">${v.is_active ? 'Disattiva' : 'Attiva'}</button>
        <button class="btn-danger" onclick="deleteVoucher(${v.id})">Elimina</button>
      </td>
    </tr>`).join('')}</tbody>
  </table>` : '<p style="color:#666">Nessun voucher. Creane uno!</p>';
}

function showCreateVoucherModal() {
  showModal('Crea Voucher', `
    <form onsubmit="createVoucher(event)">
      <div class="form-group"><label>Tipo Sconto</label>
        <select id="voucher-type"><option value="percentage">Percentuale (%)</option><option value="fixed">Fisso (€)</option></select>
      </div>
      <div class="form-group"><label>Valore</label><input type="number" id="voucher-value" required min="1" placeholder="es. 10"></div>
      <div class="form-group"><label>Descrizione</label><input type="text" id="voucher-desc" placeholder="es. Sconto hotel partner"></div>
      <div class="form-group"><label>Usi Massimi</label><input type="number" id="voucher-uses" value="1" min="1"></div>
      <div class="form-group"><label>Scadenza (opzionale)</label><input type="date" id="voucher-expires"></div>
      <div class="form-actions"><button type="button" class="btn-outline btn-sm" onclick="closeModal()">Annulla</button><button type="submit" class="btn-lime btn-sm">Crea</button></div>
    </form>
  `);
}

async function createVoucher(e) {
  e.preventDefault();
  const discountType = document.getElementById('voucher-type').value;
  const discountValue = parseInt(document.getElementById('voucher-value').value);
  const value = discountType === 'fixed' ? discountValue * 100 : discountValue;
  const res = await apiFetch(`${API}/vouchers`, {
    method: 'POST',
    body: {
      discountType,
      discountValue: value,
      description: document.getElementById('voucher-desc').value,
      maxUses: parseInt(document.getElementById('voucher-uses').value),
      expiresAt: document.getElementById('voucher-expires').value || null,
    },
  });
  const data = await res.json();
  alert(`Voucher creato: ${data.code}`);
  closeModal();
  loadVouchers();
}

async function toggleVoucher(id, isActive) {
  await apiFetch(`${API}/vouchers/${id}`, { method: 'PATCH', body: { isActive: !!isActive } });
  loadVouchers();
}

async function deleteVoucher(id) {
  if (!confirm('Eliminare questo voucher?')) return;
  await apiFetch(`${API}/vouchers/${id}`, { method: 'DELETE' });
  loadVouchers();
}

// --- CONTACTS ---
async function loadContacts() {
  const res = await fetch(`${API}/contacts`);
  const messages = await res.json();
  document.getElementById('contacts-table').innerHTML = messages.length ? `<table>
    <thead><tr><th>Data</th><th>Nome</th><th>Email</th><th>Telefono</th><th>Messaggio</th><th>Stato</th></tr></thead>
    <tbody>${messages.map(m => `<tr style="${m.is_read ? '' : 'background:rgba(200,230,53,.04)'}">
      <td>${formatDate(m.created_at)}</td>
      <td>${m.nome} ${m.cognome}</td>
      <td><a href="mailto:${m.email}">${m.email}</a></td>
      <td>${m.phone || '-'}</td>
      <td style="max-width:300px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${m.message}">${m.message}</td>
      <td>${m.is_read ? '<span style="color:#666">Letto</span>' : `<button class="btn-lime btn-sm" onclick="markRead(${m.id})">Segna letto</button>`}</td>
    </tr>`).join('')}</tbody>
  </table>` : '<p style="color:#666">Nessun messaggio</p>';
}

async function markRead(id) {
  await apiFetch(`${API}/contacts/${id}/read`, { method: 'PATCH' });
  loadContacts();
  loadDashboard();
}

// --- EXPERIENCES ---
async function loadExperiences() {
  const res = await fetch(`${API}/experiences`);
  const exps = await res.json();
  document.getElementById('experiences-table').innerHTML = `<table>
    <thead><tr><th>Nome</th><th>Slug</th><th>Durata</th><th>Prezzo</th><th>Max Slitte</th><th>Attivo</th><th>Azioni</th></tr></thead>
    <tbody>${exps.map(e => `<tr>
      <td>${e.name}</td>
      <td style="font-family:monospace">${e.slug}</td>
      <td>${e.duration || '-'}</td>
      <td>${e.price_cents ? formatCents(e.price_cents) : 'Su richiesta'}</td>
      <td>${e.max_sleds}</td>
      <td>${e.is_active ? '✅' : '❌'}</td>
      <td><button class="btn-outline btn-sm" onclick="editExperience(${e.id}, '${e.name}', '${e.duration || ''}', ${e.price_cents || 0}, ${e.max_sleds})">Modifica</button></td>
    </tr>`).join('')}</tbody>
  </table>`;
}

function editExperience(id, name, duration, priceCents, maxSleds) {
  showModal('Modifica Esperienza', `
    <form onsubmit="saveExperience(event, ${id})">
      <div class="form-group"><label>Nome</label><input type="text" id="exp-name" value="${name}" required></div>
      <div class="form-group"><label>Durata</label><input type="text" id="exp-duration" value="${duration}" placeholder="es. 1.5 ore"></div>
      <div class="form-group"><label>Prezzo (€)</label><input type="number" id="exp-price" value="${priceCents / 100}" min="0" step="0.01"></div>
      <div class="form-group"><label>Max Motoslitte Default</label><input type="number" id="exp-sleds" value="${maxSleds}" min="1"></div>
      <div class="form-actions"><button type="button" class="btn-outline btn-sm" onclick="closeModal()">Annulla</button><button type="submit" class="btn-lime btn-sm">Salva</button></div>
    </form>
  `);
}

async function saveExperience(e, id) {
  e.preventDefault();
  await apiFetch(`${API}/experiences/${id}`, {
    method: 'PATCH',
    body: {
      name: document.getElementById('exp-name').value,
      duration: document.getElementById('exp-duration').value,
      priceCents: Math.round(parseFloat(document.getElementById('exp-price').value) * 100),
      maxSleds: parseInt(document.getElementById('exp-sleds').value),
    },
  });
  closeModal();
  loadExperiences();
}
