// Barangay Ibayo-Tipas Portal - Public site logic (Supabase version)
//
// Requires (loaded before this file, see each .html page):
//   1. the Supabase library (CDN)
//   2. supabase-config.js  -> creates window.db
//
// Residents never read the database directly. They only call three database
// functions defined in schema.sql:
//   submit_application, submit_reklamo, track_application

// ---------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------
function getDb() {
  if (!window.db) {
    showToast('Hindi pa konektado ang database. Pakisuri ang supabase-config.js.');
    return null;
  }
  return window.db;
}

function setButtonBusy(btn, busy, busyText) {
  if (!btn) return;
  if (busy) {
    btn.dataset.originalHtml = btn.innerHTML;
    btn.disabled = true;
    btn.classList.add('opacity-60', 'cursor-not-allowed');
    btn.innerHTML = `<span>${busyText || 'Sandali lang...'}</span>`;
  } else {
    btn.disabled = false;
    btn.classList.remove('opacity-60', 'cursor-not-allowed');
    if (btn.dataset.originalHtml) btn.innerHTML = btn.dataset.originalHtml;
    if (window.lucide) window.lucide.createIcons();
  }
}

// Toast Notification (uses textContent so nothing typed by a user can inject HTML)
function showToast(message) {
  const toast = document.createElement('div');
  toast.className = 'fixed bottom-6 right-6 z-50 bg-slate-900 text-white px-5 py-3 rounded-xl shadow-2xl flex items-center gap-3 border border-slate-700 text-sm font-medium transition-all duration-300';

  const dot = document.createElement('span');
  dot.className = 'w-2.5 h-2.5 rounded-full bg-emerald-400 inline-block shrink-0';
  const text = document.createElement('span');
  text.textContent = message;

  toast.appendChild(dot);
  toast.appendChild(text);
  document.body.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(10px)';
    setTimeout(() => toast.remove(), 400);
  }, 4000);
}

// Next working day (skips Saturday and Sunday)
function getNextBusinessDay() {
  const d = new Date();
  do {
    d.setDate(d.getDate() + 1);
  } while (d.getDay() === 0 || d.getDay() === 6);
  return d;
}

