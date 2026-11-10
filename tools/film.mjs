// Films the showcase of the living paper, frame by frame, in headless Edge/Chrome.
// The page never runs in real time here: a shim injected before its scripts replaces the clock (timers,
// performance.now, Date) with one this script advances by exactly one frame at a time, so every frame
// is rendered completely and the film is the same on every run.
// The page itself is not scrolled or zoomed. The window is as tall as the whole booklet, and the
// "camera" is simply the rectangle of it that each screenshot captures.
// It films the offline edition with the network switched off, which also proves that edition works.
//
// usage: node tools/film.mjs          → video/real-analysis-showcase-silent.mp4 (1920×1080, 60 fps)
//        --stills 30    no video: save every 30th frame to video/stills (to check the storyboard)
//        --fps 60 · --out file.mp4
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const argv = process.argv.slice(2);
const arg = (name, def) => { const i = argv.indexOf('--' + name); return i < 0 ? def : argv[i + 1]; };
const W = 1920, H = 1080, FPS = +arg('fps', 60), DT = 1000 / FPS, STILLS = +arg('stills', 0), PORT = 9378;
const page = path.join(root, 'offline', 'real-analysis-paper-2.html');
const URL0 = pathToFileURL(page).href + '?motion=1';
const outDir = path.join(root, 'video'), outFile = path.resolve(arg('out', path.join(outDir, 'real-analysis-showcase-silent.mp4')));
const stillDir = path.join(outDir, 'stills');
fs.mkdirSync(outDir, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
if (!fs.existsSync(page)) throw new Error('Build the offline edition first: node tools/build-offline.mjs');

// ---------------------------------------------------------------- the clock the page runs on (runs inside the page)
function shim(startMs) {
  let now = 0, tid = 0, ui = null;
  const timers = new Map(), RealDate = Date;
  performance.now = () => now;
  class FilmDate extends RealDate {
    constructor(...a) { if (a.length) super(...a); else super(startMs + now); }
    static now() { return startMs + now; }
  }
  window.Date = FilmDate;
  window.setTimeout = (cb, ms = 0, ...a) => { timers.set(++tid, { at: now + (+ms || 0), cb, a }); return tid; };
  window.setInterval = (cb, ms = 0, ...a) => { timers.set(++tid, { at: now + (+ms || 0), cb, a, every: Math.max(4, +ms || 0) }); return tid; };
  window.clearTimeout = window.clearInterval = (id) => { timers.delete(id); };

  function step(dt) {
    now += dt;
    for (let guard = 0; guard < 2000; guard++) {     // timers that are due, oldest first
      let due = null, id = 0;
      for (const [i, t] of timers) if (t.at <= now + 1e-6 && (!due || t.at < due.at)) { due = t; id = i; }
      if (!due) break;
      if (due.every) due.at += due.every; else timers.delete(id);
      try { if (typeof due.cb === 'function') due.cb(...due.a); } catch (e) { console.error(e); }
    }
  }
  function make() {
    ui = document.createElement('div');
    ui.id = 'film';
    ui.style.cssText = 'position:absolute;left:0;top:0;z-index:2147483000;pointer-events:none;transform-origin:0 0;opacity:0';
    // an ordinary arrow pointer; its tip is the element's origin
    ui.innerHTML = '<svg width="26" height="30" viewBox="0 0 26 30" style="display:block;overflow:visible;filter:drop-shadow(0 2px 2.5px rgba(0,0,0,.35))">' +
      '<path d="M1.5 1.5v21.2l5.3-5 3.7 8.6 3.5-1.5-3.7-8.5h7.4z" fill="#111" stroke="#fff" stroke-width="1.6" stroke-linejoin="round"/></svg>';
    document.body.appendChild(ui);
  }
  const rect = (sel) => { const el = document.querySelector(sel); if (!el) return null; const r = el.getBoundingClientRect(); return { l: r.left + scrollX, t: r.top + scrollY, w: r.width, h: r.height }; };
  window.__film = {
    step, rect,
    frame(o) {
      if (!ui) make();
      step(o.dt);
      ui.style.opacity = o.cur;
      ui.style.transform = `translate(${o.mx}px, ${o.my}px) scale(${(o.zoom * (o.down ? 0.9 : 1)).toFixed(4)})`;
      return true;
    },
  };
}

// ---------------------------------------------------------------- browser and encoder
const browserPath = ['C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', 'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Google/Chrome/Application/chrome.exe', '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/usr/bin/google-chrome'].find((c) => fs.existsSync(c));
if (!browserPath) throw new Error('No Edge or Chrome found');

const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'exam-film-'));
spawn(browserPath, ['--headless=new', '--no-first-run', `--user-data-dir=${profile}`, `--remote-debugging-port=${PORT}`, '--remote-allow-origins=*',
  '--hide-scrollbars', `--window-size=${W},${H}`, '--force-color-profile=srgb', '--disable-background-timer-throttling', '--disable-renderer-backgrounding',
  '--disable-backgrounding-occluded-windows', '--disable-features=Translate,CalculateNativeWinOcclusion',
  // extensions installed machine-wide open their welcome tabs a few seconds after launch; a tab that is no longer in front gets no frames
  '--disable-extensions', '--disable-sync', '--no-default-browser-check', '--force-device-scale-factor=1', 'about:blank'], { stdio: 'ignore', detached: false });
