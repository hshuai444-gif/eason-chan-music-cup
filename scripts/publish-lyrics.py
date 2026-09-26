"""Map lyrics-organizer exports to the concert site's individual song pages.

Run this only after confirming permission to publish the lyric texts. The input
catalog, skill reports, and raw lyrics stay outside the Git repository.
"""

import argparse
import csv
import json
import unicodedata
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
LYRICS_OUTPUT = ROOT / "public" / "lyrics" / "lyrics.json"
AUDIT_OUTPUT = ROOT / "audit" / "lyrics.json"
SUCCESS = {"saved", "updated", "skipped"}


def key(value):
    return unicodedata.normalize("NFKC", value).casefold().strip()


def read_json(path):
    return json.loads(path.read_text(encoding="utf-8-sig"))


def stanza_text(lines):
    """Keep the exported LRC's line order, using pauses as stanza boundaries."""
    groups = []
    current = []
    previous_time = None
    for line in lines:
        words = line["text"].strip()
        if not words:
            continue
        timestamp = line["time"]
        if current and (len(current) >= 6 or (len(current) >= 2 and timestamp - previous_time >= 8)):
            groups.append(current)
            current = []
        current.append(words)
        previous_time = timestamp
    if current:
        groups.append(current)
    return "\n\n".join("\n".join(group) for group in groups)


def load_skill_exports(paths):
    lyrics = {}
    for path in paths:
        data = read_json(path)
        for song in data["songs"]:
            title = key(song["title"])
            if title in lyrics:
                raise ValueError(f"Multiple exports for {song['title']}; review versions manually")
            lyrics[title] = stanza_text(song["lines"])
    return lyrics


def load_skill_catalog(roots, exported):
    result = {}
    for root in roots:
        for manifest in root.rglob("metadata.json"):
            entries = read_json(manifest)["songs"]
            for filename, metadata in entries.items():
                title = key(metadata["title"])
                if title in result:
                    raise ValueError(f"Multiple catalog entries for {metadata['title']}; review versions manually")
                source = manifest.parent / filename
                if not source.is_file():
                    raise FileNotFoundError(source)
                if source.suffix.lower() == ".lrc":
                    text = exported.get(title)
                    if not text:
                        raise ValueError(f"Validated web export is missing {metadata['title']}")
                elif source.suffix.lower() == ".txt":
                    text = source.read_text(encoding="utf-8-sig").strip()
                else:
                    continue
                if not text:
                    raise ValueError(f"Empty lyrics for {metadata['title']}")
                result[title] = {"text": text, "metadata": metadata}
    if set(exported) != {title for title, item in result.items() if item["metadata"]["lyrics_type"] == "synced"}:
        raise ValueError("The skill's LRC export does not match the lyric catalog")
    return result


def load_reports(paths):
    reports = {}
    for path in paths:
        with path.open(encoding="utf-8-sig", newline="") as stream:
            for row in csv.DictReader(stream):
                title = row["song"].split(" - ", 1)[-1]
                normalized_title = key(title)
                if row["failure_reason"] == "输入列表内重复" and normalized_title in reports:
                    continue
                reports[normalized_title] = row
    return reports


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--catalog", required=True, type=Path)
    parser.add_argument("--report", action="append", required=True, type=Path)
    parser.add_argument("--export", action="append", required=True, type=Path)
    parser.add_argument("--lyrics-root", action="append", required=True, type=Path)
    parser.add_argument("--write", action="store_true", help="Publish to public/lyrics and audit/")
    args = parser.parse_args()

    catalog = read_json(args.catalog)
    exported = load_skill_exports(args.export)
    sources = load_skill_catalog(args.lyrics_root, exported)
    reports = load_reports(args.report)
    by_song = {}
    status_by_song = {}
    audit = []
    for track in catalog:
        source = sources.get(key(track["title"]))
        report = reports.get(key(track["title"]))
        if source:
            meta = source["metadata"]
            album = meta["album"]
            lyric_id = meta.get("lyrics_id")
            edition_note = f"歌詞取自《{album}》的錄音室版本；本章的現場演唱可能有改詞、換段或省略，尚未逐字核對。"
            if meta.get("review_note"):
                edition_note += " 已核對多份時間軸版本的歌詞文字相同；本站只展示文字，不沿用錄音室時間碼。"
            if meta.get("recording_review"):
                edition_note += " 已按原始專輯與錄音時長人工核對版本；本站不沿用錄音室時間碼。"
            by_song[track["id"]] = {
                "text": source["text"],
                "sourceLabel": "LRCLIB · 錄音室版歌詞",
                "sourceUrl": f"https://lrclib.net/api/get/{lyric_id}" if lyric_id else None,
                "editionNote": edition_note,
            }
            status = "reference"
        else:
            status = report["status"] if report else "missing"
            if status in SUCCESS:
                raise ValueError(f"Report says saved, but no lyric was found for {track['title']}")
            status_by_song[track["id"]] = status
        audit.append({
            "id": track["id"], "chapter": track["chapter"], "title": track["title"],
            "status": status,
            "sourceAlbum": source["metadata"]["album"] if source else None,
            "reason": report["failure_reason"] if report and not source else None,
        })

    counts = {"totalEntries": len(catalog), "withStudioReference": len(by_song),
              "awaitingReview": sum(row["status"] == "review" for row in audit),
              "missing": sum(row["status"] in {"missing", "error"} for row in audit),
              "uniqueReferenceTitles": len(sources)}
    print(json.dumps(counts, ensure_ascii=False))
    if args.write:
        LYRICS_OUTPUT.parent.mkdir(parents=True, exist_ok=True)
        AUDIT_OUTPUT.parent.mkdir(parents=True, exist_ok=True)
        LYRICS_OUTPUT.write_text(json.dumps({"bySong": by_song, "byTitle": {}, "statusBySong": status_by_song}, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        AUDIT_OUTPUT.write_text(json.dumps({"summary": counts, "songs": audit}, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        print(f"Published: {LYRICS_OUTPUT}")
        print(f"Audit: {AUDIT_OUTPUT}")
    else:
        print("Dry run only; add --write to publish.")


if __name__ == "__main__":
    main()
