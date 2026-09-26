import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { createReadStream, statSync } from 'node:fs';

function serveConcertVideo(concertFiles, request, response, next) {
  const route = request.url?.split('?')[0];
  const concertFile = concertFiles[route];
  if (!concertFile) return next();
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    response.writeHead(405, { Allow: 'GET, HEAD' });
    response.end();
    return;
  }

  let size;
  try {
    size = statSync(concertFile).size;
  } catch {
    response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    response.end(`The locally licensed concert film is unavailable. Check ${route} and its video path environment variable.`);
    return;
  }

  let start = 0;
  let end = size - 1;
  const range = request.headers.range;
  if (range) {
    const match = /^bytes=(\d*)-(\d*)$/.exec(range);
    if (!match || (!match[1] && !match[2])) {
      response.writeHead(416, { 'Content-Range': `bytes */${size}` });
      response.end();
      return;
    }
    if (match[1]) {
      start = Number(match[1]);
      end = match[2] ? Math.min(Number(match[2]), size - 1) : end;
    } else {
      start = Math.max(0, size - Number(match[2]));
    }
    if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start > end || start >= size) {
      response.writeHead(416, { 'Content-Range': `bytes */${size}` });
      response.end();
      return;
    }
  }

  response.writeHead(range ? 206 : 200, {
    'Accept-Ranges': 'bytes',
    'Content-Type': 'video/mp4',
    'Content-Length': end - start + 1,
    ...(range ? { 'Content-Range': `bytes ${start}-${end}/${size}` } : {}),
    'Cache-Control': 'private, no-store',
  });
  if (request.method === 'HEAD') {
    response.end();
    return;
  }
  const stream = createReadStream(concertFile, { start, end });
  stream.on('error', () => response.destroy());
  response.on('close', () => stream.destroy());
  stream.pipe(response);
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const concertFiles = {
    '/media/gal-concert.mp4': env.GAL_VIDEO_PATH,
    '/media/fnds-concert.mp4': env.FNDS_VIDEO_PATH,
    '/media/mos-concert.mp4': env.MOS_VIDEO_PATH,
    '/media/duo-concert.mp4': env.DUO_VIDEO_PATH,
  };
  const localConcertVideo = {
    name: 'local-licensed-concert-video',
    configureServer(server) { server.middlewares.use((request, response, next) => serveConcertVideo(concertFiles, request, response, next)); },
    configurePreviewServer(server) { server.middlewares.use((request, response, next) => serveConcertVideo(concertFiles, request, response, next)); },
  };
  return {
    plugins: [react(), localConcertVideo],
    base: env.SITE_BASE_PATH || './',
  };
});
