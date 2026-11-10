// Makes the cover image for the showcase film out of the paper itself: the front cover and the page
// of Question 1 are photographed from the offline edition in headless Edge/Chrome, laid on the desk,
// and titled in the paper's own faces.
// usage: node tools/cover.mjs      → video/cover.png, video/cover.jpg (1920×1080)
//                                               video/cover-clean.png, .jpg (the same without the title)
import { spawn, spawnSync } from 'node:child_process';
import { once } from 'node:events';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const W = 1920, H = 1080, PORT = 9379;
const page = path.join(root, 'offline', 'real-analysis-paper-2.html');
const outDir = path.join(root, 'video');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
if (!fs.existsSync(page)) throw new Error('Build the offline edition first: node tools/build-offline.mjs');
fs.mkdirSync(outDir, { recursive: true });

const browserPath = ['C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', 'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Google/Chrome/Application/chrome.exe', '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/usr/bin/google-chrome'].find((c) => fs.existsSync(c));
if (!browserPath) throw new Error('No Edge or Chrome found');
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'exam-cover-'));
spawn(browserPath, ['--headless=new', '--no-first-run', `--user-data-dir=${profile}`, `--remote-debugging-port=${PORT}`, '--remote-allow-origins=*',
  '--hide-scrollbars', `--window-size=${W},${H}`, '--force-color-profile=srgb', '--disable-extensions', '--disable-sync', '--no-default-browser-check',
  '--force-device-scale-factor=1', 'about:blank'], { stdio: 'ignore' });
