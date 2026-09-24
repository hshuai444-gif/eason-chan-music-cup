"""Locate an official 30-second album preview in a locally supplied concert film.

This is an editorial audit tool. It does not ship the preview audio or copy lyrics.
"""

import argparse
import json
import os
import shutil
import subprocess
import tempfile
import urllib.request
from pathlib import Path

import numpy as np

FFMPEG = os.environ.get('FFMPEG_PATH') or shutil.which('ffmpeg')
if not FFMPEG:
    try:
        import imageio_ffmpeg
        FFMPEG = imageio_ffmpeg.get_ffmpeg_exe()
    except ImportError as error:
        raise RuntimeError('Install ffmpeg or imageio-ffmpeg, or set FFMPEG_PATH') from error
SAMPLE_RATE = 2000


def decode_audio(path, start=0, duration=None):
    command = [str(FFMPEG), "-v", "error", "-ss", str(start), "-i", str(path)]
    if duration is not None:
        command += ["-t", str(duration)]
    command += ["-vn", "-ac", "1", "-ar", str(SAMPLE_RATE), "-f", "f32le", "pipe:1"]
    result = subprocess.run(command, capture_output=True, check=True)
    return np.frombuffer(result.stdout, dtype="<f4").copy()


def align(recording, sample, offset=0):
    sample -= sample.mean()
    recording -= recording.mean()
    n = len(recording) + len(sample) - 1
    fft_size = 1 << (n - 1).bit_length()
    # Correlation at index i is the dot product of recording[i:i+len(sample)] and sample.
    correlation = np.fft.irfft(
        np.fft.rfft(recording, fft_size) * np.conj(np.fft.rfft(sample, fft_size)), fft_size
    )[:len(recording) - len(sample) + 1]
    power = np.cumsum(np.pad(recording.astype(np.float64) ** 2, (1, 0)))
    windows = np.maximum(power[len(sample):] - power[:-len(sample)], 1e-12)
    similarity = correlation / np.sqrt(windows * np.dot(sample, sample))
    indices = np.argpartition(similarity, -5)[-5:]
    return sorted([(round(float(similarity[i]), 5), round(offset + i / SAMPLE_RATE, 3)) for i in indices], reverse=True)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("album_id")
    parser.add_argument("track_number", type=int)
    parser.add_argument("film")
    parser.add_argument("--start", type=float, default=0)
    parser.add_argument("--duration", type=float, default=900)
    args = parser.parse_args()
    url = f"https://itunes.apple.com/lookup?id={args.album_id}&entity=song&limit=200&country=hk"
    with urllib.request.urlopen(url, timeout=30) as response:
        data = json.load(response)
    tracks = [item for item in data["results"] if item.get("wrapperType") == "track"]
    track = next(item for item in tracks if item.get("trackNumber") == args.track_number)
    print(track["trackName"], "duration", track.get("trackTimeMillis"), flush=True)
    preview = track["previewUrl"]
    with urllib.request.urlopen(preview, timeout=30) as response:
        preview_bytes = response.read()
    with tempfile.TemporaryDirectory() as temp_dir:
        tmp = Path(temp_dir) / 'preview-audit.m4a'
        tmp.write_bytes(preview_bytes)
        sample = decode_audio(tmp)
    print("preview seconds", len(sample) / SAMPLE_RATE, flush=True)
    recording = decode_audio(args.film, args.start, args.duration)
    print("film seconds", len(recording) / SAMPLE_RATE, flush=True)
    print("best correlations", align(recording, sample, args.start), flush=True)


if __name__ == "__main__":
    main()
