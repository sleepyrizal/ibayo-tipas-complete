// Barangay Ibayo-Tipas Admin Portal Logic (Supabase version)
//
// Staff log in with a real Supabase Auth account (email + password).
// Data is read/written through the database. The security rules in schema.sql
// make sure only logged-in staff can read, update or delete anything.

// Global State
let activeApplications = [];
let activeReklamo = [];
let selectedApplicationId = null;
let currentFilterStatus = 'all';
let isLoggedIn = false;

// ---------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------

// Escape text before putting it inside HTML (prevents script injection from resident input)
function esc(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// CSV cell: wrap in quotes, double any quotes, and neutralise spreadsheet formulas
function csvCell(value) {
  let s = String(value ?? '');
  if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
  return `"${s.replace(/"/g, '""')}"`;
}

// Database row (snake_case) -> object used by the screens (camelCase)
function mapApplication(r) {
  return {
    id: r.id,
    trackingCode: r.tracking_code,
    fullName: r.full_name,
    documentType: r.document_type,
    docVal: r.doc_val,
    phoneNumber: r.phone_number,
    address: r.address,
    purpose: r.purpose,
    status: r.status,
    pickupDate: r.pickup_date,
    remarks: r.remarks,
    createdAt: r.created_at,
    updatedAt: r.updated_at
  };
}

function mapReklamo(r) {
  return {
    id: r.id,
    ticketId: r.ticket_id,
    fullName: r.full_name,
    phoneNumber: r.phone_number,
    complaintType: r.complaint_type,
    location: r.location,
    details: r.details,
    status: r.status,
    createdAt: r.created_at
  };
}

// Load everything from the database (only works when a staff member is logged in)
async function loadData() {
  if (!window.db) return false;

  const [appsRes, reklamoRes] = await Promise.all([
    window.db.from('applications').select('*').order('created_at', { ascending: false }),
    window.db.from('reklamo').select('*').order('created_at', { ascending: false })
  ]);

  if (appsRes.error || reklamoRes.error) {
    console.error('Load error:', appsRes.error || reklamoRes.error);
    showToast('Hindi ma-load ang data. Subukang mag-login muli.');
    return false;
  }

  activeApplications = (appsRes.data || []).map(mapApplication);
  activeReklamo = (reklamoRes.data || []).map(mapReklamo);
  return true;
}

async function refreshData(showMessage = false) {
  const ok = await loadData();
  if (ok) {
    renderDashboard();
    updateConnectionPanel();
    if (showMessage) showToast('Na-refresh ang data mula sa database.');
  }
}

document.addEventListener('DOMContentLoaded', async () => {
  // Initialize Lucide icons
  if (window.lucide) window.lucide.createIcons();

  // --- Auth elements ---
  const loginScreen = document.getElementById('admin-login-screen');
  const loginForm = document.getElementById('admin-login-form');
  const staffEmailInput = document.getElementById('admin-staff-email');
  const staffPassInput = document.getElementById('admin-staff-password');
  const loginErrorMsg = document.getElementById('login-error-msg');
  const loginErrorText = loginErrorMsg ? loginErrorMsg.querySelector('span') : null;
  const loginSubmitBtn = loginForm.querySelector('button[type="submit"]');
  const activeStaffLabel = document.getElementById('active-staff-label');
  const logoutBtn = document.getElementById('admin-logout-btn');

  function showLoginError(message) {
    if (loginErrorText) loginErrorText.textContent = message;
    if (loginErrorMsg) loginErrorMsg.classList.remove('hidden');
  }

  async function enterDashboard(session) {
    isLoggedIn = true;
    const email = session?.user?.email || 'Staff';
    if (activeStaffLabel) activeStaffLabel.textContent = email;
    loginScreen.classList.add('hidden');
    if (loginErrorMsg) loginErrorMsg.classList.add('hidden');
    await refreshData();
  }

  function leaveDashboard() {
    isLoggedIn = false;
    activeApplications = [];
    activeReklamo = [];
    renderDashboard();
    loginScreen.classList.remove('hidden');
    staffPassInput.value = '';
  }

  // Not configured? Tell the developer clearly.
  if (!window.db) {
    showLoginError(
      window.SUPABASE_CONFIGURED === false
        ? 'Hindi pa naka-set ang Supabase. I-edit ang supabase-config.js.'
        : 'Hindi ma-load ang Supabase library. Pakisuri ang internet.'
    );
  } else {
    // Already logged in from before? (Supabase remembers the session)
    const { data } = await window.db.auth.getSession();
    if (data && data.session) {
      await enterDashboard(data.session);
    }
  }

  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!window.db) return;

    const email = staffEmailInput.value.trim();
    const password = staffPassInput.value;

    loginSubmitBtn.disabled = true;
    loginSubmitBtn.classList.add('opacity-60');

    const { data, error } = await window.db.auth.signInWithPassword({ email, password });

    loginSubmitBtn.disabled = false;
    loginSubmitBtn.classList.remove('opacity-60');

    if (error || !data.session) {
      showLoginError('Mali ang email o password. Pakisubukang muli.');
      return;
    }

    await enterDashboard(data.session);
    showToast(`Maligayang pagdating, ${data.session.user.email}!`);
  });

  logoutBtn.addEventListener('click', async () => {
    if (confirm('Nais mo bang mag-logout mula sa Admin Portal?')) {
      await window.db.auth.signOut();
      leaveDashboard();
    }
  });

  // Auto refresh every 30 seconds so staff see new requests without reloading
  setInterval(() => {
    const modalOpen = !document.getElementById('processing-modal').classList.contains('hidden');
    if (isLoggedIn && !modalOpen) refreshData();
  }, 30000);

  // --- Navigation Tabs ---
  const navTabBtns = document.querySelectorAll('.nav-tab-btn');
  const tabPanes = document.querySelectorAll('.tab-pane');

  navTabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const targetTab = btn.getAttribute('data-tab');

      navTabBtns.forEach(b => {
        b.classList.remove('active', 'bg-blue-600', 'text-white');
        b.classList.add('text-slate-300');
      });
      btn.classList.add('active', 'bg-blue-600', 'text-white');
      btn.classList.remove('text-slate-300');

      tabPanes.forEach(p => p.classList.add('hidden'));
      const activePane = document.getElementById(`tab-content-${targetTab}`);
      if (activePane) activePane.classList.remove('hidden');

      if (window.lucide) window.lucide.createIcons();
    });
  });

  // --- Filter Status Buttons ---
  const statusFilterBtns = document.querySelectorAll('.status-filter-btn');
  statusFilterBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      statusFilterBtns.forEach(b => {
        b.classList.remove('active', 'bg-blue-900', 'text-white');
        b.classList.add('bg-slate-100', 'text-slate-700');
      });
      btn.classList.add('active', 'bg-blue-900', 'text-white');
      btn.classList.remove('bg-slate-100', 'text-slate-700');

      currentFilterStatus = btn.getAttribute('data-status');
      renderApplicationsTable();
    });
  });

  // Search input
  const searchInput = document.getElementById('admin-search-input');
  if (searchInput) {
    searchInput.addEventListener('input', () => {
      renderApplicationsTable();
    });
  }

  // --- Processing Modal Setup ---
  const processingModal = document.getElementById('processing-modal');
  const closeProcessingBtn = document.getElementById('close-processing-modal');
  const cancelProcessingBtn = document.getElementById('modal-btn-cancel');
  const saveStatusBtn = document.getElementById('modal-btn-save-status');
  const modalStatusSelect = document.getElementById('modal-status-select');
  const modalRemarksInput = document.getElementById('modal-remarks-input');
  const modalPrintCertBtn = document.getElementById('modal-btn-print-cert');

  function closeProcessingModal() {
    processingModal.classList.add('hidden');
    selectedApplicationId = null;
  }

  if (closeProcessingBtn) closeProcessingBtn.addEventListener('click', closeProcessingModal);
  if (cancelProcessingBtn) cancelProcessingBtn.addEventListener('click', closeProcessingModal);

  saveStatusBtn.addEventListener('click', async () => {
    const app = activeApplications.find(a => a.id === selectedApplicationId);
    if (!app) return;

    const newStatus = modalStatusSelect.value;
    const remarks = modalRemarksInput.value.trim();

    saveStatusBtn.disabled = true;
    const { data, error } = await window.db
      .from('applications')
      .update({ status: newStatus, remarks: remarks, updated_at: new Date().toISOString() })
      .eq('id', app.id)
      .select();
    saveStatusBtn.disabled = false;

    if (error || !data || data.length === 0) {
      console.error('Update error:', error);
      showToast('Hindi na-save ang pagbabago. Subukang mag-login muli.');
      return;
    }

    Object.assign(app, mapApplication(data[0]));
    renderDashboard();
    closeProcessingModal();
    showToast(`Aplikasyon ${app.trackingCode} na-update sa: ${newStatus}`);
  });

  // Print button inside processing modal
  modalPrintCertBtn.addEventListener('click', () => {
    const app = activeApplications.find(a => a.id === selectedApplicationId);
    if (app) openPrintCertificate(app);
  });

  // --- Certificate Print Modal Setup ---
  const printCertModal = document.getElementById('printable-certificate-modal');
  const closePrintCertBtn = document.getElementById('close-print-cert-modal');

  function openPrintCertificate(app) {
    document.getElementById('cert-print-title').textContent = (app.documentType || 'BARANGAY CLEARANCE').toUpperCase();
    document.getElementById('cert-print-code').textContent = `CONTROL NO: ${app.trackingCode}`;
    document.getElementById('cert-print-name').textContent = (app.fullName || 'RESIDENT').toUpperCase();
    document.getElementById('cert-print-address').textContent = app.address || 'Barangay Ibayo-Tipas, Taguig City';
    document.getElementById('cert-print-purpose').textContent = (app.purpose || 'EMPLOYMENT').toUpperCase();

    const options = { year: 'numeric', month: 'long', day: 'numeric' };
    document.getElementById('cert-print-date').textContent = new Date().toLocaleDateString('tl-PH', options);

    printCertModal.classList.remove('hidden');
  }

  if (closePrintCertBtn) {
    closePrintCertBtn.addEventListener('click', () => {
      printCertModal.classList.add('hidden');
    });
  }

  // Quick Print Select in Print Station Tab
  const quickPrintSelect = document.getElementById('quick-print-select');
  const btnTriggerQuickPrint = document.getElementById('btn-trigger-quick-print');

  if (btnTriggerQuickPrint) {
    btnTriggerQuickPrint.addEventListener('click', () => {
      const val = quickPrintSelect.value;
      if (!val) {
        showToast('Pumili muna ng aplikante mula sa dropdown.');
        return;
      }
      const app = activeApplications.find(a => a.trackingCode === val);
      if (app) openPrintCertificate(app);
    });
  }

  // --- CSV Export Handlers ---
  const btnExportCsv = document.getElementById('btn-export-csv');
  if (btnExportCsv) {
    btnExportCsv.addEventListener('click', () => {
      exportApplicationsCSV();
    });
  }

  const btnExportReklamoCsv = document.getElementById('btn-export-reklamo-csv');
  if (btnExportReklamoCsv) {
    btnExportReklamoCsv.addEventListener('click', () => {
      exportReklamoCSV();
    });
  }

  // --- Database tab: manual refresh ---
  const btnRefreshData = document.getElementById('btn-refresh-data');
  if (btnRefreshData) {
    btnRefreshData.addEventListener('click', () => refreshData(true));
  }

  // Initial render (empty until a staff member logs in)
  renderDashboard();
  updateConnectionPanel();
});

