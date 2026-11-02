'use strict';
(() => {
  const api = window.cardfall;
  const NS = 'http://www.w3.org/2000/svg';
  const nf = new Intl.NumberFormat('tr-TR');
  const root = document.getElementById('root');
  const tbActions = document.getElementById('tb-actions');

  // ---- küçük DOM yardımcıları (içerik her zaman textContent ile yazılır) ----------------
  function h(tag, props, ...kids) {
    const el = document.createElement(tag);
    for (const [k, v] of Object.entries(props || {})) {
      if (v == null || v === false) continue;
      if (k === 'class') el.className = v;
      else if (k === 'text') el.textContent = v;
      else if (k.startsWith('on')) el.addEventListener(k.slice(2).toLowerCase(), v);
      else if (v === true) el.setAttribute(k, '');
      else el.setAttribute(k, v);
    }
    for (const kid of kids.flat()) if (kid != null && kid !== false) el.append(kid.nodeType ? kid : document.createTextNode(String(kid)));
    return el;
  }

  const ICONS = {
    refresh: [['polyline', { points: '23 4 23 10 17 10' }], ['polyline', { points: '1 20 1 14 7 14' }], ['path', { d: 'M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15' }]],
    pause: [['rect', { x: 6, y: 4, width: 4, height: 16, rx: 1 }], ['rect', { x: 14, y: 4, width: 4, height: 16, rx: 1 }]],
    play: [['polygon', { points: '6 3 20 12 6 21' }]],
    next: [['polygon', { points: '5 4 15 12 5 20' }], ['line', { x1: 19, y1: 5, x2: 19, y2: 19 }]],
    lock: [['rect', { x: 3, y: 11, width: 18, height: 11, rx: 2 }], ['path', { d: 'M7 11V7a5 5 0 0 1 10 0v4' }]],
    sliders: [['line', { x1: 4, y1: 21, x2: 4, y2: 14 }], ['line', { x1: 4, y1: 10, x2: 4, y2: 3 }], ['line', { x1: 12, y1: 21, x2: 12, y2: 12 }], ['line', { x1: 12, y1: 8, x2: 12, y2: 3 }], ['line', { x1: 20, y1: 21, x2: 20, y2: 16 }], ['line', { x1: 20, y1: 12, x2: 20, y2: 3 }], ['line', { x1: 1, y1: 14, x2: 7, y2: 14 }], ['line', { x1: 9, y1: 8, x2: 15, y2: 8 }], ['line', { x1: 17, y1: 16, x2: 23, y2: 16 }]],
    eyeoff: [['path', { d: 'M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24' }], ['line', { x1: 1, y1: 1, x2: 23, y2: 23 }]],
    eye: [['path', { d: 'M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z' }], ['circle', { cx: 12, cy: 12, r: 3 }]],
    x: [['line', { x1: 18, y1: 6, x2: 6, y2: 18 }], ['line', { x1: 6, y1: 6, x2: 18, y2: 18 }]],
    clock: [['circle', { cx: 12, cy: 12, r: 10 }], ['polyline', { points: '12 6 12 12 16 14' }]],
    layers: [['polygon', { points: '12 2 2 7 12 12 22 7 12 2' }], ['polyline', { points: '2 17 12 22 22 17' }], ['polyline', { points: '2 12 12 17 22 12' }]],
    list: [['line', { x1: 8, y1: 6, x2: 21, y2: 6 }], ['line', { x1: 8, y1: 12, x2: 21, y2: 12 }], ['line', { x1: 8, y1: 18, x2: 21, y2: 18 }], ['line', { x1: 3, y1: 6, x2: 3.01, y2: 6 }], ['line', { x1: 3, y1: 12, x2: 3.01, y2: 12 }], ['line', { x1: 3, y1: 18, x2: 3.01, y2: 18 }]],
    gift: [['polyline', { points: '20 12 20 22 4 22 4 12' }], ['rect', { x: 2, y: 7, width: 20, height: 5 }], ['line', { x1: 12, y1: 22, x2: 12, y2: 7 }], ['path', { d: 'M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7zM12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z' }]],
    coin: [['circle', { cx: 12, cy: 12, r: 10 }], ['path', { d: 'M15 9c-.6-1-1.7-1.5-3-1.5-1.7 0-3 .9-3 2.2 0 3 6 1.6 6 4.6 0 1.3-1.300 2.200-3 2.200-1.300 0-2.400-.6-3-1.500M12 6v1.500m0 9V18' }]],
    shield: [['path', { d: 'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z' }], ['polyline', { points: '9 12 11 14 15 10' }]],
    check: [['polyline', { points: '20 6 9 17 4 12' }]],
    cards: [['rect', { x: 3, y: 5, width: 13, height: 17, rx: 2, transform: 'rotate(-8 9 13)' }], ['rect', { x: 8, y: 2, width: 13, height: 17, rx: 2 }]],
  };
  function icon(name, size = 18) {
    const svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('width', size); svg.setAttribute('height', size);
    svg.setAttribute('fill', 'none'); svg.setAttribute('stroke', 'currentColor');
    svg.setAttribute('stroke-width', '2'); svg.setAttribute('stroke-linecap', 'round'); svg.setAttribute('stroke-linejoin', 'round');
    svg.setAttribute('class', 'i');
    for (const [tag, attrs] of ICONS[name] || []) {
      const n = document.createElementNS(NS, tag);
      for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v);
      svg.append(n);
    }
    return svg;
  }

  // ---- biçimlendirme ----------------------------------------------------------------------
  const pad = (n) => String(n).padStart(2, '0');
  function clock(ms) {
    const s = Math.max(0, Math.floor(ms / 1000));
    return `${pad(Math.floor(s / 3600))}:${pad(Math.floor((s % 3600) / 60))}:${pad(s % 60)}`;
  }
  function longDur(ms) {
    const m = Math.floor(ms / 60000);
    if (m < 60) return `${m} dk`;
    const hr = Math.floor(m / 60);
    return hr < 100 ? `${hr} sa ${m % 60} dk` : `${nf.format(hr)} sa`;
  }
  const hhmm = (t) => new Date(t).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
  const hhmmss = (t) => new Date(t).toLocaleTimeString('tr-TR');
  const imgUrl = (appid, v = 'capsule') => `cardfall://img/${appid}/${v}`;

  function gameImg(appid, variant) {
    const img = h('img', { alt: '', loading: 'lazy', draggable: 'false', src: imgUrl(appid, variant) });
    img.addEventListener('error', () => img.remove());
    return img;
  }

  function toast(text) {
    const t = h('div', { class: 'toast' }, icon('check', 16), text);
    document.getElementById('toasts').append(t);
    setTimeout(() => t.remove(), 4200);
  }

  // ---- durum ---------------------------------------------------------------------------------
  let S = null;
  let view = null;       // şu an gösterilen görünüm: gate | login | connecting | app
  let ui = {};           // ana ekran referansları
  let lastDropped = null;
  let waitUntil = 0;
  let q = { search: '', black: false };
  let listSig = '';

  function setView(name, build) {
    if (view === name) return false;
    view = name;
    root.replaceChildren(build());
    return true;
  }

  function render(state) {
    S = state;
    document.getElementById('tb-demo').hidden = !state.demo;
    renderTitleActions(state);
    switch (state.phase) {
      case 'setup': case 'locked': showGate(state); break;
      case 'login': showLogin(state); break;
      case 'connecting': showConnecting(state); break;
      case 'ready': showApp(state); break;
      default: break;
    }
    closeModalIfLocked(state);
  }

  function renderTitleActions(state) {
    const ready = state.phase === 'ready';
    const sig = ready ? 'ready' : (state.phase === 'login' || state.phase === 'connecting') ? 'lockonly' : 'none';
    if (tbActions.dataset.sig === sig) return;
    tbActions.dataset.sig = sig;
    tbActions.replaceChildren();
    if (sig === 'none') return;
    if (ready) tbActions.append(h('button', { class: 'icon-btn', title: 'Ayarlar', onclick: () => openSettings() }, icon('sliders', 17)));
    tbActions.append(h('button', { class: 'icon-btn', title: 'Kilitle', onclick: () => api.lock() }, icon('lock', 17)));
  }

  // ---- kapı: kurulum / kilit ---------------------------------------------------------------------
  function strength(p) {
    let s = 0;
    if (p.length >= 8) s++;
    if (p.length >= 12) s++;
    if (/[a-z]/.test(p) && /[A-Z]/.test(p)) s++;
    if (/\d/.test(p) && /[^A-Za-z0-9]/.test(p)) s++;
    return p.length ? Math.max(1, s) : 0;
  }

  function showGate(state) {
    const setup = state.phase === 'setup';
    const mode = setup ? 'setup' : 'locked';
    if (view !== 'gate:' + mode) {
      view = 'gate:' + mode;
      const pass = h('input', { type: 'password', placeholder: setup ? 'Yeni parola (en az 8 karakter)' : 'Parola', autocomplete: 'off', spellcheck: 'false', maxlength: 128 });
      const pass2 = setup ? h('input', { type: 'password', placeholder: 'Parolayı tekrar yaz', autocomplete: 'off', spellcheck: 'false', maxlength: 128 }) : null;
      const meter = setup ? h('div', { class: 'meter', 'data-s': '0' }, h('i'), h('i'), h('i'), h('i')) : null;
      const err = h('p', { class: 'err' });
      const btn = h('button', { class: 'btn primary big', type: 'submit', text: setup ? 'Parolayı oluştur' : 'Kilidi aç' });
      const form = h('form', { novalidate: true }, pass, pass2, meter, err, btn);
      const notice = h('p', { class: 'notice', hidden: true });
      const sub = h('p', { class: 'sub', text: setup ? 'İlk kurulum — Steam oturum anahtarını koruyacak bir parola belirle.' : 'Kilitli. Devam etmek için parolanı gir.' });
      const card = h('div', { class: 'card gate-card' },
        h('img', { class: 'logo', src: 'icon.png', alt: '' }), h('h1', { text: 'Cardfall' }), sub, notice, form,
        h('p', { class: 'fine', text: setup
          ? 'Parola yalnızca bu bilgisayarda kalır, hiçbir yere gönderilmez. Unutursan kayıtlı Steam oturumu silinir ve QR ile yeniden giriş yaparsın.'
          : 'Yanlış parola denemeleri yavaşlatılır; 10 hatada kayıtlı oturum silinir.' }));
      ui.gate = { pass, pass2, meter, err, btn, notice, sub };
      if (setup) pass.addEventListener('input', () => { meter.dataset.s = String(strength(pass.value)); });
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (btn.disabled) return;
        err.textContent = '';
        if (setup) {
          if (pass.value !== pass2.value) { err.textContent = 'Parolalar aynı değil.'; return; }
          btn.disabled = true;
          const r = await api.setup(pass.value);
          btn.disabled = false;
          if (!r.ok) err.textContent = r.message || 'Kurulum başarısız.';
          else { pass.value = ''; pass2.value = ''; }
        } else {
          btn.disabled = true;
          const r = await api.unlock(pass.value);
          btn.disabled = false;
          if (r.ok) { pass.value = ''; return; }
          gateError(r);
          pass.select();
        }
      });
      root.replaceChildren(h('div', { class: 'center' }, card));
      setTimeout(() => pass.focus(), 50);
    }
    const g = ui.gate;
    g.notice.hidden = !state.notice;
    g.notice.textContent = state.notice || '';
    if (!setup && state.lock && state.lock.waitMs > 0 && !waitUntil) {
      waitUntil = Date.now() + state.lock.waitMs;
      tickWait();
    }
    if (!setup && state.lock && state.lock.fails > 0 && !g.err.textContent && !waitUntil) {
      g.err.textContent = `Kalan deneme: ${state.lock.left}`;
    }
  }

  function gateError(r) {
    const g = ui.gate;
    if (!g) return;
    if (r.code === 'WRONG') g.err.textContent = `Parola yanlış. Kalan deneme: ${r.left}`;
    else if (r.code === 'LOCKED') g.err.textContent = `Çok fazla deneme. Bekle…`;
    else if (r.code === 'WIPED') g.err.textContent = 'Kayıtlı oturum silindi.';
    else if (r.code === 'CORRUPT') g.err.textContent = 'Kasa okunamadı (farklı Windows hesabı olabilir).';
    else if (r.code === 'BUSY') g.err.textContent = 'Bir saniye…';
    else g.err.textContent = 'İşlem başarısız.';
    if (r.waitMs > 0) { waitUntil = Date.now() + r.waitMs; tickWait(); }
  }

  function tickWait() {
    const g = ui.gate;
    if (!g || !g.btn) return;
    const left = waitUntil - Date.now();
    if (left <= 0) { waitUntil = 0; g.btn.disabled = false; g.err.textContent = ''; return; }
    g.btn.disabled = true;
    g.err.textContent = `Çok fazla yanlış deneme — ${Math.ceil(left / 1000)} sn bekle`;
    setTimeout(tickWait, 500);
  }

  // ---- giriş (QR) ---------------------------------------------------------------------------------
  function showLogin(state) {
    if (view !== 'login') {
      view = 'login';
      const box = h('div', { class: 'qr-box' });
      ui.login = { box, notice: h('p', { class: 'notice', hidden: true }) };
      const right = h('div', {},
        h('h2', { text: 'Steam hesabına bağlan' }),
        h('p', { text: 'Parolanı bu uygulamaya girmene gerek yok. Telefonundaki Steam uygulamasıyla QR kodu okut.' }),
        ui.login.notice,
        h('ol', { class: 'steps' },
          h('li', { text: 'Telefonunda Steam uygulamasını aç.' }),
          h('li', { text: 'Steam Guard bölümünden QR kodu tara seçeneğini seç.' }),
          h('li', { text: 'Soldaki kodu okut ve girişi onayla.' })),
        h('div', { class: 'shield' }, icon('shield', 18),
          h('span', { text: 'Steam parolan hiç alınmaz. Yalnızca Steam\'in verdiği yenileme anahtarı, kasa parolanla şifrelenip bu bilgisayarda saklanır.' })));
      root.replaceChildren(h('div', { class: 'center' }, h('div', { class: 'card login' }, box, right)));
    }
    const { box, notice } = ui.login;
    notice.hidden = !state.notice;
    notice.textContent = state.notice || '';
    const qr = state.qr || { state: 'idle' };
    const sig = qr.state + (qr.image ? qr.image.length : '');
    if (box.dataset.sig === sig) return;
    box.dataset.sig = sig;
    box.replaceChildren();
    if (qr.image) box.append(h('img', { src: qr.image, alt: 'Steam giriş QR kodu', draggable: 'false' }));
    if (qr.state === 'idle') box.append(h('div', { class: 'qr-veil' }, h('div', { class: 'spinner' }), h('span', { text: 'QR hazırlanıyor…' })));
    else if (qr.state === 'scanned') box.append(h('div', { class: 'qr-veil' }, icon('check', 34), h('span', { text: 'Okutuldu — telefonda onayla' })));
    else if (qr.state === 'expired') box.append(h('div', { class: 'qr-veil' }, h('div', { class: 'spinner' }), h('span', { text: 'Süresi doldu, yenileniyor…' })));
    else if (qr.state === 'error') box.append(h('div', { class: 'qr-veil' }, h('span', { text: qr.error || 'Bir sorun oluştu' }), h('button', { class: 'btn primary', text: 'Tekrar dene', onclick: () => api.startLogin() })));
  }

  function showConnecting(state) {
    if (view !== 'connecting') {
      view = 'connecting';
      ui.conn = { msg: h('p', { class: 'muted' }) };
      root.replaceChildren(h('div', { class: 'center' }, h('div', { class: 'card gate-card' },
        h('div', { class: 'spinner' }), h('h1', { text: 'Steam\'e bağlanılıyor' }), ui.conn.msg)));
    }
    ui.conn.msg.textContent = state.connectError ? `Bağlantı sorunu: ${state.connectError}. Otomatik yeniden denenecek.` : (state.account && state.account.name ? `${state.account.name} hesabı` : 'Lütfen bekle…');
  }

  // ---- ana ekran ------------------------------------------------------------------------------------
  function tile(label, iconName, small) {
    const val = h('div', { class: 'val' + (small ? ' sm' : '') });
    const sub = h('div', { class: 'sub' });
    return { el: h('div', { class: 'card stat' }, h('div', { class: 'lab' }, icon(iconName, 15), label), val, sub), val, sub };
  }

  function buildApp() {
    const art = h('div', { class: 'art' });
    const eyebrow = h('div', { class: 'eyebrow' });
    const title = h('h2', { class: 'hero-title' });
    const sub = h('p', { class: 'hero-sub' });
    const chips = h('div', { class: 'chips' });
    const flow = h('div', { class: 'flow' });
    const toggle = h('button', { class: 'btn primary', onclick: () => api.toggle() });
    const next = h('button', { class: 'btn', onclick: () => api.next() }, icon('next', 16), 'Sıradaki oyun');
    const auto = h('button', { class: 'btn', onclick: () => api.unpin() }, icon('layers', 16), 'Otomatiğe dön');
    const hero = h('section', { class: 'card hero' }, art,
      h('div', { class: 'hero-info' }, eyebrow, title, sub, chips, flow, h('div', { class: 'hero-actions' }, toggle, next, auto)));

    const lastRefresh = h('span', { class: 'muted small' });
    const refreshBtn = h('button', { class: 'btn sm', onclick: () => { refreshBtn.disabled = true; api.refresh(); } }, icon('refresh', 14), h('span', { text: 'Yenile' }));
    const head = h('div', { class: 'section-head' }, h('h2', { text: 'Genel bakış' }), h('div', { class: 'grow' }), lastRefresh, refreshBtn);

    const t = {
      uptime: tile('Çalışma süresi', 'clock', false),
      drops: tile('Kalan kart hakkı', 'cards', false),
      queue: tile('Sırada', 'list', false),
      got: tile('Bu oturumda düşen', 'gift', false),
      value: tile('Tahmini değer', 'coin', true),
    };
    const stats = h('div', { class: 'stats' }, t.uptime.el, t.drops.el, t.queue.el, t.got.el, t.value.el);

    const search = h('input', { type: 'search', placeholder: 'Oyun ara…', spellcheck: 'false', oninput: (e) => { q.search = e.target.value.trim().toLocaleLowerCase('tr'); renderList(); } });
    const order = h('select', { onchange: (e) => api.setSettings({ order: e.target.value }) },
      h('option', { value: 'drops-desc', text: 'En çok kart' }), h('option', { value: 'value-desc', text: 'En değerli' }),
      h('option', { value: 'hours-asc', text: 'En az saat' }), h('option', { value: 'name', text: 'Ada göre' }));
    const blackBtn = h('button', { class: 'icon-btn', title: 'Gizlenen oyunları göster', onclick: () => { q.black = !q.black; renderList(); } }, icon('eyeoff', 16));
    const count = h('span', { class: 'count' });
    const list = h('div', { class: 'list scroll' });
    const priceNote = h('div', { class: 'price-note', hidden: true });
    const queueCard = h('section', { class: 'card panel' },
      h('div', { class: 'panel-head' }, h('h3', { text: 'Sıra' }), count, h('div', { class: 'tools' }, search, order, blackBtn)), list, priceNote);

    const logEl = h('ul', { class: 'log scroll' });
    const kv = h('div', { class: 'kv' });
    const side = h('div', { class: 'side' },
      h('section', { class: 'card panel' }, h('div', { class: 'panel-head' }, h('h3', { text: 'Etkinlik' })), logEl),
      h('section', { class: 'card panel' }, h('div', { class: 'panel-head' }, h('h3', { text: 'Toplamlar' })), kv));

    ui = { art, eyebrow, title, sub, chips, flow, toggle, next, auto, lastRefresh, refreshBtn, t, search, order, blackBtn, count, list, priceNote, logEl, kv, statusPill: null };
    return h('div', { class: 'app' }, hero, head, stats, h('div', { class: 'lower' }, queueCard, side));
  }

  function showApp(state) {
    if (view !== 'app') { view = 'app'; root.replaceChildren(buildApp()); lastDropped = null; listSig = ''; }
    const e = state.engine;
    const g = e.games;
    const byId = new Map(g.map((x) => [x.appid, x]));

    // durum rozeti + hero
    const status = heroStatus(state, e);
    ui.eyebrow.replaceChildren(...[h('span', { class: 'pill ' + status.tone }, h('span', { class: 'dot' }), status.label),
      state.net === 'offline' ? h('span', { class: 'pill bad' }, h('span', { class: 'dot' }), 'Bağlantı yok') : null,
      e.pinned ? h('span', { class: 'pill' }, 'Elle seçildi') : null].filter(Boolean));
    ui.flow.classList.toggle('on', e.active);

    const idle = e.idling.map((id) => byId.get(id)).filter(Boolean);
    const artSig = e.idling.slice(0, 4).join(',') + '|' + e.idling.length;
    if (ui.art.dataset.sig !== artSig) {
      ui.art.dataset.sig = artSig;
      ui.art.replaceChildren();
      ui.art.className = 'art';
      if (!idle.length) ui.art.append(h('div', { class: 'empty' }, icon('cards', 54)));
      else if (idle.length === 1) { ui.art.classList.add('single'); ui.art.append(h('div', { class: 'tile' }, gameImg(idle[0].appid, 'header'))); }
      else {
        ui.art.classList.add('mosaic');
        for (const x of idle.slice(0, 4)) ui.art.append(h('div', { class: 'tile' }, gameImg(x.appid, 'capsule')));
        if (idle.length > 4) ui.art.append(h('span', { class: 'more', text: `+${idle.length - 4}` }));
      }
    }

    if (idle.length === 1) {
      ui.title.textContent = idle[0].name;
      ui.sub.textContent = `${idle[0].drops} kart hakkı kaldı · ${nf.format(idle[0].hours)} saat oynama`;
    } else if (idle.length > 1) {
      ui.title.textContent = `${idle.length} oyun eşzamanlı çalışıyor`;
      ui.sub.textContent = `Toplam ${idle.reduce((a, x) => a + x.drops, 0)} kart hakkı bu oyunlarda`;
    } else {
      ui.title.textContent = status.title;
      ui.sub.textContent = status.sub;
    }
    ui.chips.replaceChildren(...(idle.length > 1 ? idle.slice(0, 8).map((x) => h('span', { class: 'chip', text: x.name })) : []),
      ...(idle.length > 8 ? [h('span', { class: 'chip', text: `+${idle.length - 8}` })] : []));
    ui.chips.hidden = idle.length < 2;

    const running = e.run === 'running';
    ui.toggle.replaceChildren(icon(running ? 'pause' : 'play', 16), running ? 'Duraklat' : (e.run === 'paused' ? 'Devam et' : 'Başlat'));
    ui.next.disabled = e.totals.queued + e.totals.idling < 2;
    ui.auto.hidden = !e.pinned;

    // sayaçlar
    ui.refreshBtn.disabled = e.refreshing;
    ui.refreshBtn.firstChild.style.animation = e.refreshing ? 'spin 1s linear infinite' : 'none';
    const T = e.totals;
    setVal(ui.t.drops.val, nf.format(T.drops));
    ui.t.drops.sub.textContent = `${nf.format(T.games)} oyunda${T.completed ? ` · ${nf.format(T.completed)} oyun tamam` : ''}`;
    setVal(ui.t.queue.val, nf.format(T.queued));
    ui.t.queue.sub.textContent = T.idling ? `${T.idling} oyun şu an çalışıyor` : 'şu an çalışan yok';
    setVal(ui.t.got.val, nf.format(e.session.dropped));
    ui.t.got.sub.textContent = e.session.droppedValueText && e.session.dropped ? `≈ ${e.session.droppedValueText}` : 'henüz kart düşmedi';
    if (T.grossText) {
      setVal(ui.t.value.val, T.grossText);
      ui.t.value.sub.textContent = `net ≈ ${T.netText} · ${T.priced}/${T.games} fiyatlı`;
    } else {
      setVal(ui.t.value.val, '—');
      ui.t.value.sub.textContent = e.priceProgress.total ? `fiyatlar alınıyor (${e.priceProgress.done}/${e.priceProgress.total})` : 'fiyatlar bekleniyor';
    }
    if (lastDropped != null && e.session.dropped > lastDropped) toast(`Kart düştü · bu oturumda ${e.session.dropped}`);
    lastDropped = e.session.dropped;
    tickClock();

    ui.order.value = state.settings.order;
    ui.priceNote.hidden = !(e.priceProgress.total > 0);
    ui.priceNote.textContent = e.priceProgress.total ? `Kart fiyatları Steam Pazarı'ndan alınıyor (${e.priceProgress.done}/${e.priceProgress.total}) — hız sınırı yüzünden yavaş.` : '';

    renderList();
    renderSide(e);
  }

  function setVal(el, text) {
    if (el.textContent === text) return;
    el.textContent = text;
    el.classList.remove('bump'); void el.offsetWidth; el.classList.add('bump');
  }

  function heroStatus(state, e) {
    if (state.net === 'offline') return { tone: 'bad', label: 'Çevrimdışı', title: 'Bağlantı bekleniyor', sub: 'Steam bağlantısı kesildi, otomatik yeniden denenecek.' };
    if (e.run === 'running' && e.blocked) return { tone: 'warn', label: 'Beklemede', title: 'Steam\'de başka oyun açık', sub: 'Hesabında başka bir yerde oyun oynanıyor. Kapanınca otomatik devam eder.' };
    if (e.finished) return { tone: 'ok', label: 'Tamamlandı', title: 'Tüm kartlar düştü', sub: 'Sırada kart hakkı olan oyun kalmadı.' };
    if (e.run === 'running') return { tone: e.active ? 'ok' : 'warn', label: e.active ? 'Çalışıyor' : 'Hazırlanıyor', title: 'Kuyruk hazırlanıyor', sub: 'Rozetler okunuyor…' };
    if (e.run === 'paused') return { tone: '', label: 'Duraklatıldı', title: 'Duraklatıldı', sub: 'Devam et\'e basınca kaldığın yerden sürer. Hesabın oyun oynuyor görünmez.' };
    return { tone: '', label: 'Hazır', title: 'Hazır', sub: `${nf.format(e.totals.drops)} kart hakkı seni bekliyor.` };
  }

  function tickClock() {
    if (!S || !S.engine || !ui.t) return;
    const s = S.engine.session;
    const ms = s.activeMs + (s.runningSince ? Date.now() - s.runningSince : 0);
    ui.t.uptime.val.textContent = clock(ms);
    ui.t.uptime.sub.textContent = `toplam ${longDur(S.engine.lifetime.activeMs + (s.runningSince ? Date.now() - s.runningSince : 0))}`;
    if (S.engine.lastRefresh) ui.lastRefresh.textContent = `Son yenileme ${hhmmss(S.engine.lastRefresh)}`;
    else ui.lastRefresh.textContent = S.engine.refreshing ? 'Okunuyor…' : '';
  }
  setInterval(tickClock, 1000);

  function renderList() {
    if (!S || !S.engine || !ui.list) return;
    const all = S.engine.games;
    const needle = q.search;
    const blackCount = all.filter((x) => x.black).length;
    let rows = all.filter((x) => (q.black ? x.black : !x.black) && (!needle || x.name.toLocaleLowerCase('tr').includes(needle)));
    const order = S.settings.order;
    rows = rows.slice().sort((a, b) => {
      if (order === 'name') return a.name.localeCompare(b.name, 'tr');
      if (order === 'hours-asc') return a.hours - b.hours || b.drops - a.drops;
      if (order === 'value-desc') return (b.value ?? -1) - (a.value ?? -1) || b.drops - a.drops;
      return b.drops - a.drops || a.hours - b.hours;
    });
    ui.blackBtn.classList.toggle('on', q.black);
    ui.blackBtn.title = q.black ? 'Sıraya dön' : `Gizlenen oyunlar (${blackCount})`;
    ui.count.textContent = q.black ? `${rows.length} gizli oyun` : `${rows.length} oyun`;
    const sig = JSON.stringify([rows.map((r) => [r.appid, r.drops, r.hours, r.idle, r.black, r.pinned, r.valueText]), needle, q.black]);
    if (sig === listSig) return;
    listSig = sig;
    const top = ui.list.scrollTop;
    if (!rows.length) {
      ui.list.replaceChildren(h('div', { class: 'empty-note', text: q.black ? 'Gizlenmiş oyun yok.' : (needle ? 'Eşleşen oyun yok.' : 'Sırada kart hakkı olan oyun yok.') }));
      return;
    }
    const frag = document.createDocumentFragment();
    for (const r of rows.slice(0, 600)) frag.append(gameRow(r));
    ui.list.replaceChildren(frag);
    ui.list.scrollTop = top;
  }

  function gameRow(r) {
    const meta = `${nf.format(r.hours)} saat oynama${r.unitText ? ` · kart ≈ ${r.unitText}` : ''}`;
    return h('div', { class: 'row' + (r.idle ? ' idle' : '') + (r.black ? ' black' : '') },
      h('div', { class: 'thumb' }, gameImg(r.appid, 'capsule')),
      h('div', {},
        h('div', { class: 'r-name' }, r.idle ? h('span', { class: 'live', title: 'Çalışıyor' }) : null, h('span', { text: r.name })),
        h('div', { class: 'r-meta', text: meta })),
      h('div', { class: 'r-nums' }, h('span', { class: 'r-val num', text: r.valueText || '' }), h('span', { class: 'badge num', title: 'Kalan kart hakkı', text: r.drops })),
      h('div', { class: 'r-act' },
        r.black ? null : h('button', { class: 'icon-btn sm', title: r.pinned ? 'Otomatiğe dön' : 'Şimdi bunu çalıştır', onclick: () => (r.pinned ? api.unpin() : api.pin(r.appid)) }, icon(r.pinned ? 'x' : 'play', 15)),
        h('button', { class: 'icon-btn sm', title: r.black ? 'Sıraya geri al' : 'Sıradan gizle', onclick: () => api.blacklist(r.appid, !r.black) }, icon(r.black ? 'eye' : 'eyeoff', 15))));
  }

  function renderSide(e) {
    ui.logEl.replaceChildren(...e.logs.map((l) => h('li', { class: l.kind }, h('i'), h('span', { text: l.text }), h('time', { text: hhmm(l.t) }))));
    if (!e.logs.length) ui.logEl.replaceChildren(h('li', {}, h('i'), h('span', { class: 'muted', text: 'Henüz etkinlik yok' }), h('time')));
    const kv = (a, b) => h('div', {}, h('span', { text: a }), h('span', { class: 'num', text: b }));
    ui.kv.replaceChildren(
      kv('Toplam çalışma', longDur(e.lifetime.activeMs)),
      kv('Toplam düşen kart', nf.format(e.lifetime.dropped)),
      kv('Tahmini kazanç', e.lifetime.valueText && e.lifetime.dropped ? e.lifetime.valueText : '—'),
      kv('Hesap', S.account && S.account.name ? S.account.name : '—'));
  }

  // ---- ayarlar ------------------------------------------------------------------------------------------
  let modal = null;
  function closeModal() { if (modal) { modal.remove(); modal = null; } }
  function closeModalIfLocked(state) { if (state.phase !== 'ready') closeModal(); }

  function overlay(content) {
    closeModal();
    modal = h('div', { class: 'overlay', onmousedown: (e) => { if (e.target === modal) closeModal(); } }, content);
    document.body.append(modal);
    return modal;
  }

  function confirmDialog({ title, text, ok, danger, typed }) {
    return new Promise((resolve) => {
      const input = typed ? h('input', { type: 'text', placeholder: `Onaylamak için ${typed} yaz`, autocomplete: 'off' }) : null;
      const okBtn = h('button', { class: 'btn ' + (danger ? 'danger' : 'primary'), text: ok, disabled: !!typed });
      if (input) input.addEventListener('input', () => { okBtn.disabled = input.value.trim() !== typed; });
      const done = (v) => { box.remove(); resolve(v); };
      okBtn.addEventListener('click', () => done(true));
      const box = h('div', { class: 'overlay', onmousedown: (e) => { if (e.target === box) done(false); } },
        h('div', { class: 'modal confirm' }, h('h3', { text: title }), h('p', { text }), input,
          h('div', { class: 'row-btns' }, h('button', { class: 'btn', text: 'Vazgeç', onclick: () => done(false) }), okBtn)));
      document.body.append(box);
      if (input) input.focus();
    });
  }

  function setRow(label, hint, control) {
    return h('div', { class: 'set' }, h('div', { class: 'txt' }, h('b', { text: label }), hint ? h('span', { text: hint }) : null), control);
  }
  function sw(key, on) {
    const input = h('input', { type: 'checkbox', onchange: (e) => api.setSettings({ [key]: e.target.checked }) });
    input.checked = !!on;
    return h('label', { class: 'switch' }, input, h('i'));
  }
  function sel(key, value, options) {
    const s = h('select', { onchange: (e) => api.setSettings({ [key]: key === 'concurrency' || key === 'order' ? e.target.value : Number(e.target.value) }) },
      options.map(([v, t]) => h('option', { value: v, text: t })));
    s.value = String(value);
    return s;
  }

  function openSettings() {
    const st = S && S.settings;
    if (!st) return;
    const themeSeg = h('div', { class: 'seg' }, [['system', 'Sistem'], ['dark', 'Koyu'], ['light', 'Açık']].map(([v, t]) =>
      h('button', { class: st.theme === v ? 'on' : '', text: t, onclick: (e) => { api.setSettings({ theme: v }); e.target.parentNode.querySelectorAll('button').forEach((b) => b.classList.remove('on')); e.target.classList.add('on'); } })));

    const pwForm = h('div', { class: 'subform', hidden: true });
    const o = h('input', { type: 'password', placeholder: 'Mevcut parola', autocomplete: 'off', maxlength: 128 });
    const n1 = h('input', { type: 'password', placeholder: 'Yeni parola', autocomplete: 'off', maxlength: 128 });
    const n2 = h('input', { type: 'password', placeholder: 'Yeni parola (tekrar)', autocomplete: 'off', maxlength: 128 });
    const pwErr = h('div', { class: 'err' });
    const pwSave = h('button', { class: 'btn primary sm', text: 'Parolayı güncelle', onclick: async () => {
      pwErr.textContent = '';
      if (n1.value !== n2.value) { pwErr.textContent = 'Yeni parolalar aynı değil.'; return; }
      const r = await api.changePassphrase(o.value, n1.value);
      if (r.ok) { closeModal(); toast('Parola güncellendi'); } else pwErr.textContent = r.message || (r.code === 'WRONG' ? `Mevcut parola yanlış (kalan: ${r.left})` : r.code === 'LOCKED' ? 'Bir süre bekle.' : 'Başarısız.');
    } });
    pwForm.append(o, n1, n2, pwErr, pwSave);

    const body = h('div', { class: 'modal-body scroll' },
      h('h4', { text: 'Görünüm' }), setRow('Tema', null, themeSeg),
      h('h4', { text: 'Çalışma' }),
      setRow('Eşzamanlı oyun', 'Akıllı: 2 saatin altındakiler birlikte, sonra tek tek.', sel('concurrency', st.concurrency, [['smart', 'Akıllı (önerilen)'], ['1', '1 oyun'], ['2', '2 oyun'], ['4', '4 oyun'], ['8', '8 oyun'], ['16', '16 oyun'], ['32', '32 oyun']])),
      setRow('Kuyruk sırası', null, sel('order', st.order, [['drops-desc', 'En çok kart'], ['value-desc', 'En değerli'], ['hours-asc', 'En az saat'], ['name', 'Ada göre']])),
      setRow('Otomatik yenileme', 'Rozetler bu aralıkla okunur.', sel('refreshMinutes', st.refreshMinutes, [[2, '2 dakika'], [5, '5 dakika'], [10, '10 dakika'], [15, '15 dakika'], [30, '30 dakika']])),
      setRow('Girişte otomatik başlat', null, sw('autoStart', st.autoStart)),
      setRow('Çalışırken bilgisayarı uyanık tut', null, sw('keepAwake', st.keepAwake)),
      setRow('Pencereyi kapatınca tepsiye küçül', 'Çalışırken kapatırsan arka planda sürer ve kilitlenir.', sw('closeToTray', st.closeToTray)),
      h('h4', { text: 'Güvenlik' }),
      setRow('Otomatik kilit', 'Hareketsiz kalınca arayüz parolayla kilitlenir.', sel('lockMinutes', st.lockMinutes, [[0, 'Kapalı'], [2, '2 dakika'], [5, '5 dakika'], [10, '10 dakika'], [30, '30 dakika'], [60, '1 saat']])),
      setRow('Kasa parolası', null, h('button', { class: 'btn sm', text: 'Değiştir', onclick: () => { pwForm.hidden = !pwForm.hidden; } })),
      pwForm,
      setRow('Steam oturumunu kapat', 'Kayıtlı Steam anahtarını siler; yeniden QR gerekir.', h('button', { class: 'btn sm danger', text: 'Oturumu kapat', onclick: async () => {
        if (await confirmDialog({ title: 'Oturumu kapat', text: 'Kayıtlı Steam anahtarı silinecek ve çalışma duracak. Tekrar QR ile giriş yapman gerekir.', ok: 'Oturumu kapat', danger: true })) { closeModal(); api.logout(); }
      } })),
      setRow('Tüm yerel verileri sil', 'Kasa, ayarlar, istatistik ve önbellek.', h('button', { class: 'btn sm danger', text: 'Hepsini sil', onclick: async () => {
        if (await confirmDialog({ title: 'Tüm yerel veriler silinsin mi?', text: 'Parola kasası dahil her şey silinir. Bu işlem geri alınamaz.', ok: 'Sil', danger: true, typed: 'SIL' })) { closeModal(); api.wipe('SIL'); }
      } })),
      h('h4', { text: 'Bu uygulama nasıl korunuyor' }),
      h('ul', { class: 'sec-list' },
        h('li', { text: 'Steam parolan hiç alınmaz; giriş QR ile yapılır.' }),
        h('li', { text: 'Oturum anahtarı parolandan türetilen AES-256 anahtarıyla şifrelenir, üstüne Windows DPAPI uygulanır.' }),
        h('li', { text: 'Yanlış parola denemeleri yavaşlatılır; 10 hatada kasa silinir.' }),
        h('li', { text: 'Arayüz internete çıkamaz; ağ trafiği yalnızca izinli Steam adreslerine gider.' }),
        h('li', { text: 'Telemetri, reklam, dış sunucu ya da açık port yok. Hesap bilgin başka yere gönderilmez.' })));

    overlay(h('div', { class: 'modal' },
      h('div', { class: 'modal-head' }, h('h3', { text: 'Ayarlar' }), h('button', { class: 'icon-btn', onclick: closeModal }, icon('x', 18))), body));
  }

  // ---- giriş noktası ---------------------------------------------------------------------------------------
  let lastPing = 0;
  function ping() { const n = Date.now(); if (n - lastPing > 4000) { lastPing = n; api.activity(); } }
  for (const ev of ['pointermove', 'pointerdown', 'keydown', 'wheel']) window.addEventListener(ev, ping, { passive: true });
  window.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeModal(); });
  window.addEventListener('contextmenu', (e) => e.preventDefault());

  api.onState(render);
  api.getState().then((r) => { if (r && r.ok) render(r.state); });
})();
