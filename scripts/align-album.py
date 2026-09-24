"""Audit local film timestamps against official Apple Music live-album previews."""

import argparse
import importlib.util
import json
import tempfile
import urllib.request
from pathlib import Path

base = Path(__file__).with_name("align-preview.py")
spec = importlib.util.spec_from_file_location("align_preview", base)
alignment = importlib.util.module_from_spec(spec)
spec.loader.exec_module(alignment)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("album_id")
    parser.add_argument("film")
    parser.add_argument("output")
    parser.add_argument("--maximum-track", type=int, default=999)
    parser.add_argument("--hints", help="JSON array of approximate film start seconds per digital track")
    args = parser.parse_args()
    album_url = f"https://itunes.apple.com/lookup?id={args.album_id}&entity=song&limit=200&country=hk"
    with urllib.request.urlopen(album_url, timeout=30) as response:
        data = json.load(response)
    tracks = [item for item in data["results"] if item.get("wrapperType") == "track"]
    hints = json.loads(Path(args.hints).read_text(encoding="utf-8")) if args.hints else None
    print("decoding film audio", flush=True)
    film = alignment.decode_audio(args.film)
    print("film seconds", round(len(film) / alignment.SAMPLE_RATE, 2), flush=True)
    cumulative = 0.0
    results = []
    temp_dir = tempfile.TemporaryDirectory()
    tmp = Path(temp_dir.name) / f"preview-audit-{args.album_id}.m4a"
    for ordinal, track in enumerate(tracks, start=1):
        if ordinal > args.maximum_track:
            break
        if hints:
            start = max(0, hints[ordinal - 1] - 90)
            end = min(len(film) / alignment.SAMPLE_RATE, hints[ordinal - 1] + 240)
        else:
            start = max(0, cumulative - 90)
            end = min(len(film) / alignment.SAMPLE_RATE, cumulative + 720)
        cumulative += track["trackTimeMillis"] / 1000
        with urllib.request.urlopen(track["previewUrl"], timeout=30) as response:
            tmp.write_bytes(response.read())
        sample = alignment.decode_audio(tmp)
        segment = film[round(start * alignment.SAMPLE_RATE):round(end * alignment.SAMPLE_RATE)].copy()
        top = alignment.align(segment, sample, start)[0]
        result = {
            "ordinal": ordinal,
            "disc": track.get("discNumber"),
            "track": track.get("trackNumber"),
            "name": track.get("trackName"),
            "albumDuration": round(track["trackTimeMillis"] / 1000, 3),
            "previewAt": top[1],
            "correlation": top[0],
        }
        results.append(result)
        Path(args.output).write_text(json.dumps(results, ensure_ascii=False, indent=2), encoding="utf-8")
        print(ordinal, track.get("discNumber"), track.get("trackNumber"), top, flush=True)


if __name__ == "__main__":
    main()
