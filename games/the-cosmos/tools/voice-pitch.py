"""Rough pitch (F0) of each cast voice from its generated clips: a sanity check that men sit low, women high, and that no two
voices collapse onto one another. Not a quality judgement: nobody has listened to these yet. Run: python tools/voice-pitch.py"""
import json, subprocess, sys, os
import numpy as np

root = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'assets', 'voices')
lines = json.load(open(os.path.join(root, 'lines.json')))
by = {}
for k, l in lines.items():
    by.setdefault(l['voice'], []).append(k)

def f0(path):
    raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', path, '-f', 's16le', '-ac', '1', '-ar', '16000', '-'], capture_output=True).stdout
    x = np.frombuffer(raw, dtype=np.int16).astype(np.float32) / 32768
    n, hop = 640, 320
    out = []
    for i in range(0, len(x) - n, hop):
        w = x[i:i + n]
        if np.sqrt(np.mean(w * w)) < 0.02:
            continue
        w = w - w.mean()
        ac = np.correlate(w, w, 'full')[n - 1:]
        lo, hi = int(16000 / 400), int(16000 / 70)
        j = lo + int(np.argmax(ac[lo:hi]))
        if ac[j] / (ac[0] + 1e-9) > 0.45:
            out.append(16000 / j)
    return np.median(out) if out else float('nan')

rows = []
for v, keys in sorted(by.items()):
    vals = [f0(os.path.join(root, k + '.mp3')) for k in keys[:5]]
    vals = [a for a in vals if a == a]
    rows.append((v, float(np.median(vals)) if vals else float('nan'), len(keys)))
for v, m, n in sorted(rows, key=lambda r: r[1]):
    print(f'{v:12s} median F0 {m:6.1f} Hz   ({n} clips)')
