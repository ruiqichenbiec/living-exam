/* Fig. 5: Cantor's construction with gaps of length a^n; the ink that remains is measured row by row. */
(() => {
  'use strict';
  const P = Paper, fig = P.$('fig5'), svg = P.$('plot5');
  if (!fig) return;
  const ROWS = 7, AMIN = 0.08, AMAX = 1 / 3, wrap = svg.parentElement;
  const MARKS = [[0.1, '\\tfrac1{10}'], [0.2, '\\tfrac15'], [0.25, '\\tfrac14'], [1 / 3, '\\tfrac13']];
  const S = { a: 1 / 3 };
  let G = null;

  function build() {
    const W = wrap.clientWidth;
    if (!W) return;
    const x0 = 40, x1 = W - 72, y0 = 26, dy = 25, bh = 10;
    const RY = y0 + ROWS * dy + 22, H = RY + 36;
    const ax = (a) => x0 + ((a - AMIN) / (AMAX - AMIN)) * (x1 - x0);
    svg.setAttribute('viewBox', `0 0 ${W} ${H}`); svg.setAttribute('width', W); svg.setAttribute('height', H);
    let h = '';
    h += `<text class="var" x="${x0 - 22}" y="12" text-anchor="middle">n</text>`;
    h += `<text x="${W - 2}" y="12" text-anchor="end" font-style="italic">measure</text>`;
    h += `<line class="k thin" x1="${x0 - 34}" x2="${W}" y1="18" y2="18"/>`;
    for (let n = 0; n < ROWS; n++) {
      const y = y0 + n * dy;
      h += `<text x="${x0 - 22}" y="${y + bh - 0.5}" text-anchor="middle">${n}</text>`;
      h += `<path class="bf" id="f5r${n}"/>`;
      h += `<text class="bt" id="f5m${n}" x="${W - 2}" y="${y + bh - 0.5}" text-anchor="end"></text>`;
    }
    // end marks of [0, 1]
    h += `<path class="k thin" d="M${x0} ${y0 - 5}v${ROWS * dy - 6}M${x1} ${y0 - 5}v${ROWS * dy - 6}" stroke-dasharray=".5 3.4" stroke-linecap="round"/>`;
    // the scale for a
    h += `<line class="k" x1="${x0}" x2="${x1}" y1="${RY}" y2="${RY}"/>`;
    for (const [a] of MARKS) h += `<line class="k" x1="${ax(a)}" x2="${ax(a)}" y1="${RY}" y2="${RY + 6}"/>`;
    for (let a = 0.08; a < AMAX; a += 0.01) h += `<line class="k thin" x1="${ax(a)}" x2="${ax(a)}" y1="${RY}" y2="${RY + 3}"/>`;
    h += `<text class="var" x="${x0 - 22}" y="${RY + 5}" text-anchor="middle">a</text>`;
    h += P.handle('f5h', 'The ratio a', 'ew');
    svg.innerHTML = h;
    wrap.querySelectorAll('.lm').forEach((e) => e.remove());
    for (const [a, t] of MARKS) {
      const e = document.createElement('span');
      e.className = 'lm under'; e.style.left = `${ax(a)}px`; e.style.top = `${RY + 9}px`;
      e.innerHTML = P.tex(t);
      wrap.appendChild(e);
    }
    G = { x0, x1, y0, dy, bh, RY, ax,
          rows: Array.from({ length: ROWS }, (_, n) => svg.querySelector(`#f5r${n}`)),
          meas: Array.from({ length: ROWS }, (_, n) => svg.querySelector(`#f5m${n}`)),
          handle: svg.querySelector('#f5h') };
    set(S.a);
  }

  function set(a, snap = false) {
    a = P.clamp(a, AMIN, AMAX);
    if (snap) for (const [m] of MARKS) if (Math.abs(a - m) < 0.004) a = m;
    S.a = a;
    const { x0, x1, y0, dy, bh } = G, w = x1 - x0;
    let iv = [[0, 1]];
    for (let n = 0; n < ROWS; n++) {
      if (n) {
        const gap = Math.pow(a, n), next = [];
        for (const [l, r] of iv) { const mid = (l + r) / 2; next.push([l, mid - gap / 2], [mid + gap / 2, r]); }
        iv = next;
      }
      const y = y0 + n * dy;
      let d = '', total = 0;
      for (const [l, r] of iv) { total += r - l; d += `M${(x0 + l * w).toFixed(2)} ${y}h${Math.max(0.35, (r - l) * w).toFixed(2)}v${bh}h${(-Math.max(0.35, (r - l) * w)).toFixed(2)}z`; }
      G.rows[n].setAttribute('d', d);
      G.meas[n].textContent = total.toFixed(3);
    }
    const limit = (1 - 3 * a) / (1 - 2 * a);
    G.handle.setAttribute('transform', `translate(${G.ax(a).toFixed(1)} ${G.RY})`);
    G.handle.setAttribute('aria-valuetext', `a = ${a.toFixed(3)}; the limiting set has measure ${limit.toFixed(3)}`);
    P.$('f5a').textContent = a.toFixed(3);
    P.$('f5m').textContent = P.fmt(limit, 3);
  }

  const wander = P.tour([1 / 3, 0.25, 0.12, 0.25], 2.2, 2.6);
  const L = P.life(fig, (t, L) => set(L.mix(wander(t))));
  L.onResume = () => { L.blendFrom = S.a; };

  const xToA = (pt) => AMIN + ((pt.x - G.x0) / (G.x1 - G.x0)) * (AMAX - AMIN);
  P.drag(svg, '#f5h', { move: (pt) => { L.touch(); set(xToA(pt), true); } });
  P.keys(svg, '#f5h', (key, shift) => {
    const s = shift ? 0.02 : 0.005;
    const to = { ArrowRight: S.a + s, ArrowUp: S.a + s, ArrowLeft: S.a - s, ArrowDown: S.a - s, Home: AMIN, End: AMAX }[key];
    if (to === undefined) return false;
    L.touch(); set(to);
  });

  P.figure(build);
})();
