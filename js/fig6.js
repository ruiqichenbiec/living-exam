/* Fig. 6: the typewriter sequence. A shaded block steps across [0,1], halving at each pass, and the
   figure types out f_1(x), f_2(x), ... at a point x of the reader's choosing: a record that never settles. */
(() => {
  'use strict';
  const P = Paper, fig = P.$('fig6'), svg = P.$('plot6');
  if (!fig) return;
  const KMAX = 6, NMAX = 2 ** (KMAX + 1) - 1, wrap = svg.parentElement, tape = P.$('f6tape');
  const S = { n: 22, x: 0.4, rest: 0 };
  let G = null;

  const split = (n) => { const k = Math.floor(Math.log2(n)); return { k, j: n - 2 ** k }; };
  const f = (n, x) => { const { k, j } = split(n), w = 2 ** k; return x >= j / w && x <= (j + 1) / w ? 1 : 0; };

  function build() {
    const W = wrap.clientWidth;
    if (!W) return;
    const X0 = 34, X1 = W - 26, base = 124, top = 30, H = 158;
    const sx = (x) => X0 + x * (X1 - X0);
    svg.setAttribute('viewBox', `0 0 ${W} ${H}`); svg.setAttribute('width', W); svg.setAttribute('height', H);
    let h = '';
    h += `<line class="grid" x1="${X0}" x2="${X1}" y1="${top}" y2="${top}"/>`;
    h += `<rect id="f6block" y="${top}" height="${base - top}" fill="url(#hatch-b)" stroke="var(--live)" stroke-width="1" style="mix-blend-mode:multiply"/>`;
    h += `<line class="k" x1="${X0}" x2="${X0}" y1="${base}" y2="${top - 14}"/>`;
    h += `<line class="k" x1="${X0 - 4}" x2="${X0}" y1="${top}" y2="${top}"/>`;
    h += `<text x="${X0 - 8}" y="${top + 4.2}" text-anchor="end">1</text>`;
    h += `<text class="var" x="${X0 + 8}" y="${top - 12}">f<tspan dy="3.5" font-size="10">n</tspan></text>`;
    // the base line is a ruler divided in halves, quarters, eighths, ...
    h += `<line class="k" stroke-width="1.2" x1="${X0}" x2="${X1}" y1="${base}" y2="${base}"/>`;
    const fine = W > 520 ? 64 : 32;
    for (let i = 0; i <= fine; i++) {
      const len = i % fine === 0 ? 10 : i % (fine / 2) === 0 ? 9 : i % (fine / 4) === 0 ? 7 : i % (fine / 8) === 0 ? 5 : i % (fine / 16) === 0 ? 3.6 : 2.4;
      h += `<line class="k thin" x1="${sx(i / fine)}" x2="${sx(i / fine)}" y1="${base}" y2="${base + len}"/>`;
    }
    h += `<line class="b" id="f6pin" stroke-dasharray=".5 3.4" stroke-linecap="round" y1="${top}" y2="${base}"/>`;
    h += P.handle('f6h', 'The point x', 'ew');
    svg.innerHTML = h;
    wrap.querySelectorAll('.lm').forEach((e) => e.remove());
    for (const [x, t] of [[0, '0'], [0.25, '\\tfrac14'], [0.5, '\\tfrac12'], [0.75, '\\tfrac34'], [1, '1']]) {
      const e = document.createElement('span');
      e.className = 'lm under'; e.style.left = `${sx(x)}px`; e.style.top = `${base + 12}px`;
      e.innerHTML = P.tex(t);
      wrap.appendChild(e);
    }
    G = { X0, X1, base, sx, block: svg.querySelector('#f6block'), pin: svg.querySelector('#f6pin'), handle: svg.querySelector('#f6h') };
    draw();
  }

  function draw() {
    const { k, j } = split(S.n), w = 2 ** k, hit = f(S.n, S.x);
    G.block.setAttribute('x', G.sx(j / w).toFixed(2));
    G.block.setAttribute('width', (G.sx((j + 1) / w) - G.sx(j / w)).toFixed(2));
    const px = G.sx(S.x).toFixed(1);
    G.pin.setAttribute('x1', px); G.pin.setAttribute('x2', px);
    G.handle.setAttribute('transform', `translate(${px} ${G.base})`);
    G.handle.querySelector('.disc').style.fill = hit ? 'var(--live)' : '';
    G.handle.querySelector('.hair').style.stroke = hit ? 'var(--paper)' : '';
    P.$('f6n').textContent = S.n; P.$('f6k').textContent = k; P.$('f6j').textContent = j;
    P.$('f6w').textContent = w; P.$('f6f').textContent = hit;
    // the typed record, one group to a pass
    let hits = 0, html = '';
    for (let kk = 0; 2 ** kk <= S.n; kk++) {
      let run = '';
      for (let n = 2 ** kk; n < 2 ** (kk + 1) && n <= S.n; n++) { const v = f(n, S.x); hits += v; run += v ? '<b>1</b>' : '0'; }
      html += `<span>${run}</span>`;
    }
    tape.innerHTML = html;
    P.$('f6hits').textContent = hits;
    G.handle.setAttribute('aria-valuetext', `x = ${S.x.toFixed(3)}, struck ${hits} times in the first ${S.n} terms`);
  }

  /* the carriage runs whether or not anyone is watching the point: six steps a second, then a return */
  let frame = 0;
  if (P.MOTION) P.onTick(() => {
    if (!P.visible(fig)) return;
    if (++frame % 2) return;
    if (S.rest > 0) { if (--S.rest === 0) { S.n = 1; draw(); } return; }
    if (S.n >= NMAX) { S.rest = 10; return; }
    S.n++; draw();
  });

  const setX = (x) => { S.x = P.clamp(x, 0, 1); draw(); };
  P.drag(svg, '#f6h', { move: (pt) => setX((pt.x - G.X0) / (G.X1 - G.X0)) });
  P.keys(svg, '#f6h', (key, shift) => {
    const s = shift ? 0.05 : 0.01;
    const to = { ArrowRight: S.x + s, ArrowUp: S.x + s, ArrowLeft: S.x - s, ArrowDown: S.x - s, Home: 0, End: 1 }[key];
    if (to === undefined) return false;
    setX(to);
  });

  P.figure(build);
})();