let target = null;
for (let i = 0; i < 80 && !target; i++) {
  await sleep(200);
  target = await fetch(`http://127.0.0.1:${PORT}/json/list`).then((r) => r.json()).then((l) => l.find((t) => t.type === 'page'), () => null);
}
if (!target) throw new Error('The browser did not open its debugging port');
const ws = new WebSocket(target.webSocketDebuggerUrl);
await once(ws, 'open');
let seq = 0;
const waiting = new Map();
ws.addEventListener('message', (m) => {
  const msg = JSON.parse(m.data);
  if (!msg.id) return;
  const w = waiting.get(msg.id); waiting.delete(msg.id);
  if (msg.error) w.reject(new Error(`${w.method}: ${msg.error.message}`)); else w.resolve(msg.result);
});
const cdp = (method, params = {}) => new Promise((resolve, reject) => { const id = ++seq; waiting.set(id, { resolve, reject, method }); ws.send(JSON.stringify({ id, method, params })); });
async function ev(expression) {
  const r = await cdp('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
  if (r.exceptionDetails) throw new Error(`in page: ${r.exceptionDetails.exception?.description || r.exceptionDetails.text}`);
  return r.result.value;
}

// ---- runs in the page: dress the two sheets for their photograph
function dress() {
  document.getElementById('cname').value = 'E. Noether';
  [...'271823141'].forEach((d, i) => { document.querySelectorAll('.comb input')[i].value = d; });
  // Fig. 1 as a multiple exposure: the unit sphere at many values of p at once, which is what its motion looks like when stopped
  const svg = document.getElementById('plot1'), main = document.getElementById('f1curve');
  const cx = 170, cy = 150, U = 104;
  const curve = (p) => {
    const e = p === Infinity ? 0 : 2 / p; let d = '';
    for (let i = 0; i < 240; i++) {
      const th = (i / 240) * 2 * Math.PI, c = Math.cos(th), s = Math.sin(th);
      d += `${i ? 'L' : 'M'}${(cx + Math.sign(c) * Math.abs(c) ** e * U).toFixed(1)} ${(cy - Math.sign(s) * Math.abs(s) ** e * U).toFixed(1)}`;
    }
    return d + 'Z';
  };
  for (const [p, o] of [[0.5, 0.9], [0.62, 0.55], [0.78, 0.5], [1.28, 0.5], [3.2, 0.5], [6.5, 0.55]]) {
    const g = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    g.setAttribute('class', 'b'); g.setAttribute('d', curve(p)); g.setAttribute('stroke-opacity', o); g.setAttribute('stroke-width', p === 0.5 ? 1.5 : 1);
    svg.insertBefore(g, main);
  }
  // and the pointer that was dragging it
  const cur = document.createElement('div');
  cur.style.cssText = 'position:absolute;left:172px;top:316px;pointer-events:none';
  cur.innerHTML = '<svg width="22" height="26" viewBox="0 0 26 30" style="display:block;overflow:visible;filter:drop-shadow(0 1.5px 2px rgba(0,0,0,.35))"><path d="M1.5 1.5v21.2l5.3-5 3.7 8.6 3.5-1.5-3.7-8.5h7.4z" fill="#111" stroke="#fff" stroke-width="1.6" stroke-linejoin="round"/></svg>';
  svg.parentElement.appendChild(cur);
  const r = (el) => { const b = el.getBoundingClientRect(); return { x: b.left + scrollX, y: b.top + scrollY, width: b.width, height: b.height }; };
  const sheets = document.querySelectorAll('.sheet');
  return { cover: r(sheets[0]), q1: r(sheets[1]) };
}

// ---- runs in the page: lay the photographs on the desk
function compose(coverPng, q1Png, titled) {
  document.body.innerHTML = `
  <style>
    html, body { margin: 0; width: 1920px; height: 1080px; overflow: hidden; background: var(--desk); }
    #thumb { position: relative; width: 1920px; height: 1080px; overflow: hidden;
      background: radial-gradient(1500px 900px at 34% 30%, oklch(0.30 0.014 55), oklch(0.19 0.012 55)); }
    #thumb img { position: absolute; display: block; box-shadow: 0 2px 2px rgb(0 0 0 / .35), 0 30px 60px -12px rgb(0 0 0 / .65); }
    #thumb .cv { width: 760px; left: 84px; top: ${titled ? 506 : 66}px; transform: rotate(-3.2deg); transform-origin: 30% 0; }
    #thumb .q1 { width: 1118px; left: 866px; top: -248px; transform: rotate(2.4deg); transform-origin: 50% 46%; }
    #thumb h1 { position: absolute; left: 92px; top: 58px; margin: 0; color: var(--paper);
      font: 700 108px/1.02 var(--sans); letter-spacing: .022em; text-transform: uppercase; }
    /* the word is drawn solid once and in outline three times more, each a little further on: a multiple exposure, like Fig. 1 */
    #thumb h1 em { position: relative; display: inline-block; font-style: normal; color: oklch(0.76 0.125 266); }
    #thumb h1 em i { position: absolute; left: 0; top: 0; font-style: normal; color: transparent; -webkit-text-stroke: 1.6px oklch(0.76 0.125 266); }
    #thumb h1 em i:nth-child(1) { transform: translateX(26px); opacity: .62; }
    #thumb h1 em i:nth-child(2) { transform: translateX(52px); opacity: .36; }
    #thumb h1 em i:nth-child(3) { transform: translateX(78px); opacity: .18; }
    #thumb h1 em b { position: relative; font-weight: inherit; background: none; }
    #thumb p { position: absolute; left: 96px; top: 408px; margin: 0; color: oklch(0.86 0.006 100);
      font: italic 29px/1.3 var(--serif); }
  </style>
  <div id="thumb">
    <img class="cv" src="${coverPng}" alt="">
    <img class="q1" src="${q1Png}" alt="">
    ${titled ? '<h1>The exam<br>paper that<br><em><i>moves</i><i>moves</i><i>moves</i><b>moves</b></em></h1><p>Candidates should not attempt to hold a figure still.</p>' : ''}
  </div>`;
  return Promise.all([...document.images].map((im) => im.decode())).then(() => true);
}

try {
  await cdp('Page.enable'); await cdp('Runtime.enable');
  await cdp('Emulation.setDeviceMetricsOverride', { width: W, height: 1400, deviceScaleFactor: 1, mobile: false });
  await cdp('Page.navigate', { url: pathToFileURL(page).href + '?motion=0' });
  for (let i = 0; i < 400; i++) { await sleep(25); if (await ev('!!(window.Paper && document.readyState === "complete")')) break; }
  await ev(`Promise.all(['17px KaTeX_Main', 'bold 17px KaTeX_Main', 'italic 29px KaTeX_Main', 'italic 17px KaTeX_Math', '600 27px Caveat', '400 15px Jost', '600 15px Jost', '700 108px Jost'].map((f) => document.fonts.load(f))).then(() => document.fonts.ready).then(() => true)`);
  const docH = await ev('document.documentElement.scrollHeight');
  await cdp('Emulation.setDeviceMetricsOverride', { width: W, height: docH, deviceScaleFactor: 1, mobile: false });
  await sleep(300);
  const rects = await ev(`(${dress})()`);
  await sleep(200);
  const photo = async (clip) => 'data:image/png;base64,' + (await cdp('Page.captureScreenshot', { format: 'png', clip: { ...clip, scale: 2 } })).data;
  const coverPng = await photo(rects.cover), q1Png = await photo(rects.q1);
  await cdp('Emulation.setDeviceMetricsOverride', { width: W, height: H, deviceScaleFactor: 1, mobile: false });
  for (const [name, titled] of [['cover', true], ['cover-clean', false]]) {
    await ev(`(${compose})(${JSON.stringify(coverPng)}, ${JSON.stringify(q1Png)}, ${titled})`);
    await sleep(250);
    const { data } = await cdp('Page.captureScreenshot', { format: 'png', clip: { x: 0, y: 0, width: W, height: H, scale: 1 } });
    const png = path.join(outDir, name + '.png');
    fs.writeFileSync(png, Buffer.from(data, 'base64'));
    spawnSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', png, '-q:v', '2', path.join(outDir, name + '.jpg')]);
    console.log(png, `${(fs.statSync(png).size / 1024).toFixed(0)} KB`);
  }
} finally {
  await cdp('Browser.close').catch(() => {});
  ws.close();
  setTimeout(() => { try { fs.rmSync(profile, { recursive: true, force: true, maxRetries: 3, retryDelay: 300 }); } catch { /* the browser may still hold it */ } process.exit(); }, 1000);
}
