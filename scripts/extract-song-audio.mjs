import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, renameSync, statSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { loadEnv } from 'vite';
import { songEntries } from '../src/lyrics.js';
import { getVideoCue } from '../src/video-cues.js';

const root = process.cwd();
const env = loadEnv('development', root, '');
const videoPaths = {
  'get-a-life': env.GAL_VIDEO_PATH,
  'moving-on-stage': env.MOS_VIDEO_PATH,
  duo: env.DUO_VIDEO_PATH,
  'fear-and-dreams': env.FNDS_VIDEO_PATH,
};
const ffmpeg = process.env.FFMPEG_PATH || path.join(
  os.homedir(),
  'AppData/Roaming/Python/Python314/site-packages/imageio_ffmpeg/binaries/ffmpeg-win-x86_64-v7.1.exe',
);
const outputDir = path.join(root, 'public/song-audio');
const manifestPath = path.join(root, 'src/song-audio-manifest.json');
const limit = process.argv.includes('--first-only') ? 1 : Infinity;
const tracks = songEntries.map((entry) => ({ entry, cue: getVideoCue(entry) })).filter(({ cue }) => cue);

if (!existsSync(ffmpeg)) throw new Error(`FFmpeg is missing: ${ffmpeg}`);
for (const chapterId of new Set(tracks.map(({ entry }) => entry.chapter.id))) {
  const source = videoPaths[chapterId];
  if (!source || !existsSync(source)) throw new Error(`Source video is missing for ${chapterId}`);
}
mkdirSync(outputDir, { recursive: true });

function extract(source, cue, target) {
  return new Promise((resolve, reject) => {
    const args = [
      '-nostdin', '-hide_banner', '-loglevel', 'error',
      '-ss', cue.start.toFixed(3), '-i', source,
      '-t', (cue.end - cue.start).toFixed(3),
      '-map', '0:a:0', '-vn', '-c:a', 'aac', '-b:a', '112k', '-ac', '2',
      '-movflags', '+faststart', '-y', target,
    ];
    const child = spawn(ffmpeg, args, { stdio: ['ignore', 'ignore', 'pipe'] });
    let errors = '';
    child.stderr.on('data', (chunk) => { errors += chunk.toString(); });
    child.on('error', reject);
    child.on('close', (code) => code === 0 ? resolve() : reject(new Error(`FFmpeg exited ${code}: ${errors.slice(-2000)}`)));
  });
}

const manifest = {};
let completed = 0;
for (const { entry, cue } of tracks.slice(0, limit)) {
  const file = path.join(outputDir, `${entry.id}.m4a`);
  const partial = path.join(outputDir, `${entry.id}.partial.m4a`);
  if (!existsSync(file) || statSync(file).size === 0) {
    await extract(videoPaths[entry.chapter.id], cue, partial);
    renameSync(partial, file);
  }
  manifest[entry.id] = Number((cue.end - cue.start).toFixed(3));
  completed += 1;
  console.log(`${completed}/${Math.min(tracks.length, limit)} ${entry.id} ${entry.title} ${(statSync(file).size / 1024 / 1024).toFixed(1)} MiB`);
}
if (limit === Infinity) {
  writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(`Wrote ${Object.keys(manifest).length} tracks to ${manifestPath}`);
}
