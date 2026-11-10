/* Shared machinery for the living paper: the 12-frames-a-second clock, dragging, and the cover. */
(() => {
  'use strict';
  const NS = 'http://www.w3.org/2000/svg';
  const qs = new URLSearchParams(location.search);
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  // ?motion=1 forces ambient motion on (for machines with system animations off); ?motion=0 forces it off.
  const MOTION = qs.has('motion') ? qs.get('motion') !== '0' : !reduced;
  const FPS = 12; // ambient motion runs "on twos", like a flip-book
  const $ = (id) => document.getElementById(id);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const fmt = (v, dp = 3) => (Math.abs(v) < 0.5 * 10 ** -dp ? 0 : v).toFixed(dp).replace('-', '−');
  const ease = (p) => (p < .5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2);
  const tex = (s) => (window.katex ? katex.renderToString(s, { throwOnError: false }) : s);

  if (window.renderMathInElement) {
    renderMathInElement(document.body, {
      delimiters: [{ left: '$$', right: '$$', display: true }, { left: '$', right: '$', display: false }],
      throwOnError: false,
    });
  }

  /* ---------- the clock every figure ticks to ---------- */
  const tickers = [];
  const onTick = (fn) => tickers.push(fn);
  const visible = (el) => { const r = el.getBoundingClientRect(); return r.bottom > 60 && r.top < innerHeight - 60; };

  /* A figure's ambient life: it wanders by itself until someone takes hold of it, and
     takes up wandering again a while after they let go. */
  const lives = [];
  function life(figEl, tickFn, resumeMs = 14000) {
    const L = {
      idle: MOTION, t: 0, resumeAt: 0, blendFrom: null, blendT: 0, onResume: null,
      touch() { L.idle = false; L.resumeAt = performance.now() + resumeMs; },
      // ease from where the reader left a value to where the wandering wants it
      mix(target) {
        if (L.blendFrom === null) return target;
        L.blendT += 1 / FPS / 1.6;
        if (L.blendT >= 1) { L.blendFrom = null; return target; }
        const s = L.blendT * L.blendT * (3 - 2 * L.blendT);
        return L.blendFrom + (target - L.blendFrom) * s;
      },
    };
    if (MOTION) onTick(() => {
      if (!L.idle && performance.now() > L.resumeAt) { L.idle = true; L.blendT = 0; if (L.onResume) L.onResume(L); }
      if (!L.idle || !visible(figEl)) return;
      L.t += 1 / FPS;
      tickFn(L.t, L);
    });
    lives.push(L);
    return L;
  }

  /* a wandering value: rests at each stop, then glides to the next */
  const tour = (stops, hold, glide) => (t) => {
    const seg = hold + glide, i = Math.floor(t / seg) % stops.length, u = t % seg;
    const a = stops[i], b = stops[(i + 1) % stops.length];
    return u < hold ? a : a + (b - a) * ease((u - hold) / glide);
  };

  /* ---------- handles and dragging ---------- */
  const handle = (id, label, cls = '') =>
    `<g class="handle ${cls}" id="${id}" tabindex="0" role="slider" aria-label="${label}">` +
    `<circle class="hit" r="22"/><circle class="focus" r="14"/><circle class="disc" r="7.2"/>` +
    `<path class="hair" d="M-12.5 0H12.5M0-12.5V12.5"/></g>`;

  function svgPoint(svg, e) {
    const m = svg.getScreenCTM().inverse();
    return { x: m.a * e.clientX + m.c * e.clientY + m.e, y: m.b * e.clientX + m.d * e.clientY + m.f };
  }
  function drag(svg, selector, { start, move, end }) {
    let active = null;
    svg.addEventListener('pointerdown', (e) => {
      const t = e.target.closest(selector);
      if (!t || !svg.contains(t)) return;
      active = t;
      try { svg.setPointerCapture(e.pointerId); } catch (_) {}
      svg.classList.add('dragging');
      const p = svgPoint(svg, e);
      if (start) start(p, t, e);
      if (move) move(p, t, e);
      e.preventDefault();
    });
    svg.addEventListener('pointermove', (e) => { if (active && move) move(svgPoint(svg, e), active, e); });
    const stop = () => { if (!active) return; const t = active; active = null; svg.classList.remove('dragging'); if (end) end(t); };
    svg.addEventListener('pointerup', stop);
    svg.addEventListener('pointercancel', stop);
    svg.addEventListener('touchstart', (e) => { const t = e.target.closest(selector); if (t && svg.contains(t)) e.preventDefault(); }, { passive: false });
  }
  /* arrow keys on a focused handle; `keymap(key, shift)` returns the new value or undefined */
  function keys(svg, selector, keymap) {
    svg.addEventListener('keydown', (e) => {
      const t = e.target.closest(selector);
      if (!t) return;
      if (keymap(e.key, e.shiftKey) !== false) e.preventDefault();
    });
  }

  /* ---------- figures are (re)drawn to the width they are given ---------- */
  const builders = [];
  const figure = (build) => builders.push(build);
  const buildAll = () => builders.forEach((b) => b());
  function start() {
    buildAll();
    let rz, lastW = innerWidth;
    addEventListener('resize', () => {
      if (innerWidth === lastW) return; // ignore mobile toolbars showing and hiding
      lastW = innerWidth; clearTimeout(rz); rz = setTimeout(buildAll, 120);
    });
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(buildAll);
    if (MOTION) setInterval(() => { if (!document.hidden) for (const f of tickers) f(); }, 1000 / FPS);
  }

  window.Paper = { NS, MOTION, FPS, $, clamp, fmt, ease, tex, onTick, visible, life, lives, tour, handle, svgPoint, drag, keys, figure, start };

  /* ================= the cover ================= */
  function stampDate() {
    const now = new Date();
    const d = new Intl.DateTimeFormat('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(now).replace(',', '');
    const h = now.getHours();
    $('today').textContent = `${d} ${h < 12 ? 'Morning' : h < 17 ? 'Afternoon' : 'Evening'}`;
  }
  stampDate();

  const ticks = $('clockticks');
  for (let i = 0; i < 12; i++) {
    const l = document.createElementNS(NS, 'line');
    l.setAttribute('class', 'k');
    l.setAttribute('y1', -18); l.setAttribute('y2', i % 3 ? -15.6 : -14);
    l.setAttribute('stroke-width', i % 3 ? .6 : 1.1);
    l.setAttribute('transform', `rotate(${i * 30})`);
    ticks.appendChild(l);
  }
  function setClock() {
    const n = new Date(), s = n.getSeconds(), m = n.getMinutes() + s / 60, h = (n.getHours() % 12) + m / 60;
    $('hh').setAttribute('transform', `rotate(${h * 30})`);
    $('mh').setAttribute('transform', `rotate(${m * 6})`);
    $('sh').setAttribute('transform', `rotate(${s * 6})`);
    if (s === 0) stampDate();
  }
  setClock();
  setInterval(setClock, 1000);

  const merEls = [0, 1, 2, 3].map(() => {
    const e = document.createElementNS(NS, 'ellipse');
    e.setAttribute('class', 'b'); e.setAttribute('ry', 17);
    $('meridians').appendChild(e); return e;
  });
  let spin = 0.4;
  const drawSeal = () => merEls.forEach((e, k) => e.setAttribute('rx', (17 * Math.abs(Math.sin(spin + k * Math.PI / 4))).toFixed(2)));
  drawSeal();
  onTick(() => { spin += 0.03; drawSeal(); });

  (function barcode() {
    let seed = 417202, x = 0, h = '';
    const rnd = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
    while (x < 148) {
      const w = [1, 1, 1.6, 2.4, 3.2][Math.floor(rnd() * 5)];
      h += `<rect x="${x.toFixed(1)}" width="${w}" height="44" fill="var(--ink)"/>`;
      x += w + [1, 1.4, 2.2][Math.floor(rnd() * 3)];
    }
    $('bars').innerHTML = h;
  })();

  document.querySelectorAll('.comb').forEach((c) => {
    for (let i = 0; i < +c.dataset.n; i++) {
      const inp = document.createElement('input');
      inp.className = 'hand'; inp.maxLength = 1; inp.inputMode = 'numeric'; inp.autocomplete = 'off';
      inp.setAttribute('aria-label', `${c.dataset.label}, digit ${i + 1}`);
      c.appendChild(inp);
    }
    c.addEventListener('input', (e) => {
      const t = e.target; t.value = t.value.replace(/\D/g, '');
      if (t.value && t.nextElementSibling) t.nextElementSibling.focus();
    });
    c.addEventListener('keydown', (e) => {
      if (e.key === 'Backspace' && !e.target.value && e.target.previousElementSibling) e.target.previousElementSibling.focus();
    });
  });

  /* ================= page 8: rough working ================= */
  const pad = $('scribble'), eraser = $('erase');
  if (pad) {
    let cur = null, pts = [];
    const pt = (e) => { const r = pad.getBoundingClientRect(); return [(e.clientX - r.left).toFixed(1), (e.clientY - r.top).toFixed(1)]; };
    pad.addEventListener('pointerdown', (e) => {
      if (e.pointerType === 'touch') return; // a finger scrolls the page; a mouse or a pen writes on it
      cur = document.createElementNS(NS, 'path'); pts = [pt(e)];
      cur.setAttribute('d', `M${pts[0]} l0.01 0`);
      pad.appendChild(cur);
      try { pad.setPointerCapture(e.pointerId); } catch (_) {}
      eraser.hidden = false;
      e.preventDefault();
    });
    pad.addEventListener('pointermove', (e) => {
      if (!cur) return;
      pts.push(pt(e));
      cur.setAttribute('d', 'M' + pts.join('L'));
    });
    const lift = () => { cur = null; };
    pad.addEventListener('pointerup', lift);
    pad.addEventListener('pointercancel', lift);
    eraser.addEventListener('click', () => { pad.replaceChildren(); eraser.hidden = true; });
  }
})();