// Main Dashboard Renderer
function renderDashboard() {
  updateKPIMetrics();
  renderApplicationsTable();
  renderReklamoTable();
  populateQuickPrintSelect();
}

// Database tab info
function updateConnectionPanel() {
  const statusEl = document.getElementById('db-status-text');
  const urlEl = document.getElementById('db-project-url');
  const countEl = document.getElementById('db-record-counts');

  if (statusEl) {
    statusEl.textContent = window.db
      ? (isLoggedIn ? 'Konektado (Supabase)' : 'Naka-set, hindi pa naka-login')
      : 'Hindi konektado';
  }
  if (urlEl) urlEl.textContent = window.SUPABASE_CONFIGURED ? window.SUPABASE_URL : '(hindi pa naka-set)';
  if (countEl) countEl.textContent = `${activeApplications.length} aplikasyon, ${activeReklamo.length} reklamo`;
}

// Update KPI Counters
function updateKPIMetrics() {
  const total = activeApplications.length;
  const underReview = activeApplications.filter(a => a.status === 'Under Review').length;
  const signature = activeApplications.filter(a => a.status === 'For Signature').length;
  const ready = activeApplications.filter(a => a.status === 'Ready for Pickup').length;
  const released = activeApplications.filter(a => a.status === 'Released').length;

  document.getElementById('kpi-total-apps').textContent = total;
  document.getElementById('kpi-review-apps').textContent = underReview;
  document.getElementById('kpi-signature-apps').textContent = signature;
  document.getElementById('kpi-ready-apps').textContent = ready;
  document.getElementById('kpi-released-apps').textContent = released;

  // Sidebar badge
  const pendingBadge = document.getElementById('badge-total-pending');
  if (pendingBadge) pendingBadge.textContent = underReview + signature;

  const reklamoBadge = document.getElementById('badge-total-reklamo');
  if (reklamoBadge) reklamoBadge.textContent = activeReklamo.length;
}

