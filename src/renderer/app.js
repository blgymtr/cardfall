'use strict';
(() => {
  const api = window.cardfall;
  const I18N = window.I18N;
  const NS = 'http://www.w3.org/2000/svg';
  const root = document.getElementById('root');
  const tbActions = document.getElementById('tb-actions');

  // ---- dil -------------------------------------------------------------------------------
  let lang = 'en';
  let nf = new Intl.NumberFormat(I18N.LOCALES.en);
  const T = (key, params) => I18N.t(lang, key, params);
  function applyLang(next) {
    lang = next;
    nf = new Intl.NumberFormat(I18N.LOCALES[lang]);
    document.documentElement.lang = lang;
  }

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
    coin: [['circle', { cx: 12, cy: 12, r: 10 }], ['path', { d: 'M15 9c-.6-1-1.7-1.5-3-1.5-1.7 0-3 .9-3 2.2 0 3 6 1.6 6 4.6 0 1.3-1.3 2.2-3 2.2-1.3 0-2.4-.6-3-1.5M12 6v1.5m0 9V18' }]],
    shield: [['path', { d: 'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z' }], ['polyline', { points: '9 12 11 14 15 10' }]],
    check: [['polyline', { points: '20 6 9 17 4 12' }]],
    chart: [['line', { x1: 18, y1: 20, x2: 18, y2: 10 }], ['line', { x1: 12, y1: 20, x2: 12, y2: 4 }], ['line', { x1: 6, y1: 20, x2: 6, y2: 14 }]],
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
    if (m < 60) return T('dur.min', { n: m });
    const hr = Math.floor(m / 60);
    return hr < 100 ? T('dur.hm', { h: hr, m: m % 60 }) : T('dur.h', { h: nf.format(hr) });
  }
  const hhmm = (t) => new Date(t).toLocaleTimeString(I18N.LOCALES[lang], { hour: '2-digit', minute: '2-digit' });
  const hhmmss = (t) => new Date(t).toLocaleTimeString(I18N.LOCALES[lang]);
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
  let view = null;       // şu an gösterilen görünüm
  let ui = {};           // ekran referansları
  let lastDropped = null;
  let waitUntil = 0;
  let q = { search: '', black: false };
  let listSig = '';

  function render(state) {
    if (state.lang && state.lang !== lang) {
      applyLang(state.lang);
      view = null; ui = {}; listSig = ''; lastDropped = null;
      tbActions.dataset.sig = '';
      closeModal();
    }
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
    if (state.phase !== 'ready') closeModal();
  }

  function renderTitleActions(state) {
    const ready = state.phase === 'ready';
    const canLock = ready || state.phase === 'login' || state.phase === 'connecting';
    const sig = `${ready ? 'r' : canLock ? 'l' : 'n'}:${lang}`;
    if (tbActions.dataset.sig === sig) return;
    tbActions.dataset.sig = sig;
    tbActions.replaceChildren();
    const langSel = h('select', { class: 'lang-sel', title: T('tb.lang'), 'aria-label': T('tb.lang'), onchange: (e) => api.setLanguage(e.target.value) },
      I18N.LANGS.map((l) => h('option', { value: l, text: I18N.NAMES[l] })));
    langSel.value = lang;
    tbActions.append(langSel);
    if (ready) tbActions.append(h('button', { class: 'icon-btn', title: T('tb.stats'), onclick: () => openStats() }, icon('chart', 17)));
    if (ready) tbActions.append(h('button', { class: 'icon-btn', title: T('tb.settings'), onclick: () => openSettings() }, icon('sliders', 17)));
    if (canLock) tbActions.append(h('button', { class: 'icon-btn', title: T('tb.lock'), onclick: () => api.lock() }, icon('lock', 17)));
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
      const pass = h('input', { type: 'password', placeholder: setup ? T('gate.passNew') : T('gate.pass'), autocomplete: 'off', spellcheck: 'false', maxlength: 128 });
      const pass2 = setup ? h('input', { type: 'password', placeholder: T('gate.passRepeat'), autocomplete: 'off', spellcheck: 'false', maxlength: 128 }) : null;
      const meter = setup ? h('div', { class: 'meter', 'data-s': '0' }, h('i'), h('i'), h('i'), h('i')) : null;
      const err = h('p', { class: 'err' });
      const btn = h('button', { class: 'btn primary big', type: 'submit', text: setup ? T('gate.create') : T('gate.unlock') });
      const form = h('form', { novalidate: true }, pass, pass2, meter, err, btn);
      const notice = h('p', { class: 'notice', hidden: true });
      const sub = h('p', { class: 'sub', text: setup ? T('gate.setupSub') : T('gate.lockedSub') });
      const forgot = setup ? null : h('button', { class: 'btn sm', type: 'button', text: T('gate.forgot'), onclick: async () => {
        if (await confirmDialog({ title: T('forgot.title'), text: T('forgot.text'), ok: T('forgot.ok'), danger: true, typed: I18N.CONFIRM_WORD[lang] })) api.wipe('SIL');
      } });
      const card = h('div', { class: 'card gate-card' },
        h('img', { class: 'logo', src: 'icon.png', alt: '' }), h('h1', { text: 'Cardfall' }), sub, notice, form, forgot,
        h('p', { class: 'fine', text: setup ? T('gate.fineSetup') : T('gate.fineLocked') }));
      ui.gate = { pass, pass2, meter, err, btn, notice, sub };
      if (setup) pass.addEventListener('input', () => { meter.dataset.s = String(strength(pass.value)); });
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (btn.disabled) return;
        err.textContent = '';
        if (setup) {
          if (pass.value !== pass2.value) { err.textContent = T('gate.mismatch'); return; }
          btn.disabled = true;
          const r = await api.setup(pass.value);
          btn.disabled = false;
          if (!r.ok) err.textContent = r.messageKey ? T(r.messageKey) : T('gate.setupFail');
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
    g.notice.textContent = state.notice ? T(state.notice) : '';
    if (!setup && state.lock && state.lock.waitMs > 0 && !waitUntil) {
      waitUntil = Date.now() + state.lock.waitMs;
      tickWait();
    }
    if (!setup && state.lock && state.lock.fails > 0 && !g.err.textContent && !waitUntil) {
      g.err.textContent = T('gate.attemptsLeft', { n: state.lock.left });
    }
  }

  function gateError(r) {
    const g = ui.gate;
    if (!g) return;
    if (r.code === 'WRONG') g.err.textContent = T('gate.wrong', { n: r.left });
    else if (r.code === 'LOCKED') g.err.textContent = T('gate.tooMany');
    else if (r.code === 'WIPED') g.err.textContent = T('gate.wiped');
    else if (r.code === 'CORRUPT') g.err.textContent = T('gate.corrupt');
    else if (r.code === 'BUSY') g.err.textContent = T('gate.busy');
    else g.err.textContent = T('gate.fail');
    if (r.waitMs > 0) { waitUntil = Date.now() + r.waitMs; tickWait(); }
  }

  function tickWait() {
    const g = ui.gate;
    if (!g || !g.btn) return;
    const left = waitUntil - Date.now();
    if (left <= 0) { waitUntil = 0; g.btn.disabled = false; g.err.textContent = ''; return; }
    g.btn.disabled = true;
    g.err.textContent = T('gate.wait', { s: Math.ceil(left / 1000) });
    setTimeout(tickWait, 500);
  }

  // ---- giriş (QR) ---------------------------------------------------------------------------------
  function showLogin(state) {
    if (view !== 'login') {
      view = 'login';
      const box = h('div', { class: 'qr-box' });
      ui.login = { box, notice: h('p', { class: 'notice', hidden: true }) };
      const right = h('div', {},
        h('h2', { text: T('login.title') }),
        h('p', { text: T('login.lead') }),
        ui.login.notice,
        h('ol', { class: 'steps' }, h('li', { text: T('login.s1') }), h('li', { text: T('login.s2') }), h('li', { text: T('login.s3') })),
        h('div', { class: 'shield' }, icon('shield', 18), h('span', { text: T('login.shield') })));
      root.replaceChildren(h('div', { class: 'center' }, h('div', { class: 'card login' }, box, right)));
    }
    const { box, notice } = ui.login;
    notice.hidden = !state.notice;
    notice.textContent = state.notice ? T(state.notice) : '';
    const qr = state.qr || { state: 'idle' };
    const sig = qr.state + (qr.image ? qr.image.length : '');
    if (box.dataset.sig === sig) return;
    box.dataset.sig = sig;
    box.replaceChildren();
    if (qr.image) box.append(h('img', { src: qr.image, alt: T('qr.alt'), draggable: 'false' }));
    if (qr.state === 'idle') box.append(h('div', { class: 'qr-veil' }, h('div', { class: 'spinner' }), h('span', { text: T('qr.preparing') })));
    else if (qr.state === 'scanned') box.append(h('div', { class: 'qr-veil' }, icon('check', 34), h('span', { text: T('qr.scanned') })));
    else if (qr.state === 'expired') box.append(h('div', { class: 'qr-veil' }, h('div', { class: 'spinner' }), h('span', { text: T('qr.expired') })));
    else if (qr.state === 'error') box.append(h('div', { class: 'qr-veil' }, h('span', { text: qr.error ? T(qr.error) : T('qr.generic') }), h('button', { class: 'btn primary', text: T('qr.retry'), onclick: () => api.startLogin() })));
  }

  function showConnecting(state) {
    if (view !== 'connecting') {
      view = 'connecting';
      ui.conn = { msg: h('p', { class: 'muted' }) };
      root.replaceChildren(h('div', { class: 'center' }, h('div', { class: 'card gate-card' },
        h('div', { class: 'spinner' }), h('h1', { text: T('conn.title') }), ui.conn.msg)));
    }
    ui.conn.msg.textContent = state.connectError ? T('conn.problem', { reason: state.connectError })
      : (state.account && state.account.name ? T('conn.account', { name: state.account.name }) : T('conn.wait'));
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
    const next = h('button', { class: 'btn', onclick: () => api.next() }, icon('next', 16), T('btn.next'));
    const auto = h('button', { class: 'btn', onclick: () => api.unpin() }, icon('layers', 16), T('btn.auto'));
    const hero = h('section', { class: 'card hero' }, art,
      h('div', { class: 'hero-info' }, eyebrow, title, sub, chips, flow, h('div', { class: 'hero-actions' }, toggle, next, auto)));

    const lastRefresh = h('span', { class: 'muted small' });
    const refreshBtn = h('button', { class: 'btn sm', onclick: () => { refreshBtn.disabled = true; api.refresh(); } }, icon('refresh', 14), h('span', { text: T('btn.refresh') }));
    const head = h('div', { class: 'section-head' }, h('h2', { text: T('ov.title') }), h('div', { class: 'grow' }), lastRefresh, refreshBtn);

    const t = {
      uptime: tile(T('s.uptime'), 'clock', false),
      drops: tile(T('s.drops'), 'cards', false),
      queue: tile(T('s.queue'), 'list', false),
      got: tile(T('s.got'), 'gift', false),
      value: tile(T('s.value'), 'coin', true),
    };
    const stats = h('div', { class: 'stats' }, t.uptime.el, t.drops.el, t.queue.el, t.got.el, t.value.el);

    const search = h('input', { type: 'search', placeholder: T('queue.search'), spellcheck: 'false', oninput: (e) => { q.search = e.target.value.trim().toLocaleLowerCase(lang); renderList(); } });
    const order = h('select', { onchange: (e) => api.setSettings({ order: e.target.value }) },
      ['drops-desc', 'value-desc', 'hours-asc', 'name'].map((o) => h('option', { value: o, text: T('ord.' + o) })));
    const blackBtn = h('button', { class: 'icon-btn', onclick: () => { q.black = !q.black; renderList(); } }, icon('eyeoff', 16));
    const count = h('span', { class: 'count' });
    const list = h('div', { class: 'list scroll' });
    const priceNote = h('div', { class: 'price-note', hidden: true });
    const queueCard = h('section', { class: 'card panel' },
      h('div', { class: 'panel-head' }, h('h3', { text: T('queue.title') }), count, h('div', { class: 'tools' }, search, order, blackBtn)), list, priceNote);

    const logEl = h('ul', { class: 'log scroll' });
    const kv = h('div', { class: 'kv' });
    const side = h('div', { class: 'side' },
      h('section', { class: 'card panel' }, h('div', { class: 'panel-head' }, h('h3', { text: T('side.activity') })), logEl),
      h('section', { class: 'card panel' }, h('div', { class: 'panel-head' }, h('h3', { text: T('side.totals') })), kv));

    ui = { art, eyebrow, title, sub, chips, flow, toggle, next, auto, lastRefresh, refreshBtn, t, search, order, blackBtn, count, list, priceNote, logEl, kv };
    return h('div', { class: 'app' }, hero, head, stats, h('div', { class: 'lower' }, queueCard, side));
  }

  function showApp(state) {
    if (view !== 'app') { view = 'app'; root.replaceChildren(buildApp()); lastDropped = null; listSig = ''; }
    const e = state.engine;
    const g = e.games;
    const byId = new Map(g.map((x) => [x.appid, x]));

    const status = heroStatus(state, e);
    ui.eyebrow.replaceChildren(...[h('span', { class: 'pill ' + status.tone }, h('span', { class: 'dot' }), status.label),
      state.net === 'offline' ? h('span', { class: 'pill bad' }, h('span', { class: 'dot' }), T('pill.offline')) : null,
      e.pinned ? h('span', { class: 'pill' }, T('pill.pinned')) : null].filter(Boolean));
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
      ui.sub.textContent = T('hero.one.sub', { drops: idle[0].drops, hours: nf.format(idle[0].hours) });
    } else if (idle.length > 1) {
      ui.title.textContent = T('hero.many.title', { n: idle.length });
      ui.sub.textContent = T('hero.many.sub', { n: idle.reduce((a, x) => a + x.drops, 0) });
    } else {
      ui.title.textContent = status.title;
      ui.sub.textContent = status.sub;
    }
    ui.chips.replaceChildren(...(idle.length > 1 ? idle.slice(0, 8).map((x) => h('span', { class: 'chip', text: x.name })) : []),
      ...(idle.length > 8 ? [h('span', { class: 'chip', text: `+${idle.length - 8}` })] : []));
    ui.chips.hidden = idle.length < 2;

    const running = e.run === 'running';
    ui.toggle.replaceChildren(icon(running ? 'pause' : 'play', 16), running ? T('btn.pause') : (e.run === 'paused' ? T('btn.resume') : T('btn.start')));
    ui.next.disabled = e.totals.queued + e.totals.idling < 2;
    ui.auto.hidden = !e.pinned;

    ui.refreshBtn.disabled = e.refreshing;
    ui.refreshBtn.firstChild.style.animation = e.refreshing ? 'spin 1s linear infinite' : 'none';
    const Tt = e.totals;
    setVal(ui.t.drops.val, nf.format(Tt.drops));
    ui.t.drops.sub.textContent = T('s.dropsSub', { n: Tt.games }) + (Tt.completed ? T('s.dropsDone', { n: nf.format(Tt.completed) }) : '');
    setVal(ui.t.queue.val, nf.format(Tt.queued));
    ui.t.queue.sub.textContent = Tt.idling ? T('s.queueSub', { n: Tt.idling }) : T('s.queueNone');
    setVal(ui.t.got.val, nf.format(e.session.dropped));
    ui.t.got.sub.textContent = e.session.droppedValueText && e.session.dropped ? `≈ ${e.session.droppedValueText}` : T('s.gotNone');
    if (Tt.grossText) {
      setVal(ui.t.value.val, Tt.grossText);
      ui.t.value.sub.textContent = T('s.valueSub', { net: Tt.netText, p: Tt.priced, g: Tt.games });
    } else {
      setVal(ui.t.value.val, '—');
      ui.t.value.sub.textContent = e.priceProgress.total ? T('s.valuePrices', { d: e.priceProgress.done, t: e.priceProgress.total }) : T('s.valueWait');
    }
    if (lastDropped != null && e.session.dropped > lastDropped) toast(T('toast.drop', { n: e.session.dropped }));
    lastDropped = e.session.dropped;
    tickClock();

    ui.order.value = state.settings.order;
    ui.priceNote.hidden = !(e.priceProgress.total > 0);
    ui.priceNote.textContent = e.priceProgress.total ? T('price.note', { d: e.priceProgress.done, t: e.priceProgress.total }) : '';

    renderList();
    renderSide(e);
  }

  function setVal(el, text) {
    if (el.textContent === text) return;
    el.textContent = text;
    el.classList.remove('bump'); void el.offsetWidth; el.classList.add('bump');
  }

  function heroStatus(state, e) {
    if (state.net === 'offline') return { tone: 'bad', label: T('st.offline'), title: T('hs.offline.title'), sub: T('hs.offline.sub') };
    if (e.run === 'running' && e.blocked) return { tone: 'warn', label: T('st.waiting'), title: T('hs.blocked.title'), sub: T('hs.blocked.sub') };
    if (e.finished) return { tone: 'ok', label: T('st.done'), title: T('hs.done.title'), sub: T('hs.done.sub') };
    if (e.run === 'running') return { tone: e.active ? 'ok' : 'warn', label: e.active ? T('st.running') : T('st.preparing'), title: T('hs.prep.title'), sub: T('hs.prep.sub') };
    if (e.run === 'paused') return { tone: '', label: T('st.paused'), title: T('st.paused'), sub: T('hs.paused.sub') };
    return { tone: '', label: T('st.ready'), title: T('hs.ready.title'), sub: T('hs.ready.sub', { n: nf.format(e.totals.drops) }) };
  }

  function tickClock() {
    if (!S || !S.engine || !ui.t) return;
    const s = S.engine.session;
    const live = s.runningSince ? Date.now() - s.runningSince : 0;
    ui.t.uptime.val.textContent = clock(s.activeMs + live);
    ui.t.uptime.sub.textContent = T('s.uptimeSub', { t: longDur(S.engine.lifetime.activeMs + live) });
    if (S.engine.lastRefresh) ui.lastRefresh.textContent = T('ov.last', { time: hhmmss(S.engine.lastRefresh) });
    else ui.lastRefresh.textContent = S.engine.refreshing ? T('ov.reading') : '';
  }
  setInterval(tickClock, 1000);

  function renderList() {
    if (!S || !S.engine || !ui.list) return;
    const all = S.engine.games;
    const needle = q.search;
    const blackCount = all.filter((x) => x.black).length;
    let rows = all.filter((x) => (q.black ? x.black : !x.black) && (!needle || x.name.toLocaleLowerCase(lang).includes(needle)));
    const order = S.settings.order;
    rows = rows.slice().sort((a, b) => {
      if (order === 'name') return a.name.localeCompare(b.name, lang);
      if (order === 'hours-asc') return a.hours - b.hours || b.drops - a.drops;
      if (order === 'value-desc') return (b.value ?? -1) - (a.value ?? -1) || b.drops - a.drops;
      return b.drops - a.drops || a.hours - b.hours;
    });
    ui.blackBtn.classList.toggle('on', q.black);
    ui.blackBtn.title = q.black ? T('queue.back') : T('queue.showHidden', { n: blackCount });
    ui.count.textContent = q.black ? T('queue.countHidden', { n: rows.length }) : T('queue.count', { n: rows.length });
    const sig = JSON.stringify([rows.map((r) => [r.appid, r.drops, r.hours, r.idle, r.black, r.pinned, r.valueText]), needle, q.black]);
    if (sig === listSig) return;
    listSig = sig;
    const top = ui.list.scrollTop;
    if (!rows.length) {
      ui.list.replaceChildren(h('div', { class: 'empty-note', text: q.black ? T('queue.emptyHidden') : (needle ? T('queue.emptySearch') : T('queue.empty')) }));
      return;
    }
    const frag = document.createDocumentFragment();
    for (const r of rows.slice(0, 600)) frag.append(gameRow(r));
    ui.list.replaceChildren(frag);
    ui.list.scrollTop = top;
  }

  function gameRow(r) {
    const meta = T('row.hours', { h: nf.format(r.hours) }) + (r.unitText ? T('row.card', { p: r.unitText }) : '');
    return h('div', { class: 'row' + (r.idle ? ' idle' : '') + (r.black ? ' black' : '') },
      h('div', { class: 'thumb clickable', title: T('row.info'), onclick: () => openGameInfo(r) }, gameImg(r.appid, 'capsule')),
      h('div', { class: 'clickable', title: T('row.info'), onclick: () => openGameInfo(r) },
        h('div', { class: 'r-name' }, r.idle ? h('span', { class: 'live', title: T('row.live') }) : null, h('span', { text: r.name }), r.stuck ? h('span', { class: 'flag', title: T('row.stalled') }, icon('clock', 13)) : null),
        h('div', { class: 'r-meta', text: meta })),
      h('div', { class: 'r-nums' }, h('span', { class: 'r-val num', text: r.valueText || '' }), h('span', { class: 'badge num', title: T('row.drops'), text: r.drops })),
      h('div', { class: 'r-act' },
        r.black ? null : h('button', { class: 'icon-btn sm', title: r.pinned ? T('row.toAuto') : T('row.runNow'), onclick: () => (r.pinned ? api.unpin() : api.pin(r.appid)) }, icon(r.pinned ? 'x' : 'play', 15)),
        h('button', { class: 'icon-btn sm', title: r.black ? T('row.unhide') : T('row.hide'), onclick: () => api.blacklist(r.appid, !r.black) }, icon(r.black ? 'eye' : 'eyeoff', 15))));
  }

  function renderSide(e) {
    ui.logEl.replaceChildren(...e.logs.map((l) => h('li', { class: l.kind }, h('i'), h('span', { text: T(l.key, l.params) }), h('time', { text: hhmm(l.t) }))));
    if (!e.logs.length) ui.logEl.replaceChildren(h('li', {}, h('i'), h('span', { class: 'muted', text: T('side.none') }), h('time')));
    const kv = (a, b) => h('div', {}, h('span', { text: a }), h('span', { class: 'num', text: b }));
    const L = e.lifetime;
    ui.kv.replaceChildren(
      kv(T('tot.time'), longDur(L.activeMs)),
      kv(T('tot.cards'), nf.format(L.dropped)),
      kv(T('stats.gamesRun'), nf.format(L.gamesRun)),
      kv(T('stats.gamesDropped'), nf.format(L.gamesDropped)),
      kv(T('stats.gamesNoDrop'), nf.format(L.gamesNoDrop)),
      kv(T('tot.value'), L.valueText && L.dropped ? L.valueText : '—'),
      kv(T('tot.account'), S.account && S.account.name ? S.account.name : '—'),
      h('button', { class: 'btn sm', text: T('btn.details'), onclick: () => openStats() }));
  }

  // ---- ayarlar ------------------------------------------------------------------------------------------
  let modal = null;
  function closeModal() { if (modal) { modal.remove(); modal = null; } }

  function overlay(content) {
    closeModal();
    modal = h('div', { class: 'overlay', onmousedown: (e) => { if (e.target === modal) closeModal(); } }, content);
    document.body.append(modal);
    return modal;
  }

  function confirmDialog({ title, text, ok, danger, typed }) {
    return new Promise((resolve) => {
      const input = typed ? h('input', { type: 'text', placeholder: T('confirm.type', { w: typed }), autocomplete: 'off' }) : null;
      const okBtn = h('button', { class: 'btn ' + (danger ? 'danger' : 'primary'), text: ok, disabled: !!typed });
      if (input) input.addEventListener('input', () => { okBtn.disabled = input.value.trim().toUpperCase() !== typed; });
      const done = (v) => { box.remove(); resolve(v); };
      okBtn.addEventListener('click', () => done(true));
      const box = h('div', { class: 'overlay', onmousedown: (e) => { if (e.target === box) done(false); } },
        h('div', { class: 'modal confirm' }, h('h3', { text: title }), h('p', { text }), input,
          h('div', { class: 'row-btns' }, h('button', { class: 'btn', text: T('confirm.cancel'), onclick: () => done(false) }), okBtn)));
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
    const themeSeg = h('div', { class: 'seg' }, ['system', 'dark', 'light'].map((v) =>
      h('button', { class: st.theme === v ? 'on' : '', text: T('theme.' + v), onclick: (e) => { api.setSettings({ theme: v }); e.target.parentNode.querySelectorAll('button').forEach((b) => b.classList.remove('on')); e.target.classList.add('on'); } })));
    const langSel = h('select', { onchange: (e) => api.setLanguage(e.target.value) },
      [h('option', { value: 'auto', text: T('lang.auto') }), ...I18N.LANGS.map((l) => h('option', { value: l, text: I18N.NAMES[l] }))]);
    langSel.value = st.language || 'auto';

    const pwForm = h('div', { class: 'subform', hidden: true });
    const o = h('input', { type: 'password', placeholder: T('pw.old'), autocomplete: 'off', maxlength: 128 });
    const n1 = h('input', { type: 'password', placeholder: T('pw.new'), autocomplete: 'off', maxlength: 128 });
    const n2 = h('input', { type: 'password', placeholder: T('pw.newRepeat'), autocomplete: 'off', maxlength: 128 });
    const pwErr = h('div', { class: 'err' });
    const pwSave = h('button', { class: 'btn primary sm', text: T('pw.update'), onclick: async () => {
      pwErr.textContent = '';
      if (n1.value !== n2.value) { pwErr.textContent = T('pw.mismatch'); return; }
      const r = await api.changePassphrase(o.value, n1.value);
      if (r.ok) { closeModal(); toast(T('pw.updated')); }
      else pwErr.textContent = r.messageKey ? T(r.messageKey) : (r.code === 'WRONG' ? T('pw.wrongOld', { n: r.left }) : r.code === 'LOCKED' ? T('pw.wait') : T('pw.fail'));
    } });
    pwForm.append(o, n1, n2, pwErr, pwSave);

    const sizeLine = h('p', { class: 'muted small', text: '' });
    const cacheRow = setRow(T('data.cache'), T('data.cacheHint', { size: '…' }), h('button', { class: 'btn sm', text: T('btn.clear'), onclick: async () => {
      await api.clearData('cache'); toast(T('data.cleared')); fillDataInfo(sizeLine, cacheRow);
    } }));
    const mins = (arr) => arr.map((n) => [n, T('min.n', { n })]);
    const body = h('div', { class: 'modal-body scroll' },
      h('h4', { text: T('set.appearance') }), setRow(T('set.theme'), null, themeSeg), setRow(T('set.language'), null, langSel),
      h('h4', { text: T('set.work') }),
      setRow(T('set.concurrency'), T('set.concurrencyHint'), sel('concurrency', st.concurrency, [['smart', T('conc.smart')], ...[1, 2, 4, 8, 16, 32].map((n) => [String(n), T('conc.n', { n })])])),
      setRow(T('set.order'), null, sel('order', st.order, ['drops-desc', 'value-desc', 'hours-asc', 'name'].map((o2) => [o2, T('ord.' + o2)]))),
      setRow(T('set.refresh'), T('set.refreshHint'), sel('refreshMinutes', st.refreshMinutes, mins([2, 5, 10, 15, 30]))),
      setRow(T('set.autostart'), null, sw('autoStart', st.autoStart)),
      setRow(T('set.keepawake'), null, sw('keepAwake', st.keepAwake)),
      setRow(T('set.tray'), T('set.trayHint'), sw('closeToTray', st.closeToTray)),
      setRow(T('set.launch'), T('set.launchHint'), sw('launchAtLogin', st.launchAtLogin)),
      setRow(T('set.stuck'), T('set.stuckHint'), sel('stuckMinutes', st.stuckMinutes, [[0, T('lock.off')], ...[1, 2, 3, 6].map((n) => [n * 60, T('hour.n', { n })])])),
      h('h4', { text: T('set.security') }),
      setRow(T('set.autolock'), T('set.autolockHint'), sel('lockMinutes', st.lockMinutes, [[0, T('lock.off')], ...mins([2, 5, 10, 30]), [60, T('lock.hour')]])),
      setRow(T('set.lockMin'), null, sw('lockOnMinimize', st.lockOnMinimize)),
      setRow(T('set.hideCapture'), T('set.hideCaptureHint'), sw('hideFromCapture', st.hideFromCapture)),
      setRow(T('set.passphrase'), null, h('button', { class: 'btn sm', text: T('btn.change'), onclick: () => { pwForm.hidden = !pwForm.hidden; } })),
      pwForm,
      h('h4', { text: T('data.title') }),
      setRow(T('sess.title'), T('sess.hint'), h('button', { class: 'btn sm', text: T('btn.view'), onclick: () => openSession() })),
      setRow(T('data.log'), T('data.logHint'), h('button', { class: 'btn sm', text: T('btn.clear'), onclick: async () => { await api.clearData('log'); toast(T('data.cleared')); } })),
      setRow(T('data.history'), T('data.historyHint'), h('button', { class: 'btn sm', text: T('btn.delete'), onclick: async () => {
        if (await confirmDialog({ title: T('data.history'), text: T('data.historyHint'), ok: T('btn.delete'), danger: true })) { await api.clearData('history'); toast(T('data.cleared')); fillDataInfo(sizeLine, cacheRow); }
      } })),
      cacheRow,
      setRow(T('data.stats'), T('data.statsHint'), h('button', { class: 'btn sm danger', text: T('stats.resetOk'), onclick: async () => {
        if (await confirmDialog({ title: T('stats.resetTitle'), text: T('stats.resetText'), ok: T('stats.resetOk'), danger: true })) { await api.resetStats(); toast(T('data.cleared')); }
      } })),
      sizeLine,
      h('p', { class: 'muted small', text: T('data.shred') }),
      h('h4', { text: T('set.logout') }),
      setRow(T('data.logoutFull'), T('data.logoutFullHint'), h('button', { class: 'btn sm danger', text: T('btn.logoutFull'), onclick: async () => {
        if (await confirmDialog({ title: T('confirm.logoutFull.title'), text: T('confirm.logoutFull.text'), ok: T('btn.logoutFull'), danger: true, typed: I18N.CONFIRM_WORD[lang] })) { closeModal(); api.logoutFull(); }
      } })),
      setRow(T('set.logout'), T('set.logoutHint'), h('button', { class: 'btn sm danger', text: T('btn.logout'), onclick: async () => {
        if (await confirmDialog({ title: T('confirm.logout.title'), text: T('confirm.logout.text'), ok: T('btn.logout'), danger: true })) { closeModal(); api.logout(); }
      } })),
      setRow(T('set.wipe'), T('set.wipeHint'), h('button', { class: 'btn sm danger', text: T('btn.wipeAll'), onclick: async () => {
        if (await confirmDialog({ title: T('confirm.wipe.title'), text: T('confirm.wipe.text'), ok: T('confirm.wipe.ok'), danger: true, typed: I18N.CONFIRM_WORD[lang] })) { closeModal(); api.wipe('SIL'); }
      } })),
      h('h4', { text: T('set.how') }),
      h('ul', { class: 'sec-list' }, [1, 2, 3, 4, 5, 6, 7].map((n) => h('li', { text: T('how.' + n) }))));

    const settingsModal = overlay(h('div', { class: 'modal' },
      h('div', { class: 'modal-head' }, h('h3', { text: T('set.title') }), h('button', { class: 'icon-btn', onclick: closeModal }, icon('x', 18))), body));
    void settingsModal;
    fillDataInfo(sizeLine, cacheRow);
  }

  // ---- istatistikler ---------------------------------------------------------------------------------------
  function statTile(label, value, sub) {
    return h('div', { class: 'stile' }, h('div', { class: 'lab', text: label }), h('div', { class: 'val num', text: value }), h('div', { class: 'sub', text: sub || '' }));
  }

  function fillStats(body, s) {
    const keep = body.scrollTop;
    const L = I18N.LOCALES[lang];
    const live = s.runningSince ? Date.now() - s.runningSince : 0;
    const openMs = Date.now() - (S && S.appStartedAt ? S.appStartedAt : Date.now());
    const max = Math.max(1, ...s.daily.map((d) => d.n));
    const bars = h('div', { class: 'bars' }, s.daily.map((d) => {
      const fill = h('i');
      fill.style.setProperty('height', d.n ? Math.max(8, Math.round((d.n / max) * 100)) + '%' : '2px');
      const date = new Date(d.t).toLocaleDateString(L, { day: 'numeric', month: 'short' });
      return h('div', { class: 'bar' + (d.n ? ' on' : ''), title: date + ': ' + T('stats.cardsCount', { n: d.n }) },
        h('b', { text: d.n ? String(d.n) : '' }), h('div', { class: 'col' }, fill),
        h('span', { text: new Date(d.t).toLocaleDateString(L, { weekday: 'narrow' }) }));
    }));
    const list = (title, items, row) => h('section', { class: 'slist' }, h('h4', { text: title }),
      items.length ? h('ul', {}, items.map(row)) : h('p', { class: 'muted small', text: T('stats.none') }));
    const li = (name, right) => h('li', {}, h('span', { class: 'nm', text: name }), h('span', { class: 'rt', text: right }));
    const avg = s.avgMinPerCard != null ? T('stats.avgVal', { m: nf.format(Math.round(s.avgMinPerCard)) }) : '—';

    body.replaceChildren(
      h('div', { class: 'sgrid' },
        statTile(T('stats.cards'), nf.format(s.cardsTotal), T('stats.cardsSub', { n: nf.format(s.cardsSession) })),
        statTile(T('stats.value'), s.valueText && s.cardsTotal ? s.valueText : '—', s.valueSessionText && s.cardsSession ? T('stats.valueSub', { v: s.valueSessionText }) : ''),
        statTile(T('stats.time'), longDur(s.activeMs + live), T('stats.timeSub', { t: longDur(s.sessionActiveMs + live) })),
        statTile(T('stats.open'), longDur(openMs), T('stats.openSub')),
        statTile(T('stats.gamesRun'), nf.format(s.gamesRun), ''),
        statTile(T('stats.gamesDropped'), nf.format(s.gamesDropped), ''),
        statTile(T('stats.gamesNoDrop'), nf.format(s.gamesNoDrop), T('stats.gamesNoDropSub', { w: s.waiting, s: s.gamesStalled })),
        statTile(T('stats.avg'), avg, T('stats.today') + ' ' + nf.format(s.today) + ' · ' + T('stats.week') + ' ' + nf.format(s.week))),
      h('section', { class: 'slist' }, h('h4', { text: T('stats.chart') }), bars),
      h('div', { class: 'two' },
        list(T('stats.top'), s.top, (g) => li(g.name, T('stats.cardsCount', { n: g.cards }) + ' · ' + T('stats.idle', { t: longDur(g.idleMs) }))),
        list(T('stats.stalled'), s.stalled, (g) => li(g.name, T('stats.stalledFor', { t: longDur(g.ms) })))),
      list(T('stats.recent'), s.recent, (g) => li(g.name + '  +' + g.n, new Date(g.t).toLocaleString(L, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }))),
      h('div', { class: 'sfoot' },
        h('span', { class: 'muted small', text: T('stats.since', { d: new Date(s.since).toLocaleDateString(L, { day: 'numeric', month: 'long', year: 'numeric' }) }) }),
        h('button', { class: 'btn sm danger', text: T('stats.reset'), onclick: async () => {
          if (await confirmDialog({ title: T('stats.resetTitle'), text: T('stats.resetText'), ok: T('stats.resetOk'), danger: true })) { await api.resetStats(); closeModal(); }
        } })));
    body.scrollTop = keep;
  }

  async function openStats() {
    const body = h('div', { class: 'modal-body scroll' });
    const m = overlay(h('div', { class: 'modal wide' },
      h('div', { class: 'modal-head' }, h('h3', { text: T('stats.title') }), h('button', { class: 'icon-btn', onclick: closeModal }, icon('x', 18))), body));
    const load = async () => { const r = await api.getStats(); if (r && r.ok && modal === m) fillStats(body, r.stats); };
    await load();
    const timer = setInterval(() => { if (modal !== m) { clearInterval(timer); return; } load(); }, 3000);
  }

  // ---- oturum, oyun bilgisi, veri bilgisi ------------------------------------------------------------------
  function fmtBytes(n) {
    if (n < 1024) return `${n} B`;
    if (n < 1024 * 1024) return `${nf.format(Math.round(n / 102.4) / 10)} KB`;
    return `${nf.format(Math.round(n / 104857.6) / 10)} MB`;
  }

  function fmtDateTime(t) {
    return t ? new Date(t).toLocaleString(I18N.LOCALES[lang], { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—';
  }

  function fillSession(body, s) {
    const keep = body.scrollTop;
    const kv = (label, value) => h('div', { class: 'srow' }, h('span', { class: 'k', text: label }), h('span', { class: 'v', text: value }));
    const onOff = (b) => (b ? T('sess.on') : T('lock.off'));
    const state = s.run === 'running' ? (s.blocked ? T('st.waiting') : T('st.running')) : (s.run === 'paused' ? T('st.paused') : T('st.ready'));
    const bits = s.kdf ? Math.round(Math.log2(s.kdf.N)) : null;
    body.replaceChildren(
      h('div', { class: 'slist' },
        kv(T('sess.account'), s.account || '—'),
        kv(T('sess.steamid'), s.steamid || '—'),
        kv(T('sess.status'), s.net === 'online' ? T('sess.online') : T('sess.offline')),
        kv(T('sess.signedIn'), fmtDateTime(s.signedInAt)),
        kv(T('sess.connectedAt'), fmtDateTime(s.connectedAt)),
        kv(T('sess.appOpen'), longDur(Date.now() - s.appStartedAt)),
        kv(T('sess.state'), state),
        kv(T('sess.idling'), nf.format(s.idling)),
        kv(T('sess.running'), longDur(s.activeMs))),
      h('h4', { text: T('set.security') }),
      h('div', { class: 'slist' },
        kv(T('sess.token'), s.tokenStored ? T('sess.tokenYes') : T('sess.tokenNo')),
        kv(T('sess.vault'), bits ? T('sess.vaultVal', { n: '2^' + bits }) : '—'),
        kv(T('sess.failed'), nf.format(s.failedAttempts)),
        kv(T('sess.autolock'), s.lockMinutes ? T('sess.autolockVal', { n: s.lockMinutes }) : T('lock.off')),
        kv(T('set.lockMin'), onOff(s.lockOnMinimize)),
        kv(T('sess.capture'), onOff(s.hideFromCapture)),
        kv(T('set.launch'), onOff(s.launchAtLogin)),
        kv(T('sess.dir'), s.dataDir)),
      h('p', { class: 'muted small', text: T('sess.hint') }));
    body.scrollTop = keep;
  }

  async function openSession() {
    const body = h('div', { class: 'modal-body scroll' });
    const m = overlay(h('div', { class: 'modal' },
      h('div', { class: 'modal-head' }, h('h3', { text: T('sess.title') }), h('button', { class: 'icon-btn', onclick: closeModal }, icon('x', 18))), body));
    const load = async () => { const r = await api.getSession(); if (r && r.ok && modal === m) fillSession(body, r.session); };
    await load();
    const timer = setInterval(() => { if (modal !== m) { clearInterval(timer); return; } load(); }, 3000);
  }

  function openGameInfo(r) {
    const chips = h('div', { class: 'chips' });
    const desc = h('p', { class: 'gdesc muted', text: T('info.loading') });
    const meta = h('div', { class: 'slist' });
    const head = h('div', { class: 'gart' }, gameImg(r.appid, 'header'));
    const facts = [
      h('span', { class: 'chip', text: T('info.hours') + ': ' + nf.format(r.hours) }),
      h('span', { class: 'chip', text: T('info.drops') + ': ' + r.drops }),
      r.valueText ? h('span', { class: 'chip', text: '≈ ' + r.valueText }) : null,
    ].filter(Boolean);
    const m = overlay(h('div', { class: 'modal' },
      h('div', { class: 'modal-head' }, h('h3', { text: r.name }), h('button', { class: 'icon-btn', onclick: closeModal }, icon('x', 18))),
      h('div', { class: 'modal-body scroll' }, head, h('div', { class: 'chips gfacts' }, facts), desc, chips, meta,
        h('div', { class: 'sfoot' },
          h('div', { class: 'row-btns' },
            r.black ? null : h('button', { class: 'btn sm', onclick: () => { api.pin(r.appid); closeModal(); } }, icon('play', 14), T('row.runNow')),
            h('button', { class: 'btn sm', onclick: () => { api.blacklist(r.appid, !r.black); closeModal(); } }, icon(r.black ? 'eye' : 'eyeoff', 14), r.black ? T('row.unhide') : T('row.hide'))),
          h('button', { class: 'btn sm', onclick: () => api.openStore(r.appid) }, T('info.store'))))));
    api.getGameInfo(r.appid).then((res) => {
      if (modal !== m) return;
      const info = res && res.ok ? res.info : null;
      if (!info) { desc.textContent = T('info.none'); return; }
      desc.textContent = info.desc || T('info.none');
      desc.classList.toggle('muted', !info.desc);
      chips.replaceChildren(...info.genres.map((g) => h('span', { class: 'chip', text: g })));
      const kv = (a, b) => h('div', { class: 'srow' }, h('span', { class: 'k', text: a }), h('span', { class: 'v', text: b }));
      meta.replaceChildren(...[info.devs.length ? kv(T('info.developer'), info.devs.join(', ')) : null, info.release ? kv(T('info.release'), info.release) : null].filter(Boolean));
    });
  }

  async function fillDataInfo(sizeLine, cacheRow) {
    const r = await api.getDataInfo();
    if (!r || !r.ok) return;
    sizeLine.textContent = T('data.size', { size: fmtBytes(r.data.total) });
    const hint = cacheRow.querySelector('.txt span');
    if (hint) hint.textContent = T('data.cacheHint', { size: fmtBytes(r.data.cache) });
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
