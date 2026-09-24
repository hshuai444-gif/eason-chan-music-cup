import { concertVideo, siteAsset, videoAvailable } from './paths.js';

// Film positions are editorial cuts in the user's three locally supplied videos.
// MOS and DUO are checked against published full-film chapter markers and
// official album previews. FNDS starts use the official album track durations
// plus the 77.805-second film introduction. All 31 official previews align
// with that timeline; their excerpt positions within songs vary substantially.
// These are film positions, not generic song durations.

const seconds = (time) => time.split(':').reduce((sum, part) => sum * 60 + Number(part), 0);

const mosStarts = [
  '0:00', '0:45', '4:41', '8:13', '13:11', '17:41', '22:04',
  '26:21', '30:24', '34:30', '40:51', '45:24', '48:09', '52:42',
  '56:37', '1:00:52', '1:03:49', '1:08:05', '1:13:46', '1:17:55',
  '1:22:08', '1:27:09', '1:31:48', '1:36:39', '1:48:05',
  '1:52:43', '2:01:32', '2:05:54', '2:10:20', '2:13:42',
  '2:18:42', '2:23:14', '2:27:35',
].map(seconds);

const duoStarts = [
  '0:00', '8:04', '12:31', '16:32', '21:02', '25:36', '31:13',
  '33:20', '37:57', '41:32', '45:45', '50:44', '54:50',
  '1:01:38', '1:06:10', '1:12:25', '1:17:02', '1:23:43',
  '1:35:53', '1:41:47', '1:46:36', '1:51:40', '1:57:17',
  '2:00:52', '2:06:37', '2:11:20', '2:14:40', '2:19:09',
].map(seconds);

const fndsIntroDuration = 77.805;
const fndsTrackDurations = [
  162.977, 239.767, 304.467, 243, 251.667, 221.8, 220.533, 222,
  288.333, 227.667, 253.333, 333.667, 305, 266, 264, 332,
  260, 212, 280.667, 120, 252.533, 136.133, 219.7, 343.967,
  224, 291, 210, 267, 258.267, 244.993, 901.698,
];
const fndsStarts = [0];
let fndsCursor = fndsIntroDuration;
for (const duration of fndsTrackDurations.slice(0, -1)) {
  fndsCursor += duration;
  fndsStarts.push(Number(fndsCursor.toFixed(3)));
}
const fndsSongEnd = Number((fndsCursor + fndsTrackDurations.at(-1)).toFixed(3));

export const films = {
  'moving-on-stage': {
    url: concertVideo('media/mos-concert.mp4'),
    duration: 9193.771,
    poster: siteAsset('assets/mos-stage.jpg'),
    label: 'MOVING ON STAGE 1 / 2007',
    source: 'MOVING ON STAGE 1 · 本地授權影片',
    marks: mosStarts,
  },
  duo: {
    url: concertVideo('media/duo-concert.mp4'),
    duration: 8759.936,
    poster: siteAsset('assets/duo-stage.jpg'),
    label: 'DUO / DISC 1 / 2010',
    source: 'DUO Disc 1 · 本地授權影片',
    marks: duoStarts,
  },
  'fear-and-dreams': {
    url: concertVideo('media/fnds-concert.mp4'),
    duration: 8696.011,
    clipEnd: fndsSongEnd,
    poster: siteAsset('assets/fnds-film-poster.jpg'),
    label: 'FEAR AND DREAMS / HONG KONG 2025',
    source: 'FEAR and DREAMS 香港 2025 · 本地授權影片',
    marks: fndsStarts,
  },
};

export function getVideoCue(entry) {
  if (!entry) return null;
  const film = films[entry.chapter.id];
  if (!film) return null;
  const ordinal = entry.chapter.discs.slice(0, entry.discIndex).reduce((sum, disc) => sum + disc.length, 0) + entry.songIndex;
  if (ordinal >= film.marks.length) return null;
  return {
    ...film,
    start: film.marks[ordinal],
    end: film.marks[ordinal + 1] ?? film.clipEnd ?? film.duration,
    ordinal: ordinal + 1,
    available: videoAvailable,
    caveat: entry.id === 'duo-d1-t11' ? '此段依公開完整影片章節標記定位；官方專輯試聽與本地影像未取得可靠音軌匹配。' : null,
  };
}