// Render Applications Table
function renderApplicationsTable() {
  const tbody = document.getElementById('admin-applications-table-body');
  const emptyState = document.getElementById('table-empty-state');
  const query = (document.getElementById('admin-search-input')?.value || '').toLowerCase().trim();

  const filtered = activeApplications.filter(app => {
    const matchesStatus = currentFilterStatus === 'all' || app.status === currentFilterStatus;
    const matchesSearch = !query ||
      app.trackingCode.toLowerCase().includes(query) ||
      app.fullName.toLowerCase().includes(query) ||
      app.phoneNumber.toLowerCase().includes(query);

    return matchesStatus && matchesSearch;
  });

  if (filtered.length === 0) {
    tbody.innerHTML = '';
    emptyState.classList.remove('hidden');
    return;
  }

  emptyState.classList.add('hidden');

  tbody.innerHTML = filtered.map((app) => {
    // Status Badge Styling
    let badgeClass = 'bg-slate-100 text-slate-800';
    if (app.status === 'Under Review') badgeClass = 'bg-amber-100 text-amber-800 border border-amber-200';
    else if (app.status === 'Processing') badgeClass = 'bg-blue-100 text-blue-800 border border-blue-200';
    else if (app.status === 'For Signature') badgeClass = 'bg-indigo-100 text-indigo-800 border border-indigo-200 font-bold';
    else if (app.status === 'Ready for Pickup') badgeClass = 'bg-emerald-100 text-emerald-800 border border-emerald-300 font-black animate-pulse';
    else if (app.status === 'Released') badgeClass = 'bg-purple-100 text-purple-800 border border-purple-200';
    else if (app.status === 'Rejected') badgeClass = 'bg-red-100 text-red-800 border border-red-200';

    return `
      <tr class="hover:bg-slate-50 transition-colors border-b border-slate-100">
        <td class="p-3.5 font-mono font-bold text-blue-900">${esc(app.trackingCode)}</td>
        <td class="p-3.5">
          <div class="font-bold text-slate-900 text-sm">${esc(app.fullName)}</div>
          <div class="text-[10px] text-slate-400">Nilagdaan: ${esc(new Date(app.createdAt).toLocaleDateString())}</div>
        </td>
        <td class="p-3.5">
          <div class="font-bold text-slate-800">${esc(app.documentType)}</div>
          <div class="text-[11px] text-slate-500 truncate max-w-xs">${esc(app.purpose)}</div>
        </td>
        <td class="p-3.5">
          <div class="font-semibold text-slate-700">${esc(app.phoneNumber)}</div>
          <div class="text-[11px] text-slate-400 truncate max-w-xs">${esc(app.address)}</div>
        </td>
        <td class="p-3.5">
          <span class="inline-block px-2.5 py-1 rounded-full text-[10px] font-bold uppercase ${badgeClass}">
            ${esc(app.status || 'Under Review')}
          </span>
        </td>
        <td class="p-3.5 text-[11px] text-slate-600">
          ${esc(app.pickupDate || 'Office hours')}
        </td>
        <td class="p-3.5 text-right">
          <div class="inline-flex items-center gap-1.5">
            <button onclick="openProcessModalById('${esc(app.id)}')" class="bg-blue-900 hover:bg-blue-800 text-white font-bold px-3 py-1.5 rounded-lg text-xs shadow-sm transition-all flex items-center gap-1">
              <i data-lucide="edit-3" class="w-3.5 h-3.5"></i>
              <span>Proseso</span>
            </button>
            <button onclick="deleteAppById('${esc(app.id)}')" title="Burahin" class="text-slate-400 hover:text-red-600 p-1.5 rounded-lg hover:bg-red-50 transition-colors">
              <i data-lucide="trash-2" class="w-4 h-4"></i>
            </button>
          </div>
        </td>
      </tr>
    `;
  }).join('');

  if (window.lucide) window.lucide.createIcons();
}

