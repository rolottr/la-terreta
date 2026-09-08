"""Generate original game Foley with ElevenLabs. Keep completed files on rerun."""
import json
import re
import subprocess
import urllib.error
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'public/audio/foley'
SOUNDS = {
    'masclet': (1.4, False, 'One single powerful Valencian masclet firecracker explosion at the very start. A sharp dry crack with a deep chesty boom and a long outdoor plaza echo and rumbling decay. Exactly one bang, no fuse, no music, no speech.'),
    'firecracker-chain': (6, False, 'A connected string of Valencian festival firecrackers ignites immediately: irregular sharp dry snaps and deeper cracking bangs accelerate into a dense rolling rattle, with a strong final bang and outdoor echo. Six seconds, no music, no voices.'),
    'boat': (1.1, False, 'One close natural wooden rowing oar stroke: blade enters lake water immediately, pulls with a rich gentle watery swish and small gurgle, then lifts with droplets. One stroke, no engine, no voices, no music.'),
    'water': (8, True, 'Close gentle lake water lapping against a small wooden rowing boat. Soft irregular liquid ripples and little gurgles around the hull, calm open wetland, seamless stable ambience, no voices, no music, no engine.'),
    'waves': (12, True, 'Natural Mediterranean beach surf: successive soft waves roll onto sand, fizz and recede with detailed water wash. Spacious calm coast, seamless ambience, no voices, no music.'),
    'fountain': (8, True, 'A small stone courtyard fountain, clear flowing streams splashing into a shallow pool, detailed delicate droplets and continuous water trickle. Seamless natural ambience, no music or speech.'),
    'tram': (8, True, 'A modern electric city tram running smoothly on rails, warm low electric motor hum, soft rhythmic rail contact and subtle suspension rattle. Clean realistic seamless vehicle ambience, no horn, no voices, no music.'),
    'tram-bell': (2, False, 'A modern European street tram warning bell: two clear metallic ding ding chimes with a short natural ringing decay. No other sounds.'),
    'bell': (1.4, False, 'One cheerful mechanical bicycle bell ring, bright clear metal tring with natural ringing decay. Close recording, no voices, no music.'),
    'birds': (10, True, 'Quiet Mediterranean orange grove, small songbirds chirp naturally at different distances with soft leaves rustling in a light breeze. Sparse peaceful seamless outdoor ambience, no voices, no music.'),
    'cafe': (12, True, 'Small outdoor Spanish cafe ambience, soft distant indistinct conversation without any understandable words, occasional ceramic cup and saucer clink and a faint chair movement. Quiet natural seamless ambience, no music.'),
    'bull': (2.5, False, 'A calm friendly bull makes one soft low contented nasal huff and breathes through its nose while being petted. Close natural animal sound, gentle, no aggressive roar, no speech, no music.'),
}


def main():
    raw = (ROOT / '.elevenlabs.txt').read_text().strip()
    match = re.search(r'(?:sk_|xi_)[A-Za-z0-9_-]+', raw)
    key = match.group(0) if match else raw
    OUT.mkdir(parents=True, exist_ok=True)
    originals = ROOT / 'output/elevenlabs-originals'
    originals.mkdir(parents=True, exist_ok=True)
    for name, (duration, loop, prompt) in SOUNDS.items():
        target, metadata = OUT / f'{name}.flac', OUT / f'{name}.json'
        if target.exists() and metadata.exists():
            print(f'Keep {name}', flush=True)
            continue
        payload = dict(text=prompt, duration_seconds=duration, loop=loop,
                       prompt_influence=.65, model_id='eleven_text_to_sound_v2')
        original = originals / f'{name}.mp3'
        if not original.exists():
            request = urllib.request.Request('https://api.elevenlabs.io/v1/sound-generation?output_format=mp3_44100_128',
                data=json.dumps(payload).encode(), headers={'xi-api-key': key, 'Content-Type': 'application/json'})
            print(f'Generate {name}: {duration}s', flush=True)
            try:
                with urllib.request.urlopen(request, timeout=180) as response:
                    audio = response.read()
                    if 'audio' not in response.headers.get('Content-Type', '') or len(audio) < 1000:
                        raise RuntimeError(f'Invalid audio response for {name}')
                original.write_bytes(audio)
            except urllib.error.HTTPError as error:
                print(f'HTTP {error.code}: ' + error.read().decode(errors='replace').replace(key, '[redacted]'))
                raise SystemExit(1)
        # Stable headroom for mixing. Keep the transient shape of each explosion.
        level = -15 if name in ('masclet', 'firecracker-chain') else -20
        subprocess.run(['ffmpeg', '-y', '-v', 'error', '-i', str(original), '-af',
            f'loudnorm=I={level}:TP=-1.5:LRA=11', '-ar', '44100', '-ac', '1',
            '-sample_fmt', 's16', '-compression_level', '12', str(target)], check=True)
        metadata.write_text(json.dumps({'provider': 'ElevenLabs', **payload}, indent=2) + '\n')
        print(f'Saved {name}', flush=True)

if __name__ == '__main__':
    main()
