// Lays a music track under the silent showcase film.
// The picture is copied untouched; the music is cut to the length of the film, faded in and out,
// and levelled to a normal streaming loudness.
// usage: node tools/add-music.mjs path/to/track.mp3 [--start 0] [--out file.mp4]
//        --start   where in the track to begin, in seconds (default: where its first sound is)
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const argv = process.argv.slice(2);
const arg = (name, def) => { const i = argv.indexOf('--' + name); return i < 0 ? def : argv[i + 1]; };
const track = argv.find((a, i) => !a.startsWith('--') && !(argv[i - 1] || '').startsWith('--'));
const film = path.join(root, 'video', 'real-analysis-showcase-silent.mp4');
const out = path.resolve(arg('out', path.join(root, 'video', 'real-analysis-showcase.mp4')));
if (!track || !fs.existsSync(track)) { console.error('usage: node add-music.mjs path/to/track.mp3 [--start seconds]'); process.exit(1); }
if (!fs.existsSync(film)) { console.error('Film the silent showcase first: node tools/film.mjs'); process.exit(1); }

const run = (cmd, args) => spawnSync(cmd, args, { encoding: 'utf8' });
const len = +run('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', film]).stdout.trim();

// begin at the track's first sound unless told otherwise
let start = arg('start');
if (start === undefined) {
  const probe = run('ffmpeg', ['-hide_banner', '-i', track, '-af', 'silencedetect=noise=-45dB:d=0.15', '-t', '20', '-f', 'null', '-']).stderr;
  const lead = /silence_start: 0(?:\.0+)?\b[\s\S]*?silence_end: ([\d.]+)/.exec(probe);
  start = lead ? Math.max(0, +lead[1] - 0.05) : 0;
}
const fadeOut = 1.6;
const af = `afade=t=in:st=0:d=0.25,afade=t=out:st=${(len - fadeOut).toFixed(2)}:d=${fadeOut},loudnorm=I=-15:TP=-1.5:LRA=11`;
const r = run('ffmpeg', ['-y', '-loglevel', 'error', '-i', film, '-ss', String(start), '-t', String(len), '-i', track,
  '-map', '0:v:0', '-map', '1:a:0', '-c:v', 'copy', '-af', af, '-c:a', 'aac', '-b:a', '192k', '-ar', '48000', '-shortest', '-movflags', '+faststart', out]);
if (r.status !== 0) { console.error(r.stderr); process.exit(1); }
console.log(`${out}\n  ${len.toFixed(1)} s, music from ${(+start).toFixed(2)} s of the track, ${(fs.statSync(out).size / 1048576).toFixed(1)} MB`);