// Open the processing modal for one application
window.openProcessModalById = function(id) {
  const app = activeApplications.find(a => a.id === id);
  if (!app) return;
  selectedApplicationId = id;

  document.getElementById('modal-app-code').textContent = app.trackingCode;
  document.getElementById('modal-app-name').textContent = app.fullName;
  document.getElementById('modal-app-doc').textContent = app.documentType;
  document.getElementById('modal-app-phone').textContent = app.phoneNumber;
  document.getElementById('modal-app-address').textContent = app.address;
  document.getElementById('modal-app-purpose').textContent = app.purpose;

  document.getElementById('modal-status-select').value = app.status || 'Under Review';
  document.getElementById('modal-remarks-input').value = app.remarks || '';

  document.getElementById('processing-modal').classList.remove('hidden');
  if (window.lucide) window.lucide.createIcons();
};

window.deleteAppById = async function(id) {
  const app = activeApplications.find(a => a.id === id);
  if (!app) return;

  if (confirm(`Sigurado ka bang nais burahin ang aplikasyon ni ${app.fullName} (${app.trackingCode})?`)) {
    const { data, error } = await window.db.from('applications').delete().eq('id', id).select();
    if (error || !data || data.length === 0) {
      console.error('Delete error:', error);
      showToast('Hindi nabura ang aplikasyon. Subukang mag-login muli.');
      return;
    }
    activeApplications = activeApplications.filter(a => a.id !== id);
    renderDashboard();
    showToast('Aplikasyon nabura na.');
  }
};

