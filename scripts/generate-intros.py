"""Render five short original orchestral-style chapter cues (no sampled music)."""

from pathlib import Path
from tempfile import TemporaryDirectory
import math
import shutil
import subprocess
import wave

import numpy as np

RATE = 24000
DURATION = 11.2
OUTPUT = Path(__file__).resolve().parents[1] / "public" / "audio"
OUTPUT.mkdir(parents=True, exist_ok=True)

THEMES = {
    "get-a-life": {"chords": [(50, 53, 57), (53, 57, 60), (46, 50, 53), (52, 56, 59)], "lead": [69, 72, 74, 76, 74, 72, 69, 65], "pulse": 0.54},
    "moving-on-stage": {"chords": [(52, 55, 59), (55, 59, 62), (48, 52, 55), (50, 54, 57)], "lead": [71, 74, 76, 79, 76, 74, 71, 67], "pulse": 0.42},
    "duo": {"chords": [(48, 51, 55), (53, 56, 60), (44, 48, 51), (46, 50, 53)], "lead": [67, 63, 70, 67, 68, 72, 70, 67], "pulse": 0.58},
    "easons-life": {"chords": [(55, 59, 62), (52, 55, 59), (48, 52, 55), (50, 54, 57)], "lead": [74, 76, 79, 76, 72, 74, 71, 74], "pulse": 0.60},
    "fear-and-dreams": {"chords": [(50, 53, 57), (46, 50, 53), (43, 46, 50), (50, 54, 57)], "lead": [69, 72, 74, 77, 76, 74, 73, 74], "pulse": 0.55},
}


def add_note(mix, start, duration, midi, amplitude, kind="strings", pan=0):
    first = round(start * RATE)
    count = min(round(duration * RATE), len(mix) - first)
    if count <= 0:
        return
    time = np.arange(count, dtype=np.float64) / RATE
    frequency = 440 * 2 ** ((midi - 69) / 12)
    vibrato = 0.02 * np.sin(2 * np.pi * 5.1 * time)
    if kind == "bell":
        harmonics = [(1, 1), (2, 0.42), (3, 0.17), (5, 0.09)]
        envelope = np.exp(-3.3 * time / duration)
        envelope *= np.minimum(1, time / 0.008)
    elif kind == "brass":
        harmonics = [(1, 1), (2, 0.55), (3, 0.31), (4, 0.13)]
        envelope = np.minimum(1, time / 0.18) * np.minimum(1, (duration - time) / 0.5)
    elif kind == "bass":
        harmonics = [(1, 1), (2, 0.25), (3, 0.08)]
        envelope = np.minimum(1, time / 0.09) * np.minimum(1, (duration - time) / 0.3)
    else:
        harmonics = [(1, 1), (2, 0.18), (3, 0.15), (4, 0.06)]
        envelope = np.minimum(1, time / 0.35) * np.minimum(1, (duration - time) / 0.65)
    envelope = np.maximum(envelope, 0)
    voice = sum(weight * np.sin(2 * np.pi * frequency * harmonic * time + vibrato) for harmonic, weight in harmonics)
    voice *= envelope * amplitude / sum(weight for _, weight in harmonics)
    mix[first:first + count, 0] += voice * math.sqrt((1 - pan) / 2)
    mix[first:first + count, 1] += voice * math.sqrt((1 + pan) / 2)


def render(theme):
    mix = np.zeros((round(DURATION * RATE), 2), dtype=np.float64)
    for index, chord in enumerate(theme["chords"]):
        start = index * 2.55
        for note_index, pitch in enumerate(chord):
            add_note(mix, start, 2.9, pitch, 0.13 + index * 0.012, pan=(note_index - 1) * 0.48)
            add_note(mix, start + 0.12, 2.5, pitch + 12, 0.055, pan=(1 - note_index) * 0.42)
        add_note(mix, start, 2.4, chord[0] - 24, 0.22, "bass")
        add_note(mix, start + 0.45, 1.8, chord[0] + 12, 0.08, "brass")
        for step in range(4):
            add_note(mix, start + step * theme["pulse"], 1.1, chord[step % 3] + 24, 0.09, "bell", pan=(-1) ** step * 0.55)
    for index, pitch in enumerate(theme["lead"]):
        add_note(mix, 0.35 + index * 1.22, 1.5, pitch, 0.115, "brass", pan=(-1) ** index * 0.18)
    # A small room reflection makes the additive voices feel less dry.
    for delay, gain in [(0.11, 0.18), (0.23, 0.12), (0.39, 0.08)]:
        shift = round(delay * RATE)
        mix[shift:] += mix[:-shift].copy() * gain
    fade = np.minimum(1, np.arange(len(mix)) / (RATE * 0.35))
    fade *= np.minimum(1, (len(mix) - np.arange(len(mix))) / (RATE * 1.3))
    mix *= fade[:, None]
    mix *= 0.78 / max(np.max(np.abs(mix)), 1e-6)
    return (mix * 32767).astype("<i2")


def main():
    ffmpeg = shutil.which("ffmpeg")
    if not ffmpeg:
        import imageio_ffmpeg
        ffmpeg = imageio_ffmpeg.get_ffmpeg_exe()
    with TemporaryDirectory() as temp:
        wav = Path(temp) / "intro.wav"
        for name, theme in THEMES.items():
            audio = render(theme)
            with wave.open(str(wav), "wb") as output:
                output.setnchannels(2)
                output.setsampwidth(2)
                output.setframerate(RATE)
                output.writeframes(audio.tobytes())
            target = OUTPUT / f"{name}.m4a"
            subprocess.run([ffmpeg, "-y", "-v", "error", "-i", str(wav), "-c:a", "aac", "-b:a", "128k", str(target)], check=True)
            print(name, target.stat().st_size)


if __name__ == "__main__":
    main()
