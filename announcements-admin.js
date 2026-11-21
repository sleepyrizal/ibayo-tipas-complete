/* Announcements manager for admin.html (runs after admin.js) */
(function () {
  var list = document.getElementById('ann-list');
  var form = document.getElementById('ann-form');
  if (!list || !form) return;

  function getClient() {
    var getters = [
      function () { return supabaseClient; }, function () { return sb; },
      function () { return db; }, function () { return _supabase; },
      function () { return window.supabaseClient; }
    ];
    for (var i = 0; i < getters.length; i++) {
      try { var c = getters[i](); if (c && typeof c.from === 'function') return c; } catch (e) {}
    }
    try {
      if (window.supabase && SUPABASE_URL && SUPABASE_ANON_KEY)
        return window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    } catch (e) {}
    return null;
  }
  var client = getClient();

  var $ = function (id) { return document.getElementById(id); };
  var rows = [], editingId = null;

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function toast(msg, bad) {
    var box = $('admin-toast-container'); if (!box) return;
    var t = document.createElement('div');
    t.className = 'mb-2 px-4 py-2.5 rounded-xl text-xs font-bold shadow-lg text-white ' + (bad ? 'bg-red-600' : 'bg-primary');
    t.textContent = msg; box.appendChild(t);
    setTimeout(function () { t.remove(); }, 3500);
  }
  function fmtDate(d) {
    return new Date(d).toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' });
  }

  function render() {
    if (!rows.length) {
      list.innerHTML = '<p class="p-8 text-center text-xs text-muted-foreground">Wala pang anunsyo. Gumawa ng una sa itaas.</p>';
      return;
    }
    list.innerHTML = rows.map(function (a) {
      return '<div class="p-4 flex flex-col sm:flex-row sm:items-start justify-between gap-3">' +
        '<div class="min-w-0"><div class="flex flex-wrap items-center gap-2 text-[11px]">' +
        '<span class="font-bold text-primary uppercase">' + esc(a.label) + '</span>' +
        '<span class="text-muted-foreground">' + fmtDate(a.created_at) + '</span>' +
        (a.published
          ? '<span class="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 font-bold">Published</span>'
          : '<span class="px-2 py-0.5 rounded-full bg-slate-200 text-slate-600 font-bold">Hidden</span>') +
        '</div><div class="mt-1 text-sm font-black text-foreground font-heading">' + esc(a.title) + '</div>' +
        '<div class="mt-0.5 text-xs text-muted-foreground line-clamp-2">' + esc(a.body) + '</div></div>' +
        '<div class="flex items-center gap-1.5 shrink-0 text-[11px] font-bold">' +
        '<button data-act="edit" data-id="' + a.id + '" class="px-3 py-1.5 rounded-full bg-secondary hover:bg-border">I-edit</button>' +
        '<button data-act="toggle" data-id="' + a.id + '" class="px-3 py-1.5 rounded-full bg-secondary hover:bg-border">' + (a.published ? 'Itago' : 'I-publish') + '</button>' +
        '<button data-act="delete" data-id="' + a.id + '" class="px-3 py-1.5 rounded-full bg-red-50 text-red-700 hover:bg-red-100">Burahin</button>' +
        '</div></div>';
    }).join('');
  }

  async function load() {
    if (!client) { list.innerHTML = '<p class="p-8 text-center text-xs text-red-600">Walang koneksyon sa Supabase.</p>'; return; }
    var res = await client.from('announcements').select('*').order('created_at', { ascending: false });
    if (res.error) { console.error(res.error); toast('Hindi ma-load: ' + res.error.message, true); return; }
    rows = res.data; render();
  }

  function resetForm() {
    editingId = null; form.reset();
    $('ann-published').checked = true;
    $('ann-form-title').textContent = 'Bagong Anunsyo';
    $('ann-submit-label').textContent = 'I-post ang Anunsyo';
    $('ann-cancel').classList.add('hidden');
  }

  form.addEventListener('submit', async function (e) {
    e.preventDefault();
    if (!client) return;
    var link = $('ann-link-url').value.trim();
    if (link && !/^(https?:|tel:|mailto:)/i.test(link)) {
      toast('Ang link ay dapat magsimula sa https://, tel:, o mailto:', true); return;
    }
    var payload = {
      label: $('ann-label').value.trim() || 'Anunsyo',
      title: $('ann-title').value.trim(),
      body: $('ann-body').value.trim(),
      category: $('ann-category').value.trim() || null,
      link_url: link || null,
      link_text: $('ann-link-text').value.trim() || null,
      published: $('ann-published').checked
    };
    var res;
    if (editingId) {
      payload.updated_at = new Date().toISOString();
      res = await client.from('announcements').update(payload).eq('id', editingId);
    } else {
      res = await client.from('announcements').insert(payload);
    }
    if (res.error) { console.error(res.error); toast('Hindi na-save: ' + res.error.message, true); return; }
    toast(editingId ? 'Na-update ang anunsyo.' : 'Na-post na! Makikita na ito sa public page.');
    resetForm(); load();
  });

  $('ann-cancel').addEventListener('click', resetForm);

  list.addEventListener('click', async function (e) {
    var btn = e.target.closest('button[data-act]'); if (!btn) return;
    var id = btn.dataset.id, a = rows.find(function (r) { return r.id === id; });
    if (!a) return;
    if (btn.dataset.act === 'edit') {
      editingId = id;
      $('ann-label').value = a.label; $('ann-title').value = a.title; $('ann-body').value = a.body;
      $('ann-category').value = a.category || ''; $('ann-link-url').value = a.link_url || '';
      $('ann-link-text').value = a.link_text || ''; $('ann-published').checked = a.published;
      $('ann-form-title').textContent = 'I-edit ang Anunsyo';
      $('ann-submit-label').textContent = 'I-save ang Pagbabago';
      $('ann-cancel').classList.remove('hidden');
      form.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } else if (btn.dataset.act === 'toggle') {
      var r1 = await client.from('announcements')
        .update({ published: !a.published, updated_at: new Date().toISOString() }).eq('id', id);
      if (r1.error) toast(r1.error.message, true); else { toast(a.published ? 'Naitago na sa public page.' : 'Published na.'); load(); }
    } else if (btn.dataset.act === 'delete') {
      if (!confirm('Burahin ang "' + a.title + '"? Hindi na ito maibabalik.')) return;
      var r2 = await client.from('announcements').delete().eq('id', id);
      if (r2.error) toast(r2.error.message, true); else { toast('Nabura na.'); load(); }
    }
  });

  // Load (fresh) every time the Announcements tab is opened, so we are sure staff is logged in
  var tabBtn = document.querySelector('[data-tab="announcements"]');
  if (tabBtn) tabBtn.addEventListener('click', load);
})();