let target = null;
for (let i = 0; i < 80 && !target; i++) {
  await sleep(200);
  target = await fetch(`http://127.0.0.1:${PORT}/json/list`).then((r) => r.json()).then((l) => l.find((t) => t.type === 'page'), () => null);
}
if (!target) throw new Error('The browser did not open its debugging port');

const ws = new WebSocket(target.webSocketDebuggerUrl);
await once(ws, 'open');
let seq = 0, frameNo = 0, shots = 0;
const waiting = new Map(), pageErrors = [];
ws.addEventListener('message', (m) => {
  const msg = JSON.parse(m.data);
  if (msg.id) { const w = waiting.get(msg.id); waiting.delete(msg.id); if (msg.error) w.reject(new Error(`${w.method}: ${msg.error.message}`)); else w.resolve(msg.result); return; }
  if (msg.method === 'Runtime.exceptionThrown') { const t = msg.params.exceptionDetails.exception?.description || msg.params.exceptionDetails.text; pageErrors.push(t); console.warn('page error:', t); }
  if (msg.method === 'Runtime.consoleAPICalled' && msg.params.type === 'error') { const t = msg.params.args.map((a) => a.value ?? a.description).join(' '); pageErrors.push(t); console.warn('page error:', t); }
  if (msg.method === 'Network.loadingFailed' && !msg.params.canceled) console.warn('network request failed (the page should make none):', msg.params.errorText);
});
const cdp = (method, params = {}) => new Promise((resolve, reject) => {
  const id = ++seq, timer = setTimeout(() => { waiting.delete(id); reject(new Error(`no answer from the browser to ${method} at ${(frameNo / FPS).toFixed(2)} s of film`)); }, 30000);
  waiting.set(id, { resolve: (v) => { clearTimeout(timer); resolve(v); }, reject: (e) => { clearTimeout(timer); reject(e); }, method });
  ws.send(JSON.stringify({ id, method, params }));
});
async function ev(expression) {
  const r = await cdp('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
  if (r.exceptionDetails) throw new Error(`in page: ${r.exceptionDetails.exception?.description || r.exceptionDetails.text}\n  ${expression.slice(0, 200)}`);
  return r.result.value;
}

let ff = null;
if (!STILLS) {
  ff = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'png', '-i', '-',
    '-vf', `scale=${W}:${H}:flags=lanczos:out_color_matrix=bt709:out_range=tv,format=yuv420p`,
    '-c:v', 'libx264', '-preset', 'slow', '-crf', '15', '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709', '-color_range', 'tv', '-movflags', '+faststart', outFile], { stdio: ['pipe', 'inherit', 'inherit'] });
} else { fs.rmSync(stillDir, { recursive: true, force: true }); fs.mkdirSync(stillDir, { recursive: true }); }

