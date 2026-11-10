// Builds the offline edition: one self-contained HTML file with the styles, scripts, KaTeX and
// every font inlined, so it opens from disk with no network at all.
// Written to offline/real-analysis-paper-2.html and, identically, to docs/index.html (the published page).
// usage: node tools/build-offline.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const vendor = path.join(root, 'vendor'), fontDir = path.join(vendor, 'fonts');
const KATEX = 'https://cdnjs.cloudflare.com/ajax/libs/KaTeX/0.16.9/';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36';
fs.mkdirSync(fontDir, { recursive: true });

async function cached(file, url, headers = {}) {
  const p = path.join(vendor, file);
  if (!fs.existsSync(p)) {
    const r = await fetch(url, { headers });
    if (!r.ok) throw new Error(`${r.status} ${url}`);
    fs.writeFileSync(p, Buffer.from(await r.arrayBuffer()));
  }
  return fs.readFileSync(p);
}
const dataUri = (buf) => `data:font/woff2;base64,${buf.toString('base64')}`;

// KaTeX: keep only the woff2 source of each face, inlined
let katexCss = (await cached('katex.min.css', KATEX + 'katex.min.css')).toString('utf8');
const faces = [...new Set([...katexCss.matchAll(/url\(fonts\/([\w-]+)\.woff2\)/g)].map((m) => m[1]))];
const katexFonts = {};
for (const f of faces) katexFonts[f] = dataUri(await cached(`fonts/${f}.woff2`, `${KATEX}fonts/${f}.woff2`));
katexCss = katexCss.replace(/src:url\(fonts\/([\w-]+)\.woff2\) format\("woff2"\)(,url\([^)]+\) format\("[^"]+"\))*/g,
  (_, name) => `src:url(${katexFonts[name]}) format("woff2")`);
if (/url\(fonts\//.test(katexCss)) throw new Error('a KaTeX font was left pointing at the network');

// Google Fonts: the Latin subsets of Jost and Caveat
const gcss = (await cached('gfonts.css', 'https://fonts.googleapis.com/css2?family=Caveat:wght@500;600&family=Jost:wght@400;500;600;700&display=swap', { 'user-agent': UA })).toString('utf8');
let fontCss = '';
for (const m of gcss.matchAll(/\/\* ([\w-]+) \*\/\s*(@font-face\s*{[^}]+})/g)) {
  if (m[1] !== 'latin') continue;
  const url = /url\((https:[^)]+\.woff2)\)/.exec(m[2])[1];
  const buf = await cached(`fonts/${path.basename(new URL(url).pathname)}`, url);
  fontCss += m[2].replace(url, dataUri(buf)) + '\n';
}
if (!fontCss) throw new Error('no Latin faces found in the Google Fonts stylesheet');

const katexJs = (await cached('katex.min.js', KATEX + 'katex.min.js')).toString('utf8');
const autoJs = (await cached('auto-render.min.js', KATEX + 'contrib/auto-render.min.js')).toString('utf8');
const safe = (js) => js.replace(/<\/script/gi, '<\\/script');

let html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const sub = (re, to) => { if (!re.test(html)) throw new Error(`build: nothing matched ${re}`); html = html.replace(re, () => to); };
sub(/<link rel="stylesheet" href="https:\/\/cdnjs[^>]+katex\.min\.css">\n/, '');
sub(/<link rel="preconnect" href="https:\/\/fonts\.googleapis\.com">\n/, '');
sub(/<link rel="preconnect" href="https:\/\/fonts\.gstatic\.com" crossorigin>\n/, '');
sub(/<link rel="stylesheet" href="https:\/\/fonts\.googleapis\.com[^>]+>\n/, '');
sub(/<link rel="stylesheet" href="paper\.css">/, `<style>\n${katexCss}\n${fontCss}\n${fs.readFileSync(path.join(root, 'paper.css'), 'utf8')}</style>`);
sub(/<script src="https:\/\/cdnjs[^>]+katex\.min\.js"><\/script>/, `<script>${safe(katexJs)}</script>`);
sub(/<script src="https:\/\/cdnjs[^>]+auto-render\.min\.js"><\/script>/, `<script>${safe(autoJs)}</script>`);
html = html.replace(/<script src="(js\/[\w.]+)"><\/script>/g, (_, f) => `<script>\n${safe(fs.readFileSync(path.join(root, f), 'utf8'))}</script>`);

const left = [...html.matchAll(/(?:src|href)="(https?:[^"]+)"/g)].map((m) => m[1]);
if (left.length) throw new Error('still loads from the network: ' + left.join(', '));

const outDir = path.join(root, 'offline');
fs.mkdirSync(outDir, { recursive: true });
const out = path.join(outDir, 'real-analysis-paper-2.html');
fs.writeFileSync(out, html);
// the same file is what GitHub Pages serves, so the published page depends on no other site
fs.mkdirSync(path.join(root, 'docs'), { recursive: true });
fs.writeFileSync(path.join(root, 'docs', 'index.html'), html);
console.log(`${out}  ${(fs.statSync(out).size / 1024).toFixed(0)} KB  (${faces.length} KaTeX faces, ${fontCss.split('@font-face').length - 1} Latin faces)`);
