/* Fig. 3: a rearrangement of the alternating harmonic series that re-sets its own type. */
(() => {
  'use strict';
  const P = Paper, fig = P.$('fig3'), svg = P.$('plot3');
  if (!fig) return;
  const N = 80, YMIN = -1.3, YMAX = 2.3, XMIN = -1, XMAX = 2, LN2 = Math.LN2;
  const LANDMARKS = [{ v: 0 }, { v: LN2, tex: '\\ln 2' }, { v: 1.5 * LN2, tex: '\\tfrac32\\ln 2' }];
  const wrap = svg.parentElement, sortsBox = P.$('sorts'), tray = sortsBox.parentElement;
  const S = { x: LN2, K: 12 };
  let G = null, sortEls = new Map(), lastKey = '';

  function arrange(x) {
    const seq = [], sums = []; let p = 1, q = 2, s = 0, pos = 0;
    for (let i = 0; i < N; i++) {
      if (s <= x) { seq.push(p); s += 1 / p; p += 2; pos++; } else { seq.push(-q); s -= 1 / q; q += 2; }
      sums.push(s);
    }
    return { seq, sums, pos };
  }

  function build() {
    const W = wrap.clientWidth;
    if (!W) return;
    const H = Math.round(Math.min(318, Math.max(232, W * 0.47)));
    const m = { l: 28, r: W < 480 ? 70 : 82, t: 12, b: 10 };
    const pw = W - m.l - m.r, ph = H - m.t - m.b;
    const sx = (n) => m.l + (n / N) * pw, sy = (s) => m.t + ((YMAX - s) / (YMAX - YMIN)) * ph;
    const ax = sx(N) + 14;
    svg.setAttribute('viewBox', `0 0 ${W} ${H}`); svg.setAttribute('width', W); svg.setAttribute('height', H);
    let h = '';
    for (const s of [-1, 1, 2]) h += `<line class="grid" x1="${sx(0)}" x2="${sx(N)}" y1="${sy(s)}" y2="${sy(s)}"/>`;
    h += `<line class="axis" x1="${sx(0)}" x2="${sx(N)}" y1="${sy(0)}" y2="${sy(0)}"/>`;
    h += `<line class="axis" x1="${sx(0)}" x2="${sx(0)}" y1="${sy(YMIN)}" y2="${sy(YMAX)}"/>`;
    for (const s of [-1, 0, 1, 2]) {
      h += `<line class="axis" x1="${sx(0) - 4}" x2="${sx(0)}" y1="${sy(s)}" y2="${sy(s)}"/>`;
      h += `<text x="${sx(0) - 8}" y="${sy(s) + 4.2}" text-anchor="end">${s < 0 ? '−' + -s : s}</text>`;
    }
    for (const n of [20, 40, 60]) {
      h += `<line class="axis" x1="${sx(n)}" x2="${sx(n)}" y1="${sy(0)}" y2="${sy(0) + 4}"/>`;
      h += `<text x="${sx(n)}" y="${sy(0) + 17}" text-anchor="middle">${n}</text>`;
    }
    h += `<text class="var" x="${sx(N) - 3}" y="${sy(0) + 17}" text-anchor="end">n</text>`;
    h += `<text class="var" x="${sx(0) + 8}" y="${sy(YMAX) + 9}">S<tspan dy="3.5" font-size="10">n</tspan></text>`;
    // the right-hand scale the rule rides on
    h += `<path class="axis" d="M${ax - 3} ${sy(XMAX)}H${ax + 3}M${ax} ${sy(XMAX)}V${sy(XMIN)}M${ax - 3} ${sy(XMIN)}H${ax + 3}"/>`;
    for (const L of LANDMARKS) if (L.tex) h += `<line class="axis" x1="${ax}" x2="${ax + 6}" y1="${sy(L.v)}" y2="${sy(L.v)}"/>`;
    h += `<line class="rule" id="f3rule" x1="${sx(0)}" x2="${ax}"/>`;
    h += `<polyline class="path" id="f3path"/><g id="f3dots"></g>`;
    h += `<rect class="band" id="f3band" x="${sx(0)}" width="${ax - sx(0)}" height="26" fill="transparent"/>`;
    h += P.handle('f3h', 'Target sum x', 'ns');
    svg.innerHTML = h;
    const dots = [], dg = svg.querySelector('#f3dots');
    for (let i = 0; i < N; i++) {
      const c = document.createElementNS(P.NS, 'circle');
      c.setAttribute('class', 'dot'); c.setAttribute('r', 1.35); c.setAttribute('cx', sx(i + 1).toFixed(1));
      dg.appendChild(c); dots.push(c);
    }
    wrap.querySelectorAll('.lm').forEach((e) => e.remove());
    for (const L of LANDMARKS) if (L.tex) {
      const e = document.createElement('span');
      e.className = 'lm'; e.style.left = `${ax + 11}px`; e.style.top = `${sy(L.v)}px`;
      e.innerHTML = P.tex(L.tex);
      wrap.appendChild(e);
    }
    G = { sx, sy, ax, m, ph, dots, rule: svg.querySelector('#f3rule'), path: svg.querySelector('#f3path'),
          band: svg.querySelector('#f3band'), handle: svg.querySelector('#f3h') };
    // how many terms of type fit on the line
    const fontPx = parseFloat(getComputedStyle(tray).fontSize);
    const avail = tray.clientWidth - 5.6 * fontPx - 2.2 * fontPx;
    S.K = Math.max(4, Math.min(16, Math.floor(avail / (2.25 * fontPx))));
    lastKey = '';
    setX(S.x, { animate: false });
  }

  function sortEl(k) {
    const n = Math.abs(k), el = document.createElement('span');
    el.className = 'sort';
    el.innerHTML = `<span class="sg ${k > 0 ? 'plus' : 'minus'}">${k > 0 ? '+' : '−'}</span>` +
      (n === 1 ? '<span>1</span>' : `<span class="fr"><span>1</span><span>${n}</span></span>`);
    return el;
  }

  /* The line of type re-sets itself: every term slides to its new place and a new term drops in from
     above. The slide is stepped by hand at 12 frames a second and can be re-aimed mid-flight: each
     term keeps its own offset from where it belongs and closes a fixed share of it every frame. A
     term therefore never trails more than a slot or two behind, however fast x changes, so terms
     cannot collect in a heap at one end of the line. A new term waits, unseen, until the terms that
     stood in its place have slid clear, and only then drops into the gap. */
  const CLOSE = 0.5;             // share of the remaining distance covered each frame
  const moving = new Map();      // element -> { dx, dy, o, wait }
  let typeTimer = 0;

  function paintSort(el, st) {
    el.style.transform = `translate(${st.dx.toFixed(1)}px, ${st.dy.toFixed(1)}px)`;
    el.style.opacity = st.o < 1 ? st.o.toFixed(2) : '';
  }
  function restSort(el) { el.style.transform = ''; el.style.opacity = ''; moving.delete(el); }

  function slotClear(el) {
    const L = el.offsetLeft, R = L + el.offsetWidth;
    for (const other of sortEls.values()) {
      if (other === el) continue;
      const st = moving.get(other);
      if (st && st.wait) continue;
      const a = other.offsetLeft + (st ? st.dx : 0);
      if (Math.min(a + other.offsetWidth, R) - Math.max(a, L) > 3) return false;
    }
    return true;
  }

  function stepType() {
    for (const [el, st] of moving) {
      if (st.wait) continue;
      st.dx *= 1 - CLOSE; st.dy *= 1 - CLOSE; st.o = Math.min(1, st.o + .34);
      if (Math.abs(st.dx) < .6 && Math.abs(st.dy) < .6 && st.o >= 1) restSort(el); else paintSort(el, st);
    }
    for (const [el, st] of moving) if (st.wait && slotClear(el)) st.wait = false;
    if (!moving.size) { clearInterval(typeTimer); typeTimer = 0; }
  }

  function setType(seq, animate) {
    const key = seq.join(',');
    if (key === lastKey) return;
    lastKey = key;
    // where each term is drawn right now (its offset included)
    const seen = new Map();
    if (animate) for (const [k, el] of sortEls) seen.set(k, el.getBoundingClientRect().left);
    const next = new Map(seq.map((k) => [k, sortEls.get(k) || sortEl(k)]));
    for (const [k, el] of sortEls) if (!next.has(k)) moving.delete(el);
    for (const el of next.values()) el.style.transform = '';
    sortsBox.replaceChildren(...next.values());
    sortEls = next;
    if (!animate) { for (const el of next.values()) restSort(el); return; }
    const drop = -1.1 * parseFloat(getComputedStyle(tray).fontSize);
    for (const [k, el] of next) {
      const was = seen.get(k), st = moving.get(el) || { dx: 0, dy: 0, o: 1 };
      if (was === undefined) { st.dx = 0; st.dy = drop; st.o = 0; st.wait = true; }
      else st.dx = st.wait ? 0 : was - el.getBoundingClientRect().left;
      if (Math.abs(st.dx) < .6 && Math.abs(st.dy) < .6 && st.o >= 1) { restSort(el); continue; }
      moving.set(el, st); paintSort(el, st);
    }
    for (const [el, st] of moving) if (st.wait && slotClear(el)) st.wait = false;
    if (moving.size && !typeTimer) typeTimer = setInterval(stepType, 1000 / P.FPS);
  }

  function setX(x, { snap = false, animate = P.MOTION } = {}) {
    x = P.clamp(x, XMIN, XMAX);
    if (snap) for (const L of LANDMARKS) if (Math.abs(x - L.v) < 0.028) x = L.v;
    S.x = x;
    const { seq, sums, pos } = arrange(x), y = G.sy(x);
    G.rule.setAttribute('y1', y); G.rule.setAttribute('y2', y);
    G.band.setAttribute('y', y - 13);
    G.handle.setAttribute('transform', `translate(${G.ax} ${y})`);
    G.handle.setAttribute('aria-valuetext', `x = ${x.toFixed(3)}; ${pos} positive and ${N - pos} negative terms`);
    let pts = `${G.sx(0).toFixed(1)},${G.sy(0).toFixed(1)}`;
    sums.forEach((s, i) => {
      const cy = G.sy(s).toFixed(1);
      pts += ` ${G.sx(i + 1).toFixed(1)},${cy}`;
      G.dots[i].setAttribute('cy', cy);
    });
    G.path.setAttribute('points', pts);
    P.$('xval').textContent = P.fmt(x, 3);
    P.$('npos').textContent = pos; P.$('nneg').textContent = N - pos;
    setType(seq.slice(0, S.K), animate);
  }

  /* ambient life: the rule wanders between a few sums until someone takes hold of it */
  const wander = P.tour([LN2, 1.5 * LN2, 1.82, 0, -0.72, 0.3], 2.4, 2.8);
  const L = P.life(fig, (t, L) => setX(L.mix(wander(t))));
  L.onResume = () => { L.blendFrom = S.x; };

  const yToX = (pt) => YMAX - ((pt.y - G.m.t) / G.ph) * (YMAX - YMIN);
  P.drag(svg, '#f3band, #f3h', { move: (pt) => { L.touch(); setX(yToX(pt), { snap: true }); } });
  P.keys(svg, '#f3h', (key, shift) => {
    const step = shift ? 0.1 : 0.01;
    const to = { ArrowUp: S.x + step, ArrowRight: S.x + step, ArrowDown: S.x - step, ArrowLeft: S.x - step,
                 PageUp: S.x + 0.25, PageDown: S.x - 0.25, Home: XMIN, End: XMAX }[key];
    if (to === undefined) return false;
    L.touch(); setX(to);
  });

  P.figure(build);
})();
