import { readdir, readFile, writeFile } from 'node:fs/promises';
import { extname, join, resolve, basename } from 'node:path';
import { chapters } from '../src/archive.js';

const folder = process.argv[2];
const write = process.argv.includes('--write');
if (!folder) {
  console.error('Usage: node scripts/import-lyrics.mjs <folder> [--write]');
  process.exit(1);
}

const entries = chapters.flatMap((chapter) => chapter.discs.flatMap((disc, discIndex) => disc.map((title, songIndex) => ({
  id: `${chapter.id}-d${discIndex + 1}-t${songIndex + 1}`,
  title,
}))));
const normalize = (value) => value.normalize('NFKC').toLocaleLowerCase().replace(/[\s\p{P}\p{S}]/gu, '');
const byId = new Map(entries.map((entry) => [entry.id, entry]));
const byTitle = new Map();
for (const entry of entries) {
  const key = normalize(entry.title);
  byTitle.set(key, [...(byTitle.get(key) || []), entry]);
}

async function filesIn(directory) {
  const children = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(children.map(async (child) => {
    const path = join(directory, child.name);
    if (child.isDirectory()) return filesIn(path);
    return child.isFile() && ['.lrc', '.txt'].includes(extname(child.name).toLowerCase()) ? [path] : [];
  }));
  return nested.flat();
}

const destination = resolve('public/lyrics/lyrics.json');
const data = JSON.parse(await readFile(destination, 'utf8'));
data.bySong ||= {};
data.byTitle ||= {};
const report = { matched: [], ambiguous: [], unmatched: [], skipped: [] };

for (const file of await filesIn(resolve(folder))) {
  const stem = basename(file, extname(file));
  const idMatch = stem.match(/(?:^|\s)(get-a-life|duo|easons-life|fear-and-dreams)-d\d+-t\d+(?:$|\s)/i)?.[0]?.trim();
  const titleName = stem.replace(/^(?:陳奕迅|陈奕迅|Eason Chan)\s*[-–—_]\s*/i, '').replace(/\s*\((?:live|現場|现场)\)\s*$/i, '');
  const candidates = idMatch && byId.has(idMatch) ? [byId.get(idMatch)] : byTitle.get(normalize(titleName)) || [];
  if (candidates.length === 0) { report.unmatched.push(file); continue; }
  if (candidates.length > 1) { report.ambiguous.push({ file, ids: candidates.map((entry) => entry.id) }); continue; }
  const entry = candidates[0];
  const content = (await readFile(file, 'utf8')).replace(/^\uFEFF/, '').trim();
  if (!content || data.bySong[entry.id]) { report.skipped.push({ file, id: entry.id }); continue; }
  data.bySong[entry.id] = { text: content, sourceLabel: '本機提供的歌詞文本', editionNote: '歌詞文本與現場演唱版本可能存在差異。' };
  report.matched.push({ file, id: entry.id, title: entry.title });
}

console.log(JSON.stringify(report, null, 2));
if (write) {
  await writeFile(destination, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
  console.log(`Saved ${report.matched.length} lyrics to ${destination}`);
} else {
  console.log('Dry run only. Add --write to save matched lyrics.');
}