// Render e-Reklamo Table
function renderReklamoTable() {
  const tbody = document.getElementById('admin-reklamo-table-body');
  if (!tbody) return;

  if (activeReklamo.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" class="p-8 text-center text-xs text-slate-400">Walang naitalang reklamo.</td></tr>`;
    return;
  }

  const statuses = [
    ['Under Review', 'Under Review'],
    ['Dispatched Patrol', 'Dispatched Patrol'],
    ['For Lupon Hearing', 'For Lupon Hearing'],
    ['Resolved', 'Resolved / Naaksyunan']
  ];

  tbody.innerHTML = activeReklamo.map((item) => `
    <tr class="hover:bg-slate-50 transition-colors border-b border-slate-100">
      <td class="p-3.5 font-mono font-bold text-rose-800">${esc(item.ticketId)}</td>
      <td class="p-3.5">
        <div class="font-bold text-slate-900">${esc(item.fullName)}</div>
        <div class="text-[11px] text-slate-500">${esc(item.phoneNumber)}</div>
      </td>
      <td class="p-3.5">
        <span class="bg-rose-50 text-rose-700 border border-rose-200 px-2.5 py-0.5 rounded-full font-bold text-[10px]">
          ${esc(item.complaintType)}
        </span>
      </td>
      <td class="p-3.5 text-xs text-slate-700">${esc(item.location)}</td>
      <td class="p-3.5 text-xs text-slate-600 max-w-xs truncate" title="${esc(item.details)}">${esc(item.details)}</td>
      <td class="p-3.5">
        <select onchange="updateReklamoStatus('${esc(item.id)}', this.value)" class="bg-white border border-slate-300 rounded px-2 py-1 text-xs font-semibold">
          ${statuses.map(([val, label]) => `<option value="${val}" ${item.status === val ? 'selected' : ''}>${label}</option>`).join('')}
        </select>
      </td>
      <td class="p-3.5 text-right">
        <button onclick="deleteReklamoById('${esc(item.id)}')" class="text-slate-400 hover:text-red-600 p-1">
          <i data-lucide="trash-2" class="w-4 h-4"></i>
        </button>
      </td>
    </tr>
  `).join('');

  if (window.lucide) window.lucide.createIcons();
}