// ---------------------------------------------------------------- camera, pointer, timeline
// S.cx, S.cy, S.w: the centre and width of the piece of the booklet in shot. S.mx, S.my: the pointer.
const S = { cx: W / 2, cy: 600, w: W, mx: 1300, my: 900, cur: 0, down: false };
let tw = [], docH = 0;
const t00 = Date.now();
const ease = { io: (p) => (p < 0.5 ? 4 * p * p * p : 1 - (-2 * p + 2) ** 3 / 2), out: (p) => 1 - (1 - p) ** 3, lin: (p) => p,
  soft: (p) => p * p * (3 - 2 * p) };
function to(key, v, dur, e = ease.io) { tw = tw.filter((t) => t.key !== key); tw.push({ key, a: S[key], b: v, t: 0, dur, e }); }
function cam(v, dur, e = ease.io) { to('cx', v.cx, dur, e); to('cy', v.cy, dur, e); to('w', v.w, dur, e); }
function mouse(x, y, dur, bow = 0.08, e = ease.io) {
  tw = tw.filter((t) => t.key !== 'm');
  const dx = x - S.mx, dy = y - S.my;
  tw.push({ key: 'm', a: [S.mx, S.my], b: [x, y], c: [S.mx + dx / 2 - dy * bow, S.my + dy / 2 + dx * bow], t: 0, dur, e });
}
const button = (type) => cdp('Input.dispatchMouseEvent', { type, x: S.mx, y: S.my, button: 'left', buttons: type === 'mousePressed' ? 1 : 0, clickCount: 1 });

async function capture() {
  if (STILLS && frameNo % STILLS) return;
  const h = (S.w * H) / W;
  const x = Math.max(0, Math.min(W - S.w, S.cx - S.w / 2)), y = Math.max(0, Math.min(docH - h, S.cy - h / 2));
  const { data } = await cdp('Page.captureScreenshot', { format: STILLS ? 'jpeg' : 'png', quality: 82, optimizeForSpeed: true,
    clip: { x, y, width: S.w, height: h, scale: W / S.w } });
  const buf = Buffer.from(data, 'base64');
  shots++;
  if (STILLS) fs.writeFileSync(path.join(stillDir, `f${String(frameNo).padStart(5, '0')}.jpg`), buf);
  else if (!ff.stdin.write(buf)) await once(ff.stdin, 'drain');
}
async function frames(sec) {
  for (let n = Math.round(sec * FPS); n > 0; n--) {
    for (const t of tw) {
      t.t += 1 / FPS;
      const p = Math.min(1, t.t / t.dur), q = t.e(p);
      if (t.key === 'm') { const u = 1 - q; S.mx = u * u * t.a[0] + 2 * u * q * t.c[0] + q * q * t.b[0]; S.my = u * u * t.a[1] + 2 * u * q * t.c[1] + q * q * t.b[1]; }
      else S[t.key] = t.a + (t.b - t.a) * q;
    }
    tw = tw.filter((t) => t.t < t.dur - 1e-6);
    await cdp('Input.dispatchMouseEvent', { type: 'mouseMoved', x: S.mx, y: S.my, button: S.down ? 'left' : 'none', buttons: S.down ? 1 : 0 });
    await ev(`__film.frame(${JSON.stringify({ dt: DT, mx: +S.mx.toFixed(2), my: +S.my.toFixed(2), down: S.down, cur: +S.cur.toFixed(3), zoom: +(S.w / W * 1.15).toFixed(4) })})`);
    await capture();
    if (++frameNo % FPS) continue;
    await cdp('Page.bringToFront');                  // once a second: stay the front tab whatever else the browser opens
    if (frameNo % (FPS * 5) === 0) console.log(`  ${frameNo / FPS} s of film · ${((Date.now() - t00) / 1000).toFixed(0)} s elapsed · ${shots} frames captured`);
  }
}
async function press() { S.down = true; await button('mousePressed'); }
async function release() { S.down = false; await button('mouseReleased'); }
const rect = (sel) => ev(`__film.rect(${JSON.stringify(sel)})`);
const mid = async (sel) => { const r = await rect(sel); if (!r) throw new Error('nothing matches ' + sel); return { x: r.l + r.w / 2, y: r.t + r.h / 2 }; };
/** a shot of one figure with some of its question round it */
const shot = async (sel, w, dy = 0) => { const r = await rect(sel); return { cx: r.l + r.w / 2, cy: r.t + r.h / 2 + dy, w }; };
/** stop a figure wandering by itself, as taking hold of it would (the figures were made in this order) */
const hold = (i) => ev(`Paper.lives[${i}].touch()`);
/** bring the pointer in from the lower right of the shot to a handle */
async function reach(sel, dur = 0.5) {
  const p = await mid(sel);
  if (S.cur < 0.5) { S.mx = S.cx + S.w * 0.3; S.my = S.cy + S.w * 0.2; to('cur', 1, 0.2); }
  mouse(p.x, p.y, dur); await frames(dur + 0.05);
  return p;
}

