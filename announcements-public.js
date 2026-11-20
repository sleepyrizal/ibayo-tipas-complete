/* Loads announcements from Supabase into announcements.html */
(function () {
  var grid = document.getElementById('announcements-grid');
  if (!grid) return;

  // Finds the Supabase client created in supabase-config.js (see note in chat if this fails)
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

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  // safe text: escape first, then **bold** and line breaks
  function fmt(s) {
    return esc(s).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>').replace(/\n/g, '<br>');
  }
  function safeUrl(u) { return /^(https?:|tel:|mailto:)/i.test(u || '') ? u : ''; }
  function fmtDate(d) {
    try { return new Date(d).toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' }); }
    catch (e) { return ''; }
  }

  function card(a) {
    var url = safeUrl(a.link_url), right = '';
    if (url) {
      var ext = /^https?:/i.test(url);
      right = '<a href="' + esc(url) + '"' + (ext ? ' target="_blank" rel="noopener noreferrer"' : '') +
        ' class="text-primary font-bold hover:underline flex items-center gap-1"><span>' +
        esc(a.link_text || 'Tingnan') + '</span>' +
        (ext ? '<i data-lucide="external-link" class="w-3 h-3"></i>' : '') + '</a>';
    }
    return '<article class="rounded-2xl border border-border bg-card p-6 shadow-sm transition-all hover:shadow-md card-hover flex flex-col justify-between">' +
      '<div><time datetime="' + esc(a.created_at) + '" class="text-xs font-semibold uppercase tracking-wide text-primary">' +
      esc(a.label) + ' <span class="normal-case font-medium text-muted-foreground">· ' + fmtDate(a.created_at) + '</span></time>' +
      '<h3 class="mt-2 text-lg font-bold font-heading text-foreground">' + esc(a.title) + '</h3>' +
      '<p class="mt-2 text-xs sm:text-sm leading-relaxed text-muted-foreground">' + fmt(a.body) + '</p></div>' +
      '<div class="mt-4 pt-3 border-t border-border flex items-center justify-between text-xs">' +
      '<span class="text-muted-foreground">' + esc(a.category || '') + '</span>' + right + '</div></article>';
  }

  function message(text) {
    grid.innerHTML = '<p class="col-span-full text-center text-sm text-muted-foreground py-10">' + esc(text) + '</p>';
  }

  async function load() {
    var client = getClient();
    if (!client) { message('Hindi ma-load ang mga anunsyo (walang koneksyon sa database).'); return; }
    message('Naglo-load ng mga anunsyo...');
    var res = await client.from('announcements').select('*')
      .eq('published', true).order('created_at', { ascending: false });
    if (res.error) { console.error(res.error); message('Hindi ma-load ang mga anunsyo. Pakisubukang muli mamaya.'); return; }
    if (!res.data.length) { message('Wala pang anunsyo sa ngayon.'); return; }
    grid.innerHTML = res.data.map(card).join('');
    if (window.lucide) lucide.createIcons();
  }

  load();
})();
