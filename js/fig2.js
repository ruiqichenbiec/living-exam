/* Fig. 2: a reduced copy of the page lying on the page. The map "where does the copy show this
   point?" is a contraction of the page, and its orbit hops to the one point that lies over itself. */
(() => {
  'use strict';
  const P = Paper, fig = P.$('fig2'), svg = P.$('plot2');
  if (!fig) return;
  const PW = 210, PH = 297, SC = 1.28, OX = 9, OY = 9;        // the page in millimetres, and its scale on paper
  const CX = PW / 2, CY = PH / 2, DIAG = Math.hypot(CX, CY), A0 = Math.atan2(-CY, CX);
  const LEVELS = 5, HOPS = 12;
  const S = { cx: 118, cy: 172, th: -0.32, lam: 0.45, x0: { x: 30, y: 36 }, hops: P.MOTION ? 0 : HOPS };
  let G = null;

  // what a page looks like from far enough away
  const LINES = [[38, 24, 190], [44, 24, 150], [54, 31, 186], [60, 31, 120], [70, 31, 188], [76, 31, 176], [82, 31, 96],
    [222, 40, 184], [228, 40, 160], [240, 31, 186], [246, 31, 140], [256, 31, 188], [262, 31, 170], [268, 31, 90]];
  function pageArt(level) {
    let h = `<rect class="pg" width="${PW}" height="${PH}"/>`;
    if (level > 1) return h;
    h += `<line x1="11" x2="11" y1="0" y2="${PH}"/><line x1="101" x2="109" y1="15" y2="15"/>`;
    for (const [y, a, b] of LINES) h += `<line x1="${a}" x2="${b}" y1="${y}" y2="${y}"/>`;
    h += `<rect x="64" y="96" width="82" height="116"/>`;
    h += `<line x1="24" x2="46" y1="284" y2="284"/><line x1="95" x2="115" y1="284" y2="284"/><line x1="168" x2="190" y1="284" y2="284"/>`;
    return h;
  }

  function build() {
    const W = Math.round(PW * SC + 2 * OX), H = Math.round(PH * SC + 2 * OY);
    svg.setAttribute('viewBox', `0 0 ${W} ${H}`); svg.setAttribute('width', W);
    svg.parentElement.style.width = `${W}px`;
    let h = `<g transform="translate(${OX} ${OY}) scale(${SC})">`;
    h += `<g class="lvl lvl0">${pageArt(0)}</g>`;
    for (let k = 1; k <= LEVELS; k++) h += `<g class="lvl copy" id="f2c${k}">${pageArt(k)}</g>`;
    h += `<rect id="pagehit" width="${PW}" height="${PH}"/>`;
    h += `<polyline class="orbit" id="f2orbit"/><g id="f2dots"></g>`;
    h += `<path class="b" id="f2star" stroke-width="1.2" style="vector-effect:non-scaling-stroke"/>`;
    h += `<text class="var bt" id="f2lab0">x<tspan dy="3" font-size="8">0</tspan></text>`;
    h += `<text class="var bt" id="f2labs">x<tspan dy="-4" font-size="9">∗</tspan></text>`;
    h += P.handle('f2corner', 'Turn the copy and change its size', 'small');
    h += P.handle('f2centre', 'Move the copy');
    h += `</g>`;
    svg.innerHTML = h;
    const dots = [], dg = svg.querySelector('#f2dots');
    for (let i = 0; i <= HOPS; i++) {
      const c = document.createElementNS(P.NS, 'circle');
      c.setAttribute('class', 'bf'); c.setAttribute('r', i ? 1.5 : 2.1);
      dg.appendChild(c); dots.push(c);
    }
    const corner = svg.querySelector('#f2corner');
    corner.querySelector('.hair').setAttribute('d', 'M-8.5 0H8.5M0-8.5V8.5');
    corner.querySelector('.disc').setAttribute('r', 4.6);
    corner.querySelector('.focus').setAttribute('r', 10.5);
    corner.querySelector('.hit').setAttribute('r', 15);
    G = { copies: [...svg.querySelectorAll('.copy')], orbit: svg.querySelector('#f2orbit'), dots, star: svg.querySelector('#f2star'),
          lab0: svg.querySelector('#f2lab0'), labs: svg.querySelector('#f2labs'), corner, centre: svg.querySelector('#f2centre') };
    const out = P.$('f2d');
    out.innerHTML = Array.from({ length: 6 }, (_, i) => `<span class="slot"><span class="v" style="min-width:${i ? 2.2 : 2.7}em"></span>${i < 5 ? ',' : ', …'}</span>`).join('');
    G.vals = [...out.querySelectorAll('.v')];
    draw();
  }

  // T(x) = c + lam * R(th) * (x - centre of page)
  function mapT() {
    const a = S.lam * Math.cos(S.th), b = S.lam * Math.sin(S.th);
    return { a, b, c: -b, d: a, e: S.cx - (a * CX - b * CY), f: S.cy - (b * CX + a * CY) };
  }
  const apply = (m, p) => ({ x: m.a * p.x + m.c * p.y + m.e, y: m.b * p.x + m.d * p.y + m.f });

  function keepInside() {
    S.lam = P.clamp(S.lam, 0.24, 0.6);
    const c = Math.abs(Math.cos(S.th)), s = Math.abs(Math.sin(S.th));
    const hx = S.lam * (CX * c + CY * s), hy = S.lam * (CX * s + CY * c);
    S.cx = P.clamp(S.cx, hx + 2, PW - hx - 2); S.cy = P.clamp(S.cy, hy + 2, PH - hy - 2);
  }

  function draw() {
    keepInside();
    const m = mapT();
    let M = { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 };
    for (const g of G.copies) {
      M = { a: M.a * m.a + M.c * m.b, b: M.b * m.a + M.d * m.b, c: M.a * m.c + M.c * m.d, d: M.b * m.c + M.d * m.d,
            e: M.a * m.e + M.c * m.f + M.e, f: M.b * m.e + M.d * m.f + M.f };
      g.setAttribute('transform', `matrix(${M.a.toFixed(5)} ${M.b.toFixed(5)} ${M.c.toFixed(5)} ${M.d.toFixed(5)} ${M.e.toFixed(3)} ${M.f.toFixed(3)})`);
    }
    // the fixed point solves (I - lam R) x = translation
    const det = (1 - m.a) * (1 - m.d) - m.c * m.b;
    const fx = ((1 - m.d) * m.e + m.c * m.f) / det, fy = (m.b * m.e + (1 - m.a) * m.f) / det;
    G.star.setAttribute('d', `M${fx - 3.4} ${fy - 3.4}L${fx + 3.4} ${fy + 3.4}M${fx - 3.4} ${fy + 3.4}L${fx + 3.4} ${fy - 3.4}`);
    G.labs.setAttribute('x', fx + 5); G.labs.setAttribute('y', fy + 11);
    let p = S.x0, pts = '';
    for (let i = 0; i <= HOPS; i++) {
      const on = i <= S.hops;
      G.dots[i].setAttribute('cx', p.x.toFixed(2)); G.dots[i].setAttribute('cy', p.y.toFixed(2));
      G.dots[i].style.display = on ? '' : 'none';
      if (on) pts += `${p.x.toFixed(2)},${p.y.toFixed(2)} `;
      if (i < 6) {
        G.vals[i].textContent = P.fmt(Math.hypot(p.x - fx, p.y - fy), 1);
        G.vals[i].parentElement.style.visibility = on ? '' : 'hidden';
      }
      p = apply(m, p);
    }
    G.orbit.setAttribute('points', pts);
    G.lab0.setAttribute('x', S.x0.x + (S.x0.x > PW - 22 ? -16 : 5)); G.lab0.setAttribute('y', S.x0.y + (S.x0.y < 16 ? 12 : -5));
    G.centre.setAttribute('transform', `translate(${S.cx.toFixed(2)} ${S.cy.toFixed(2)})`);
    const kx = S.cx + S.lam * DIAG * Math.cos(A0 + S.th), ky = S.cy + S.lam * DIAG * Math.sin(A0 + S.th);
    G.corner.setAttribute('transform', `translate(${kx.toFixed(2)} ${ky.toFixed(2)})`);
    G.centre.setAttribute('aria-valuetext', `centre at ${S.cx.toFixed(0)}, ${S.cy.toFixed(0)} millimetres`);
    G.corner.setAttribute('aria-valuetext', `ratio ${S.lam.toFixed(2)}, turned ${(S.th * 180 / Math.PI).toFixed(0)} degrees`);
    P.$('f2l').textContent = S.lam.toFixed(2);
  }

  const mm = (pt) => ({ x: P.clamp((pt.x - OX) / SC, 0, PW), y: P.clamp((pt.y - OY) / SC, 0, PH) });
  const launch = (p) => { S.x0 = p; S.hops = P.MOTION ? 0 : HOPS; frame = 0; };
  let frame = 0;

  /* ambient life: the copy drifts and turns, and now and then a point is sent on its way */
  const STARTS = [{ x: 30, y: 36 }, { x: 188, y: 44 }, { x: 180, y: 268 }, { x: 28, y: 262 }];
  let from = null, mix = 1, shot = 0;
  const L = P.life(fig, (t) => {
    const want = { cx: 105 + 30 * Math.sin(t * 0.23), cy: 152 + 44 * Math.cos(t * 0.17), th: 0.55 * Math.sin(t * 0.31), lam: 0.44 + 0.07 * Math.sin(t * 0.19) };
    if (from && mix < 1) {
      mix = Math.min(1, mix + 1 / P.FPS / 2);
      const s = mix * mix * (3 - 2 * mix);
      for (const k in want) S[k] = from[k] + (want[k] - from[k]) * s;
    } else Object.assign(S, want);
    if (t - shot > 5.5) { shot = t; launch(STARTS[Math.floor(t / 5.5) % STARTS.length]); }
  });
  L.onResume = () => { from = { cx: S.cx, cy: S.cy, th: S.th, lam: S.lam }; mix = 0; };

  if (P.MOTION) P.onTick(() => {
    if (!P.visible(fig)) return;
    frame++;
    if (S.hops < HOPS && frame % 3 === 0) S.hops++;
    draw();
  });

  P.drag(svg, '#f2centre', { move: (pt) => { L.touch(); const p = mm(pt); S.cx = p.x; S.cy = p.y; draw(); } });
  P.drag(svg, '#f2corner', {
    move: (pt) => {
      L.touch();
      const p = { x: (pt.x - OX) / SC, y: (pt.y - OY) / SC }, vx = p.x - S.cx, vy = p.y - S.cy;
      S.lam = Math.hypot(vx, vy) / DIAG; S.th = Math.atan2(vy, vx) - A0;
      draw();
    },
  });
  P.drag(svg, '#pagehit', { start: (pt) => { L.touch(); launch(mm(pt)); draw(); } });
  P.keys(svg, '#f2centre', (key, shift) => {
    const s = shift ? 10 : 2, d = { ArrowLeft: [-s, 0], ArrowRight: [s, 0], ArrowUp: [0, -s], ArrowDown: [0, s] }[key];
    if (!d) return false;
    L.touch(); S.cx += d[0]; S.cy += d[1]; draw();
  });
  P.keys(svg, '#f2corner', (key) => {
    const d = { ArrowLeft: [-0.05, 0], ArrowRight: [0.05, 0], ArrowUp: [0, 0.02], ArrowDown: [0, -0.02] }[key];
    if (!d) return false;
    L.touch(); S.th += d[0]; S.lam += d[1]; draw();
  });

  P.figure(build);
})();