async function story() {
  // ---- the cover: a paper you have sat before. Then the date, the clock, and a pen nobody is holding.
  const cover = await rect('.cover');
  S.cx = W / 2; S.cy = cover.t + 520; S.w = W;
  to('w', 1010, 4.4, ease.soft); to('cy', cover.t + 262, 4.4, ease.soft);
  await frames(1.2);
  for (const ch of 'E. Noether') { await ev(`document.getElementById('cname').value += ${JSON.stringify(ch)}`); await frames(0.11); }
  await frames(0.15);
  const digits = '27182' + '3141';
  for (let i = 0; i < digits.length; i++) { await ev(`document.querySelectorAll('.comb input')[${i}].value = '${digits[i]}'`); await frames(0.1); }
  await frames(4.6 - frameNo / FPS);

  // ---- Fig. 1: the unit sphere of d_p
  cam(await shot('#fig1', 940, -10), 0.9); await frames(1.5);
  await hold(0);
  let r = await rect('#plot1');
  const px = (p) => r.l + 44 + ((p / (1 + p) - 1 / 3) / (2 / 3)) * 256;
  await reach('#f1h .disc', 0.5); await press();
  mouse(px(0.5), r.t + 316, 0.75, 0); await frames(0.9);
  mouse(r.l + 300, r.t + 316, 0.85, 0); await frames(0.95);
  await release(); await frames(8.6 - frameNo / FPS);

  // ---- Fig. 2: the page upon the page
  cam(await shot('#fig2', 980, 0), 0.9); await frames(1.3);
  await hold(1);
  r = await rect('#plot2');
  const mm = (x, y) => [r.l + 9 + 1.28 * x, r.t + 9 + 1.28 * y];
  await reach('#f2corner .disc', 0.5); await press();
  mouse(...mm(178, 150), 0.85, 0.25); await frames(0.95);
  await release(); await frames(0.05);
  mouse(...mm(26, 268), 0.4); await frames(0.45);
  await press(); await frames(0.08); await release();
  mouse(...mm(60, 292), 0.6); await frames(13.0 - frameNo / FPS);

  // ---- Fig. 3: the series that re-sets its own type
  cam(await shot('#fig3', 1060, -6), 0.9); await frames(1.4);
  await hold(2);
  r = await rect('#plot3');
  const sy = (s) => r.t + 12 + ((2.3 - s) / 3.6) * (r.h - 22);
  let p = await reach('#f3h .disc', 0.5); await press();
  mouse(p.x, sy(1.86), 0.8, 0); await frames(1.0);
  mouse(p.x, sy(-0.72), 1.25, 0); await frames(1.4);
  await release(); await frames(17.6 - frameNo / FPS);

  // ---- Fig. 4: thirty-one booklets
  cam(await shot('#fig4', 1060, 0), 0.9); await frames(1.2);
  await hold(3);
  r = await rect('#plot4');
  const nx = (n) => r.l + 30 + ((n - 1) / 59) * (r.w - 56);
  await reach('#f4h .disc', 0.4); await press();
  mouse(nx(52), r.t + 314, 1.1, 0); await frames(1.2);
  mouse(nx(31), r.t + 314, 0.45, 0); await frames(0.5);
  await release(); await frames(21.2 - frameNo / FPS);

  // ---- Fig. 5: Cantor's set, fattened
  cam(await shot('#fig5', 1060, 0), 0.9); await frames(1.1);
  await hold(4);
  r = await rect('#plot5');
  const ax = (a) => r.l + 40 + ((a - 0.08) / (1 / 3 - 0.08)) * (r.w - 112);
  await reach('#f5h .disc', 0.4); await press();
  mouse(ax(0.1), r.t + 223, 1.0, 0); await frames(1.05);
  mouse(ax(0.25), r.t + 223, 0.55, 0); await frames(0.6);
  await release(); await frames(24.6 - frameNo / FPS);

  // ---- Fig. 6: the typewriter sequence
  cam(await shot('#fig6', 1060, 10), 0.9); await frames(1.3);
  r = await rect('#plot6');
  const sx = (x) => r.l + 34 + x * (r.w - 60);
  await reach('#f6h .disc', 0.4); await press();
  mouse(sx(0.86), r.t + 124, 0.75, 0); await frames(0.85);
  mouse(sx(0.21), r.t + 124, 0.6, 0); await frames(0.65);
  await release(); to('cur', 0, 0.3); await frames(28.1 - frameNo / FPS);

  // ---- and out
  const end = await rect('.endpaper');
  cam({ cx: W / 2, cy: end.t - 250, w: 1720 }, 1.2, ease.soft);
  await frames(29.6 - frameNo / FPS);
}

