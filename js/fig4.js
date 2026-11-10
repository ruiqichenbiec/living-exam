/* Fig. 4: copies of the booklet stacked over the edge of a desk; the overhang is half a harmonic number. */
(() => {
  'use strict';
  const P = Paper, fig = P.$('fig4'), svg = P.$('plot4');
  if (!fig) return;
  const NMAX = 60, wrap = svg.parentElement;
  const Hn = [0]; for (let k = 1; k <= NMAX; k++) Hn.push(Hn[k - 1] + 1 / k);
  const S = { n: 31 };
  let G = null;

  function build() {
    const W = wrap.clientWidth;
    if (!W) return;
    const Lb = Math.min(170, (W - 54) / 3.42);         // one booklet length, in pixels
    const E = Lb + 26, deskY = 232, top = 12, H = 342;  // E: the edge of the desk
    const RY = deskY + 22, NY = 314;
    const nx0 = 30, nx1 = W - 26, nx = (n) => nx0 + ((n - 1) / (NMAX - 1)) * (nx1 - nx0);
    svg.setAttribute('viewBox', `0 0 ${W} ${H}`); svg.setAttribute('width', W); svg.setAttribute('height', H);
    let h = '';
    // the desk, in section
    h += `<rect x="0" y="${deskY}" width="${E}" height="38" fill="url(#hatch-k)" opacity=".5"/>`;
    h += `<path class="k" stroke-width="1.6" d="M0 ${deskY}H${E}V${deskY + 38}"/>`;
    h += `<line class="grid" x1="${E}" x2="${E}" y1="${top}" y2="${deskY}"/>`;
    // the scale of booklet lengths beyond the edge
    h += `<line class="k" x1="${E}" x2="${E + 2.5 * Lb}" y1="${RY}" y2="${RY}"/>`;
    for (let i = 0; i <= 10; i++) {
      const x = E + (i / 4) * Lb, major = i % 4 === 0;
      h += `<line class="k${major ? '' : ' thin'}" x1="${x}" x2="${x}" y1="${RY}" y2="${RY + (major ? 7 : i % 2 ? 3 : 4.5)}"/>`;
      if (major) h += `<text x="${x}" y="${RY + 20}" text-anchor="middle">${i / 4}</text>`;
    }
    h += `<text x="${E + 2.5 * Lb}" y="${RY + 35}" text-anchor="end" font-style="italic">booklet lengths beyond the edge</text>`;
    h += `<g id="f4stack"></g>`;
    h += `<path class="b dash" id="f4drop"/><path class="bf" id="f4tip"/>`;
    // the scale for n
    h += `<line class="k" x1="${nx0}" x2="${nx1}" y1="${NY}" y2="${NY}"/>`;
    for (let n = 1; n <= NMAX; n++) {
      const major = n === 1 || n % 10 === 0;
      if (major || n % 5 === 0 || W > 520) h += `<line class="k${major ? '' : ' thin'}" x1="${nx(n)}" x2="${nx(n)}" y1="${NY}" y2="${NY + (major ? 6 : n % 5 === 0 ? 4.5 : 3)}"/>`;
      if (major) h += `<text x="${nx(n)}" y="${NY + 20}" text-anchor="middle">${n}</text>`;
    }
    h += `<text class="var" x="${nx0 - 22}" y="${NY + 5}">n</text>`;
    h += P.handle('f4h', 'Number of booklets', 'ew');
    svg.innerHTML = h;
    const stack = svg.querySelector('#f4stack'), rects = [];
    for (let k = 0; k < NMAX; k++) {
      const r = document.createElementNS(P.NS, 'rect');
      r.setAttribute('class', 'b'); r.setAttribute('width', Lb.toFixed(1));
      r.style.fill = 'var(--paper)'; r.style.mixBlendMode = 'normal';
      stack.appendChild(r); rects.push(r);
    }
    G = { Lb, E, deskY, top, RY, NY, nx, nx0, nx1, rects, drop: svg.querySelector('#f4drop'), tip: svg.querySelector('#f4tip'), handle: svg.querySelector('#f4h') };
    set(S.n);
  }

  function set(n) {
    n = Math.round(P.clamp(n, 1, NMAX));
    S.n = n;
    const { Lb, E, deskY, top, RY, rects } = G;
    const th = Math.min(11, (deskY - top - 4) / n);
    for (let k = 1; k <= NMAX; k++) {
      const r = rects[k - 1];
      if (k > n) { r.style.display = 'none'; continue; }
      r.style.display = '';
      // k counts from the top; its right-hand end projects (H_n - H_{k-1}) / 2 lengths beyond the edge
      const right = E + (Lb / 2) * (Hn[n] - Hn[k - 1]);
      r.setAttribute('x', (right - Lb).toFixed(1));
      r.setAttribute('y', (deskY - (n - k + 1) * th).toFixed(1));
      r.setAttribute('height', th.toFixed(2));
      r.setAttribute('stroke-width', th < 5 ? .7 : 1);
    }
    const tipX = E + (Lb / 2) * Hn[n], topY = deskY - n * th;
    G.drop.setAttribute('d', `M${tipX.toFixed(1)} ${(topY + th).toFixed(1)}V${RY - 6}`);
    G.tip.setAttribute('d', `M${tipX.toFixed(1)} ${RY - 1}l-4 -6.5h8z`);
    G.handle.setAttribute('transform', `translate(${G.nx(n).toFixed(1)} ${G.NY})`);
    G.handle.setAttribute('aria-valuetext', `${n} booklets; overhang ${(Hn[n] / 2).toFixed(4)} booklet lengths`);
    P.$('f4n').textContent = n;
    P.$('f4o').textContent = (Hn[n] / 2).toFixed(4);
  }

  /* ambient life: the stack is built up a booklet at a time, admired, and begun again */
  const TOP = 36, RATE = 4, REST = 3.5;
  const L = P.life(fig, (t) => {
    const u = t % ((TOP - 1) / RATE + REST);
    set(Math.min(TOP, 1 + Math.floor(u * RATE)));
  });

  const xToN = (pt) => 1 + ((pt.x - G.nx0) / (G.nx1 - G.nx0)) * (NMAX - 1);
  P.drag(svg, '#f4h', { move: (pt) => { L.touch(); set(xToN(pt)); } });
  P.keys(svg, '#f4h', (key, shift) => {
    const s = shift ? 5 : 1;
    const to = { ArrowRight: S.n + s, ArrowUp: S.n + s, ArrowLeft: S.n - s, ArrowDown: S.n - s, Home: 1, End: NMAX }[key];
    if (to === undefined) return false;
    L.touch(); set(to);
  });

  P.figure(build);
})();
