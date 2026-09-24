import { chapters } from './archive.js';

export const songEntries = chapters.flatMap((chapter) => chapter.discs.flatMap((disc, discIndex) =>
  disc.map((title, songIndex) => ({
    id: `${chapter.id}-d${discIndex + 1}-t${songIndex + 1}`,
    chapter,
    title,
    discIndex,
    songIndex,
  })),
));

const songsById = new Map(songEntries.map((entry) => [entry.id, entry]));

export function getSongById(id) {
  return songsById.get(id) || null;
}

export function getAdjacentSongs(entry) {
  const chapterSongs = songEntries.filter((song) => song.chapter.id === entry.chapter.id);
  const index = chapterSongs.findIndex((song) => song.id === entry.id);
  return { previous: chapterSongs[index - 1] || null, next: chapterSongs[index + 1] || null };
}

export function getQqMusicSearchUrl(entry) {
  return `https://y.qq.com/n/ryqq/search?w=${encodeURIComponent(`陳奕迅 ${entry.title}`)}`;
}

function textToSections(text) {
  const clean = text.replace(/^(?:\[\d{1,2}:\d{2}(?:\.\d{1,3})?\])+/gm, '').replace(/^\[(?:ar|al|ti|by|offset|length):[^\]]*\]\s*$/gim, '');
  const stanzas = clean.trim().split(/\n\s*\n/).map((stanza) => stanza.split(/\r?\n/).map((line) => line.trim()).filter(Boolean)).filter((stanza) => stanza.length);
  return stanzas.map((lines) => ({ lines }));
}

export function getLyricsForSong(data, entry) {
  const raw = data?.bySong?.[entry.id] || data?.byTitle?.[entry.title];
  if (!raw) return null;
  const sections = Array.isArray(raw.sections) ? raw.sections : typeof raw.text === 'string' ? textToSections(raw.text) : [];
  if (!sections.length || !sections.some((section) => Array.isArray(section.lines) && section.lines.some((line) => String(line).trim()))) return null;
  return {
    sections,
    sourceLabel: raw.sourceLabel || '授權歌詞文本',
    sourceUrl: raw.sourceUrl || null,
    editionNote: raw.editionNote || null,
  };
}