// ---------------------------------------------------------------- run
try {
  await cdp('Page.enable'); await cdp('Runtime.enable'); await cdp('Network.enable');
  await cdp('Network.emulateNetworkConditions', { offline: true, latency: 0, downloadThroughput: 0, uploadThroughput: 0 });
  await cdp('Emulation.setDeviceMetricsOverride', { width: W, height: 1400, deviceScaleFactor: 1, mobile: false });
  await cdp('Emulation.setFocusEmulationEnabled', { enabled: true });
  // the paper is sat on the day it is filmed, at nine in the morning
  const start = new Date(); start.setHours(9, 0, 4, 0);
  await cdp('Page.addScriptToEvaluateOnNewDocument', { source: `(${shim})(${start.getTime()})` });
  await cdp('Page.bringToFront');
  await cdp('Page.navigate', { url: URL0 });
  for (let i = 0; i < 400; i++) {
    await sleep(25);
    if (await ev('!!(window.__film && window.Paper && document.readyState === "complete")')) break;
    if (i === 399) throw new Error('The page did not finish loading');
  }
  await ev(`Promise.all(['17px KaTeX_Main', 'bold 17px KaTeX_Main', 'italic 17px KaTeX_Main', 'italic 17px KaTeX_Math', '17px KaTeX_Typewriter', '17px KaTeX_AMS',
    '17px KaTeX_Size1', '17px KaTeX_Size2', '600 27px Caveat', '400 15px Jost', '500 11px Jost', '600 15px Jost', '700 31px Jost'].map((f) => document.fonts.load(f))).then(() => document.fonts.ready).then(() => true)`);
  docH = await ev('document.documentElement.scrollHeight');
  await cdp('Emulation.setDeviceMetricsOverride', { width: W, height: docH, deviceScaleFactor: 1, mobile: false });
  await sleep(300);
  const fontsOk = await ev(`['17px KaTeX_Main', '600 27px Caveat', '700 31px Jost', '17px KaTeX_Typewriter'].every((f) => document.fonts.check(f))`);
  const rawTex = await ev(`(document.body.innerText.match(/\\$[^$\\n]{1,40}\\$/g) || []).length`);
  console.log(`page: ${W}×${docH}, offline, fonts ${fontsOk ? 'loaded' : 'MISSING'}, unrendered formulae: ${rawTex}, figures: ${await ev('Paper.lives.length')} wandering`);
  if (!fontsOk || rawTex) throw new Error('The offline edition did not render completely');
  console.log(`filming ${STILLS ? 'stills' : outFile} · ${W}×${H} @ ${FPS} fps`);
  await story();
  console.log(`done: ${(frameNo / FPS).toFixed(2)} s of film, ${shots} frames, ${((Date.now() - t00) / 1000).toFixed(0)} s, page errors: ${pageErrors.length}`);
} finally {
  if (ff) { ff.stdin.end(); await once(ff, 'close'); }
  await cdp('Browser.close').catch(() => {});
  ws.close();
  setTimeout(() => { try { fs.rmSync(profile, { recursive: true, force: true, maxRetries: 3, retryDelay: 300 }); } catch { /* the browser may still hold it */ } process.exit(); }, 1200);
}