document.addEventListener('DOMContentLoaded', () => {
  // Initialize Lucide icons if available
  if (window.lucide) {
    window.lucide.createIcons();
  }

  // --- Mobile Sidebar Drawer Toggle ---
  const mobileSidebarToggle = document.getElementById('mobile-sidebar-toggle');
  const mobileSidebarClose = document.getElementById('mobile-sidebar-close');
  const mobileSidebarDrawer = document.getElementById('mobile-sidebar-drawer');
  const mobileSidebarBackdrop = document.getElementById('mobile-sidebar-backdrop');

  function openMobileSidebar() {
    if (mobileSidebarDrawer && mobileSidebarBackdrop) {
      mobileSidebarBackdrop.classList.remove('hidden');
      mobileSidebarDrawer.classList.remove('-translate-x-full');
    }
  }

  function closeMobileSidebar() {
    if (mobileSidebarDrawer && mobileSidebarBackdrop) {
      mobileSidebarBackdrop.classList.add('hidden');
      mobileSidebarDrawer.classList.add('-translate-x-full');
    }
  }

  if (mobileSidebarToggle) {
    mobileSidebarToggle.addEventListener('click', openMobileSidebar);
  }
  if (mobileSidebarClose) {
    mobileSidebarClose.addEventListener('click', closeMobileSidebar);
  }
  if (mobileSidebarBackdrop) {
    mobileSidebarBackdrop.addEventListener('click', closeMobileSidebar);
  }

  document.querySelectorAll('.mobile-nav-link').forEach(link => {
    link.addEventListener('click', closeMobileSidebar);
  });

  // Legacy fallback if mobile-menu-btn exists
  const mobileMenuBtn = document.getElementById('mobile-menu-btn');
  const mobileNav = document.getElementById('mobile-nav');
  if (mobileMenuBtn && mobileNav) {
    mobileMenuBtn.addEventListener('click', () => {
      mobileNav.classList.toggle('hidden');
    });
  }

  // --- Announcements Filtering & Search ---
  const filterBtns = document.querySelectorAll('.announcement-filter-btn');
  const searchInput = document.getElementById('announcement-search');
  const announcementCards = document.querySelectorAll('.announcement-card');

  function filterAnnouncements() {
    const activeBtn = document.querySelector('.announcement-filter-btn.active');
    const activeCategory = activeBtn ? activeBtn.getAttribute('data-category') : 'all';
    const query = (searchInput ? searchInput.value : '').toLowerCase().trim();

    announcementCards.forEach(card => {
      const cardCategory = card.getAttribute('data-category');
      const title = card.querySelector('h4')?.textContent.toLowerCase() || '';
      const text = card.querySelector('p')?.textContent.toLowerCase() || '';

      const matchesCat = activeCategory === 'all' || cardCategory === activeCategory;
      const matchesSearch = query === '' || title.includes(query) || text.includes(query);

      card.style.display = matchesCat && matchesSearch ? 'flex' : 'none';
    });
  }

  filterBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      filterBtns.forEach(b => {
        b.classList.remove('active', 'bg-blue-900', 'text-white');
        b.classList.add('bg-slate-100', 'text-slate-700');
      });
      btn.classList.add('active', 'bg-blue-900', 'text-white');
      btn.classList.remove('bg-slate-100', 'text-slate-700');
      filterAnnouncements();
    });
  });

  if (searchInput) {
    searchInput.addEventListener('input', filterAnnouncements);
  }

  // --- Document Request Wizard & Modal ---
  const requestModal = document.getElementById('request-modal');
  const openRequestBtns = document.querySelectorAll('.open-request-modal');
  const closeRequestBtns = document.querySelectorAll('.close-request-modal');
  const requestForm = document.getElementById('document-request-form');
  const confirmationView = document.getElementById('request-confirmation-view');
  const formFieldsView = document.getElementById('request-form-fields-view');

  function openModal(defaultDoc = '') {
    if (requestModal) {
      requestModal.classList.remove('hidden');
      document.body.style.overflow = 'hidden';
      if (defaultDoc && document.getElementById('doc-type-select')) {
        document.getElementById('doc-type-select').value = defaultDoc;
        updateDocRequirements(defaultDoc);
      }
    }
  }

  function closeModal() {
    if (requestModal) {
      requestModal.classList.add('hidden');
      document.body.style.overflow = '';
      if (formFieldsView && confirmationView) {
        formFieldsView.classList.remove('hidden');
        confirmationView.classList.add('hidden');
      }
    }
  }

  openRequestBtns.forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      const docType = btn.getAttribute('data-doc') || '';
      openModal(docType);
    });
  });

  closeRequestBtns.forEach(btn => {
    btn.addEventListener('click', closeModal);
  });

  // Requirements lookup map - 100% FREE with Valid ID containing Ibayo-Tipas address
  const docRequirements = {
    'clearance': [
      'Valid Government ID o Student ID na may address sa Barangay Ibayo-Tipas, Taguig',
      'Community Tax Certificate (Cedula) para sa kasalukuyang taon',
      'Proof of billing o lease contract (kung bagong lipat)',
      'Bayad: 100% LIBRE (Walang Bayad basta may Valid ID sa Ibayo-Tipas)'
    ],
    'residency': [
      'Valid Government ID na may address sa Barangay Ibayo-Tipas, Taguig',
      'Patunay ng paninirahan (Proof of billing, lease contract, o voter\'s certificate)',
      'Cedula (opsyonal ngunit inirerekomenda)',
      'Bayad: 100% LIBRE (Walang Bayad basta may Valid ID sa Ibayo-Tipas)'
    ],
    'indigency': [
      'Valid Government ID na may address sa Barangay Ibayo-Tipas, Taguig',
      'Hospital bill, medical abstract, DSWD, PAO, o school assessment requirement',
      'Bayad: 100% LIBRE (Walang Bayad)'
    ],
    'business': [
      'DTI Business Name Certificate o SEC Registration',
      'Valid ID ng May-ari na may address sa Barangay Ibayo-Tipas, Taguig',
      'Contract of Lease o Land Title ng lokasyon ng negosyo',
      'Bayad: 100% LIBRE para sa mga lehitimong residente ng Ibayo-Tipas'
    ],
    'id': [
      'Valid Government ID / PSA Birth Certificate',
      'Katibayan ng paninirahan sa Barangay Ibayo-Tipas, Taguig',
      '1x1 o 2x2 ID picture (maaari ding magpakuha sa barangay hall)',
      'Bayad: 100% LIBRE (Walang Bayad)'
    ],
    'jobseeker': [
      'Barangay Certification para sa First-time Jobseeker (RA 11261)',
      'Nilagdaang Sumpa ng Pagtupad (Signed Oath of Undertaking)',
      'Valid School ID, Diploma, o Transcript of Records (TOR)',
      'Bayad: 100% LIBRE (Walang Bayad)'
    ]
  };

  const docTypeSelect = document.getElementById('doc-type-select');
  const reqListContainer = document.getElementById('doc-requirements-list');

  function updateDocRequirements(type) {
    if (!reqListContainer) return;
    const reqs = docRequirements[type] || docRequirements['clearance'];
    reqListContainer.innerHTML = reqs.map(r => `
      <li class="flex items-start gap-2 text-xs text-slate-600">
        <span class="text-emerald-600 font-bold">✓</span>
        <span>${r}</span>
      </li>
    `).join('');
  }

  if (docTypeSelect) {
    docTypeSelect.addEventListener('change', (e) => {
      updateDocRequirements(e.target.value);
    });
    updateDocRequirements(docTypeSelect.value);
  }

  // Handle Form Submission -> saves to the Supabase database
  if (requestForm) {
    requestForm.addEventListener('submit', async (e) => {
      e.preventDefault();

      const db = getDb();
      if (!db) return;

      const fullName = document.getElementById('applicant-name')?.value.trim() || '';
      const docSelect = document.getElementById('doc-type-select');
      const docTypeVal = docSelect?.value || 'clearance';
      const docTypeName = docSelect?.options[docSelect.selectedIndex]?.text || 'Barangay Document';
      const contactNo = document.getElementById('applicant-phone')?.value.trim() || '';
      const purok = document.getElementById('applicant-address')?.value.trim() || '';
      const purpose = document.getElementById('applicant-purpose')?.value.trim() || '';

      // Pickup schedule: next business day
      const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
      const formattedDate = getNextBusinessDay().toLocaleDateString('en-PH', options);
      const pickupString = `${formattedDate} (8:00 AM - 4:30 PM)`;

      const submitBtn = requestForm.querySelector('button[type="submit"]');
      setButtonBusy(submitBtn, true, 'Isinusumite...');

      const { data, error } = await db.rpc('submit_application', {
        p_full_name: fullName,
        p_document_type: docTypeName,
        p_doc_val: docTypeVal,
        p_phone_number: contactNo,
        p_address: purok,
        p_purpose: purpose,
        p_pickup_date: pickupString
      });

      setButtonBusy(submitBtn, false);

      if (error || !data) {
        console.error('submit_application error:', error);
        showToast('Hindi naisumite ang request. Pakisuri ang inyong impormasyon at subukang muli.');
        return;
      }

      const trackingCode = data; // generated by the database

      // Populate confirmation view
      document.getElementById('stub-tracking-code').textContent = trackingCode;
      document.getElementById('stub-name').textContent = fullName;
      document.getElementById('stub-doc').textContent = docTypeName;
      document.getElementById('stub-phone').textContent = contactNo;
      document.getElementById('stub-address').textContent = purok;
      document.getElementById('stub-pickup-date').textContent = pickupString;

      // Switch views
      if (formFieldsView && confirmationView) {
        formFieldsView.classList.add('hidden');
        confirmationView.classList.remove('hidden');
      }

      requestForm.reset();
      showToast(`Tagumpay! Tracking Code: ${trackingCode}`);
    });
  }

  // --- Print Claim Stub ---
  const printStubBtn = document.getElementById('print-stub-btn');
  if (printStubBtn) {
    printStubBtn.addEventListener('click', () => {
      window.print();
    });
  }

  // --- DOCUMENT TRACKER SECTION (live lookup by tracking code only) ---
  const trackerForm = document.getElementById('tracker-form');
  const trackerInput = document.getElementById('tracker-input');
  const trackerResultBox = document.getElementById('tracker-result-box');
  const trackerNotFoundBox = document.getElementById('tracker-not-found-box');

  if (trackerForm && trackerInput) {
    trackerForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const code = trackerInput.value.trim().toUpperCase();
      if (!code) return;

      const db = getDb();
      if (!db) return;

      const submitBtn = trackerForm.querySelector('button[type="submit"]');
      setButtonBusy(submitBtn, true, 'Hinahanap...');

      const { data, error } = await db.rpc('track_application', { p_code: code });

      setButtonBusy(submitBtn, false);

      if (error) {
        console.error('track_application error:', error);
        showToast('Hindi makakonekta sa server. Subukan muli mamaya.');
        return;
      }

      const match = Array.isArray(data) ? data[0] : data;

      if (match && match.tracking_code) {
        renderTrackingResult(match);
        if (trackerResultBox) trackerResultBox.classList.remove('hidden');
        if (trackerNotFoundBox) trackerNotFoundBox.classList.add('hidden');
      } else {
        if (trackerResultBox) trackerResultBox.classList.add('hidden');
        if (trackerNotFoundBox) trackerNotFoundBox.classList.remove('hidden');
      }
    });
  }

  // The tracker only receives: tracking_code, full_name, document_type, status, pickup_date
  function renderTrackingResult(app) {
    document.getElementById('track-res-code').textContent = app.tracking_code;
    document.getElementById('track-res-name').textContent = app.full_name;
    document.getElementById('track-res-doc').textContent = app.document_type;
    document.getElementById('track-res-pickup').textContent = app.pickup_date || 'Available during office hours';

    // Status Badge & Stepper
    const statusText = app.status || 'Under Review';
    const statusBadge = document.getElementById('track-res-status-badge');
    statusBadge.textContent = statusText;

    // Reset steps
    const step1 = document.getElementById('track-step-1');
    const step2 = document.getElementById('track-step-2');
    const step3 = document.getElementById('track-step-3');
    const step4 = document.getElementById('track-step-4');

    [step1, step2, step3, step4].forEach(s => {
      if (s) {
        s.className = 'flex flex-col items-center text-center';
        s.querySelector('.step-circle').className = 'step-circle w-8 h-8 rounded-full border-2 border-slate-300 bg-white text-slate-400 font-bold text-xs flex items-center justify-center';
        s.querySelector('.step-label').className = 'step-label text-[11px] text-slate-400 mt-1 font-medium';
      }
    });

    function setStepActive(stepEl) {
      if (!stepEl) return;
      stepEl.querySelector('.step-circle').className = 'step-circle w-8 h-8 rounded-full border-2 border-emerald-500 bg-emerald-500 text-white font-bold text-xs flex items-center justify-center shadow-md';
      stepEl.querySelector('.step-label').className = 'step-label text-[11px] text-emerald-700 mt-1 font-bold';
    }

    setStepActive(step1); // Step 1 is always completed once tracked

    if (statusText === 'Under Review' || statusText === 'Processing') {
      setStepActive(step2);
      statusBadge.className = 'px-3 py-1 rounded-full text-xs font-black uppercase bg-blue-100 text-blue-800 border border-blue-200';
    } else if (statusText === 'For Signature') {
      setStepActive(step2);
      setStepActive(step3);
      statusBadge.className = 'px-3 py-1 rounded-full text-xs font-black uppercase bg-amber-100 text-amber-800 border border-amber-200';
    } else if (statusText === 'Ready for Pickup') {
      setStepActive(step2);
      setStepActive(step3);
      setStepActive(step4);
      statusBadge.className = 'px-3 py-1 rounded-full text-xs font-black uppercase bg-emerald-100 text-emerald-800 border border-emerald-200 animate-pulse';
    } else if (statusText === 'Released') {
      setStepActive(step2);
      setStepActive(step3);
      setStepActive(step4);
      statusBadge.className = 'px-3 py-1 rounded-full text-xs font-black uppercase bg-slate-100 text-slate-800 border border-slate-300';
    } else if (statusText === 'Rejected') {
      statusBadge.className = 'px-3 py-1 rounded-full text-xs font-black uppercase bg-red-100 text-red-800 border border-red-200';
    } else {
      statusBadge.className = 'px-3 py-1 rounded-full text-xs font-black uppercase bg-blue-100 text-blue-800';
    }

    if (window.lucide) window.lucide.createIcons();
  }

  // --- e-Reklamo / Citizen Helpdesk Form ---
  const complaintForm = document.getElementById('complaint-form');
  if (complaintForm) {
    complaintForm.addEventListener('submit', async (e) => {
      e.preventDefault();

      const db = getDb();
      if (!db) return;

      const name = complaintForm.querySelector('input[placeholder*="Juan"]')?.value.trim() || '';
      const phone = complaintForm.querySelector('input[type="tel"]')?.value.trim() || '';
      const typeSelect = complaintForm.querySelector('select');
      const type = typeSelect?.options[typeSelect.selectedIndex]?.text || 'General Concern';
      const loc = complaintForm.querySelector('input[placeholder*="Dr. Natividad"]')?.value.trim() || '';
      const details = complaintForm.querySelector('textarea')?.value.trim() || '';

      const submitBtn = complaintForm.querySelector('button[type="submit"]');
      setButtonBusy(submitBtn, true, 'Isinusumite...');

      const { data, error } = await db.rpc('submit_reklamo', {
        p_full_name: name,
        p_phone_number: phone,
        p_complaint_type: type,
        p_location: loc,
        p_details: details
      });

      setButtonBusy(submitBtn, false);

      if (error || !data) {
        console.error('submit_reklamo error:', error);
        showToast('Hindi naipadala ang ulat. Pakisuri ang inyong impormasyon at subukang muli.');
        return;
      }

      complaintForm.reset();
      showToast(`Ulat naipadala na! Reference Ticket: ${data}. Aksyunan ito ng BPSO Desk.`);
    });
  }

  // --- Copy Hotline Helper ---
  document.querySelectorAll('.copy-hotline').forEach(btn => {
    btn.addEventListener('click', () => {
      const number = btn.getAttribute('data-number');
      if (number) {
        navigator.clipboard.writeText(number).then(() => {
          showToast(`Kinopya ang numero: ${number}`);
        });
      }
    });
  });
});
