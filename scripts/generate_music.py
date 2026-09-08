"""Generate the game's three music assets. Run manually; existing files are kept."""
import argparse
import json
from pathlib import Path
import re
import subprocess
import urllib.error
import urllib.request

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "public/audio"
TRACKS = {
    "city": "An original cozy instrumental for a peaceful miniature Mediterranean city exploration game. Warm nylon-string guitar, very soft felt piano, a few delicate vibraphone notes, airy warm sustained strings. Unhurried 72 BPM, gentle major-key harmony, simple tender motif, spacious and understated. Feels like distant music drifting through a sunny Valencia street. Restrained dynamics, very sparse arrangement, no drums, no brass, no dramatic build, no vocals or voices. A continuous repeating background passage for looping, consistent texture from start to end, no intro or closing finale.",
    "forest": "An original cozy instrumental for walking through a quiet Mediterranean woodland and riverside garden in a miniature exploration game. Soft wooden flute, delicate fingerpicked acoustic guitar, warm harp harmonics and an airy string bed. Slow relaxed 68 BPM, gentle major pentatonic melody, peaceful, pastoral, curious and comforting. Sparse notes and lots of breathing room. No drums, no brass, no voices, no cinematic climax. A continuous repeating background passage for looping, stable soft dynamics and texture, no intro or closing finale.",
    "band": "An original traditional Spanish concert-band pasodoble in the early twentieth-century Valencian style. Proud lyrical minor-key melody, bold trumpet unisons answered by fluent clarinet runs, warm euphonium and trombone countermelodies, steady tuba bass, crisp snare rolls, bass drum and restrained cymbal accents. Strong two-beat march at 112 BPM, elegant dramatic opening phrase and a broad singing major-key trio. Rich acoustic wind band with natural room resonance, full but unhurried, the character of a real banda playing in a Valencian plaza. No dolcaina lead, guitars, piano, synthesizers, vocals, crowd, polka, circus or military fanfare. Original melody, no quotation of an existing composition. Continuous music suitable for a game loop, no fade out.",
}


def main(selected, forced):
    # Read only here. The credential never enters the game, logs, or metadata.
    raw = (ROOT / ".elevenlabs.txt").read_text().strip()
    match = re.search(r"(?:sk_|xi_)[A-Za-z0-9_-]+", raw)
    key = match.group(0) if match else raw
    OUT.mkdir(parents=True, exist_ok=True)
    for name, prompt in TRACKS.items():
        if name not in selected:
            continue
        target = OUT / f"{name}.mp3"
        if target.exists() and name not in forced:
            print(f"Keep existing {target.name}", flush=True)
            continue
        payload = dict(prompt=prompt, music_length_ms=60000,
                       force_instrumental=True, model_id="music_v2")
        request = urllib.request.Request(
            "https://api.elevenlabs.io/v1/music?output_format=mp3_44100_128",
            data=json.dumps(payload).encode(),
            headers={"xi-api-key": key, "Content-Type": "application/json"},
        )
        print(f"Generate {name}: 60 seconds", flush=True)
        try:
            with urllib.request.urlopen(request, timeout=600) as response:
                audio = response.read()
                content_type = response.headers.get("Content-Type", "")
                song_id = response.headers.get("song-id")
        except urllib.error.HTTPError as error:
            print(f"Generation stopped: HTTP {error.code}", flush=True)
            # API error details can explain a permission or balance issue.
            print(error.read().decode(errors="replace").replace(key, "[redacted]"))
            raise SystemExit(1)
        if "audio" not in content_type or len(audio) < 10000:
            raise SystemExit(f"Unexpected audio response for {name}")
        target.write_bytes(audio)
        if name in forced:
            original = ROOT / "output/music-originals" / target.name
            original.parent.mkdir(parents=True, exist_ok=True)
            original.write_bytes(audio)
        metadata = {"provider": "ElevenLabs", "song_id": song_id, **payload}
        (OUT / f"{name}.json").write_text(json.dumps(metadata, indent=2) + "\n")
        print(f"Saved {target.name}: {len(audio)} bytes", flush=True)


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--track", action="append", choices=TRACKS)
    parser.add_argument("--force", action="append", choices=TRACKS, default=[])
    args = parser.parse_args()
    selected = set(args.track or TRACKS)
    forced = set(args.force)
    if not forced.issubset(selected):
        parser.error("each forced track must also be selected with --track")
    main(selected, forced)
    for name in selected:
        target = OUT / f"{name}.mp3"
        metadata_path = OUT / f"{name}.json"
        metadata = json.loads(metadata_path.read_text())
        if metadata.get("normalization"):
            continue
        original = ROOT / "output/music-originals" / target.name
        original.parent.mkdir(parents=True, exist_ok=True)
        if not original.exists():
            original.write_bytes(target.read_bytes())
        temporary = OUT / f"{name}.normalized.mp3"
        subprocess.run([
            "ffmpeg", "-v", "error", "-y", "-i", str(original),
            "-af", "loudnorm=I=-18:TP=-1.5:LRA=8", "-ar", "44100",
            "-codec:a", "libmp3lame", "-b:a", "192k", str(temporary),
        ], check=True)
        temporary.replace(target)
        metadata["normalization"] = "FFmpeg loudnorm: -18 LUFS, -1.5 dBTP, LRA 8; MP3 44.1 kHz / 192 kbps"
        metadata_path.write_text(json.dumps(metadata, indent=2) + "\n")
        print(f"Normalized {target.name}", flush=True)
