/* Fig. 1: the unit sphere of d_p, re-drawn as p slides from 1/2 to infinity. */
(() => {
  'use strict';
  const P = Paper, fig = P.$('fig1'), svg = P.$('plot1');
  if (!fig) return;
  const W = 340, H = 352, cx = 170, cy = 150, U = 104;
  const X = (x) => cx + x * U, Y = (y) => cy - y * U;
  // the scale is uniform in t = p / (1 + p), which puts p = infinity at a finite distance
  const P2T = (p) => (p === Infinity ? 1 : p / (1 + p)), T2P = (t) => (t >= 0.9995 ? Infinity : t / (1 - t));
  const TMIN = P2T(0.5), RX0 = 44, RX1 = 300, RY = 316;
  const tx = (t) => RX0 + ((t - TMIN) / (1 - TMIN)) * (RX1 - RX0);
  const MARKS = [[0.5, '\\tfrac12'], [1, '1'], [2, '2'], [4, '4'], [Infinity, '\\infty']];
  const S = { t: P2T(2) };
  let G = null;

  function curve(p) {
    const e = p === Infinity ? 0 : 2 / p, n = 240;
    let d = '';
    for (let i = 0; i < n; i++) {
      const th = (i / n) * 2 * Math.PI, c = Math.cos(th), s = Math.sin(th);
      const x = Math.sign(c) * Math.pow(Math.abs(c), e), y = Math.sign(s) * Math.pow(Math.abs(s), e);
      d += `${i ? 'L' : 'M'}${X(x).toFixed(1)} ${Y(y).toFixed(1)}`;
    }
    return d + 'Z';
  }

  function build() {
    let h = '';
    // axes
    h += `<line class="k thin" x1="${X(-1.42)}" x2="${X(1.42)}" y1="${cy}" y2="${cy}"/>`;
    h += `<line class="k thin" x1="${cx}" x2="${cx}" y1="${Y(-1.42)}" y2="${Y(1.42)}"/>`;
    // the three outlines every candidate knows, in black
    h += `<path class="k thin" d="M${X(1)} ${cy}L${cx} ${Y(1)}L${X(-1)} ${cy}L${cx} ${Y(-1)}Z"/>`;
    h += `<circle class="k thin" cx="${cx}" cy="${cy}" r="${U}"/>`;
    h += `<rect class="k thin" x="${X(-1)}" y="${Y(1)}" width="${2 * U}" height="${2 * U}"/>`;
    h += `<text x="${X(-0.5) - 6}" y="${Y(-0.5) + 13}" text-anchor="end">1</text>`;
    h += `<text x="${X(-0.707) - 6}" y="${Y(-0.707) + 14}" text-anchor="end">2</text>`;
    h += `<text x="${X(-1) - 5}" y="${Y(-1) + 14}" text-anchor="end">∞</text>`;
    // the two routes from O to B
    h += `<path class="k" stroke-width="1.5" d="M${cx} ${cy}H${X(1)}V${Y(1)}"/>`;
    h += `<line class="b dash" x1="${cx}" y1="${cy}" x2="${X(1)}" y2="${Y(1)}"/>`;
    h += `<path class="b" id="f1curve" stroke-width="1.5"/>`;
    for (const [x, y] of [[0, 0], [1, 0], [1, 1]]) h += `<circle class="kf" cx="${X(x)}" cy="${Y(y)}" r="2.6"/>`;
    h += `<text class="var" x="${cx - 7}" y="${cy + 16}" text-anchor="end">O</text>`;
    h += `<text class="var" x="${X(1) + 7}" y="${cy + 16}">A</text>`;
    h += `<text class="var" x="${X(1) + 7}" y="${Y(1) - 5}">B</text>`;
    // the scale for p
    h += `<line class="k" x1="${RX0}" x2="${RX1}" y1="${RY}" y2="${RY}"/>`;
    for (const [p] of MARKS) h += `<line class="k" x1="${tx(P2T(p))}" x2="${tx(P2T(p))}" y1="${RY}" y2="${RY + 6}"/>`;
    for (let p = 0.6; p < 4; p += (p < 2 ? 0.2 : 0.5)) h += `<line class="k thin" x1="${tx(P2T(p))}" x2="${tx(P2T(p))}" y1="${RY}" y2="${RY + 3}"/>`;
    h += `<text class="var" x="${RX0 - 20}" y="${RY + 5}">p</text>`;
    h += P.handle('f1h', 'The exponent p', 'ew');
    svg.innerHTML = h;
    const wrap = svg.parentElement;
    wrap.querySelectorAll('.lm').forEach((e) => e.remove());
    for (const [p, t] of MARKS) {
      const e = document.createElement('span');
      e.className = 'lm under';
      e.style.left = `${(tx(P2T(p)) / W) * 100}%`; e.style.top = `${((RY + 8) / H) * 100}%`;
      e.innerHTML = P.tex(t);
      wrap.appendChild(e);
    }
    G = { curve: svg.querySelector('#f1curve'), handle: svg.querySelector('#f1h') };
    set(S.t);
  }

  const showP = (p) => (p === Infinity ? '∞' : p < 10 ? p.toFixed(2) : p < 100 ? p.toFixed(1) : Math.round(p));

  function set(t, snap = false) {
    t = P.clamp(t, TMIN, 1);
    if (snap) for (const [p] of MARKS) if (Math.abs(t - P2T(p)) < 0.012) t = P2T(p);
    S.t = t;
    const p = T2P(t), d = p === Infinity ? 1 : Math.pow(2, 1 / p);
    G.curve.setAttribute('d', curve(p));
    G.handle.setAttribute('transform', `translate(${tx(t).toFixed(1)} ${RY})`);
    G.handle.setAttribute('aria-valuetext', `p = ${showP(p)}; the distance from O to B is ${d.toFixed(3)}`);
    P.$('f1p').textContent = showP(p);
    P.$('f1d').textContent = P.fmt(d, 3);
    P.$('f1r').textContent = Math.abs(d - 2) < 5e-4 ? '=' : d < 2 ? '<' : '>';
  }

  const L = P.life(fig, (t, L) => set(L.mix(wander(t))));
  const wander = P.tour([P2T(2), P2T(1), P2T(0.5), P2T(1), P2T(2), 1], 2.0, 2.6);
  L.onResume = () => { L.blendFrom = S.t; };

  P.drag(svg, '#f1h', {
    move: (pt) => { L.touch(); set(TMIN + ((pt.x - RX0) / (RX1 - RX0)) * (1 - TMIN), true); },
  });
  P.keys(svg, '#f1h', (key, shift) => {
    const step = shift ? 0.05 : 0.01;
    const to = { ArrowRight: S.t + step, ArrowUp: S.t + step, ArrowLeft: S.t - step, ArrowDown: S.t - step, Home: TMIN, End: 1 }[key];
    if (to === undefined) return false;
    L.touch(); set(to);
  });

  P.figure(build);
})();