window.updateReklamoStatus = async function(id, newStatus) {
  const item = activeReklamo.find(r => r.id === id);
  if (!item) return;

  const { data, error } = await window.db
    .from('reklamo')
    .update({ status: newStatus, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select();

  if (error || !data || data.length === 0) {
    console.error('Reklamo update error:', error);
    showToast('Hindi na-save ang status. Subukang mag-login muli.');
    renderReklamoTable();
    return;
  }

  item.status = data[0].status;
  showToast(`Status ng ${item.ticketId} ginawang: ${newStatus}`);
};

window.deleteReklamoById = async function(id) {
  if (confirm('Burahin ang reklamo na ito?')) {
    const { data, error } = await window.db.from('reklamo').delete().eq('id', id).select();
    if (error || !data || data.length === 0) {
      console.error('Reklamo delete error:', error);
      showToast('Hindi nabura ang reklamo. Subukang mag-login muli.');
      return;
    }
    activeReklamo = activeReklamo.filter(r => r.id !== id);
    renderDashboard();
    showToast('Reklamo nabura na.');
  }
};

// Populate Quick Print Select in Print Station
function populateQuickPrintSelect() {
  const select = document.getElementById('quick-print-select');
  if (!select) return;

  select.innerHTML = '<option value="">-- Pumili ng Aplikante --</option>' +
    activeApplications.map(app => `
      <option value="${esc(app.trackingCode)}">
        ${esc(app.trackingCode)} - ${esc(app.fullName)} (${esc(app.documentType)})
      </option>
    `).join('');
}

// Export Applications to CSV
function exportApplicationsCSV() {
  if (activeApplications.length === 0) {
    showToast('Walang record na ma-export.');
    return;
  }

  let csv = 'Tracking Code,Full Name,Document Type,Phone Number,Address,Purpose,Status,Scheduled Pickup,Remarks,Created At\n';
  activeApplications.forEach(a => {
    csv += [a.trackingCode, a.fullName, a.documentType, a.phoneNumber, a.address, a.purpose, a.status, a.pickupDate, a.remarks, a.createdAt]
      .map(csvCell).join(',') + '\n';
  });

  downloadBlob(csv, `Barangay-Ibayo-Tipas-Applications-${new Date().toISOString().slice(0, 10)}.csv`, 'text/csv;charset=utf-8;');
  showToast('Na-download ang masterlist CSV para sa Excel!');
}

// Export Reklamo to CSV
function exportReklamoCSV() {
  if (activeReklamo.length === 0) {
    showToast('Walang blotter record na ma-export.');
    return;
  }

  let csv = 'Ticket ID,Full Name,Phone Number,Complaint Type,Location,Details,Status,Created At\n';
  activeReklamo.forEach(r => {
    csv += [r.ticketId, r.fullName, r.phoneNumber, r.complaintType, r.location, r.details, r.status, r.createdAt]
      .map(csvCell).join(',') + '\n';
  });

  downloadBlob(csv, `Barangay-Ibayo-Tipas-Blotter-${new Date().toISOString().slice(0, 10)}.csv`, 'text/csv;charset=utf-8;');
  showToast('Na-download ang blotter CSV para sa Excel!');
}

function downloadBlob(content, filename, contentType) {
  const blob = new Blob(['\uFEFF' + content], { type: contentType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

// Toast Notification (textContent, so nothing typed by a user can inject HTML)
function showToast(message) {
  const container = document.getElementById('admin-toast-container') || document.body;
  const toast = document.createElement('div');
  toast.className = 'bg-slate-900 text-white px-5 py-3 rounded-xl shadow-2xl flex items-center gap-3 border border-slate-700 text-xs font-semibold mb-2 pointer-events-auto transition-all duration-300';

  const dot = document.createElement('span');
  dot.className = 'w-2.5 h-2.5 rounded-full bg-emerald-400 shrink-0';
  const text = document.createElement('span');
  text.textContent = message;

  toast.appendChild(dot);
  toast.appendChild(text);
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(10px)';
    setTimeout(() => toast.remove(), 400);
  }, 3500);
}
