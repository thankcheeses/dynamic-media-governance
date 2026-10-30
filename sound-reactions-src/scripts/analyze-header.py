"""Measure a dynamic header GIF against the Dynamic Media Governance limits.

    python3 -I scripts/analyze-header.py public/headers/clay-orbit.gif \
        --id clay-orbit --out src/header-manifest.json --merge

Checks file size, frame rate and loop length from the file itself, then runs a
simplified version of the WCAG 2.2 general flash and red flash tests
(Success Criterion 2.3.1) over every frame, wrapping the last frame back to the
first because headers loop.

This is a screening aid written for the prototype. It is not a certified
photosensitivity analyser (such as the Harding test or Trace PEAT), and its
results must not be described as certification.
"""
import argparse
import json
import os
import sys
from datetime import datetime, timezone

import numpy as np
from PIL import Image, ImageSequence

# WCAG 2.2 definitions (general flash and red flash thresholds).
LUM_DELTA = 0.10          # a transition is a relative-luminance change of 10% or more
DARK_MAX = 0.80           # ...where the darker state is below 0.80
RED_RATIO = 0.80          # saturated red: R / (R + G + B) >= 0.8
RED_DELTA = 20.0          # red flash: change in (R - G - B) * 320 of more than 20 (WCAG 2.2 note)
# A flash only counts if it covers more than 25% of a 10-degree field, which WCAG
# puts at 21,824 px on a 1024x768 screen. We assume the header is shown at that
# full reference width, the strictest reasonable assumption for a profile banner.
REF_W = 1024
AREA_PX = 21824
MAX_FLASHES = 3


def linear(c):
    c = c / 255.0
    return np.where(c <= 0.04045, c / 12.92, ((c + 0.055) / 1.055) ** 2.4)


def frames_of(path):
    img = Image.open(path)
    frames, durations = [], []
    for frame in ImageSequence.Iterator(img):
        frames.append(np.asarray(frame.convert('RGB'), dtype=np.float64))
        durations.append(frame.info.get('duration', 100) or 100)
    return frames, durations


def transitions(frames, scale):
    """Per frame step: (+1, -1 or 0) for a large-area luminance transition, and the same for red."""
    lums = [0.2126 * linear(f[..., 0]) + 0.7152 * linear(f[..., 1]) + 0.0722 * linear(f[..., 2]) for f in frames]
    reds = []
    for f in frames:
        total = f.sum(axis=2)
        saturated = (f[..., 0] / np.maximum(total, 1e-6)) >= RED_RATIO
        reds.append(np.where(saturated, (linear(f[..., 0]) - linear(f[..., 1]) - linear(f[..., 2])) * 320, 0.0))
    general, red = [], []
    max_area = 0.0
    n = len(frames)
    for i in range(n):
        a, b = lums[i], lums[(i + 1) % n]
        darker = np.minimum(a, b)
        up = ((b - a) >= LUM_DELTA) & (darker < DARK_MAX)
        down = ((a - b) >= LUM_DELTA) & (darker < DARK_MAX)
        up_area, down_area = up.sum() * scale, down.sum() * scale
        step = 1 if up_area > AREA_PX else -1 if down_area > AREA_PX else 0
        general.append(step)
        if step:
            max_area = max(max_area, max(up.sum(), down.sum()) / up.size)
        dr = reds[(i + 1) % n] - reds[i]
        red_up, red_down = (dr > RED_DELTA).sum() * scale, (dr < -RED_DELTA).sum() * scale
        red.append(1 if red_up > AREA_PX else -1 if red_down > AREA_PX else 0)
    return general, red, max_area


def max_flashes_per_second(steps, durations):
    """A flash is a pair of opposing transitions. Count the most flashes in any one-second window."""
    times = np.cumsum([0] + durations[:-1]) / 1000.0
    events = [(t, s) for t, s in zip(times, steps) if s != 0]
    best = 0
    for start, _ in events:
        window = [s for t, s in events if start <= t < start + 1.0]
        opposing = sum(1 for x, y in zip(window, window[1:]) if x != y)
        best = max(best, (opposing + 1) // 2 if window else 0)
    return best


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('gif')
    parser.add_argument('--id', required=True)
    parser.add_argument('--out')
    parser.add_argument('--merge', action='store_true', help='keep other ids already in --out (a JSON list)')
    args = parser.parse_args()

    frames, durations = frames_of(args.gif)
    h, w = frames[0].shape[:2]
    scale = (REF_W / w) ** 2
    general, red, max_area = transitions(frames, scale)
    loop_s = sum(durations) / 1000.0
    fps = round(len(frames) / loop_s, 2)
    size_mb = round(os.path.getsize(args.gif) / 1024 / 1024, 2)
    result = {
        'id': args.id,
        'gif': os.path.basename(args.gif),
        'width': w,
        'height': h,
        'frames': len(frames),
        'fps': fps,
        'loopSeconds': round(loop_s, 2),
        'sizeMB': size_mb,
        'flashesPerSecond': max_flashes_per_second(general, durations),
        'redFlashesPerSecond': max_flashes_per_second(red, durations),
        'flashArea': round(max_area, 2),
        'analyzer': 'scripts/analyze-header.py (simplified WCAG 2.3.1 screen; not a certified PEA tool)',
        'measuredAt': datetime.now(timezone.utc).strftime('%Y-%m-%d'),
    }
    result['redFlash'] = result['redFlashesPerSecond'] > 0
    print(json.dumps(result, indent=2))
    if args.out:
        entries = []
        if args.merge and os.path.exists(args.out):
            with open(args.out) as handle:
                existing = json.load(handle)
            entries = [e for e in (existing if isinstance(existing, list) else [existing]) if e.get('id') != args.id]
        entries.append(result)
        entries.sort(key=lambda e: e['id'])
        with open(args.out, 'w') as handle:
            json.dump(entries, handle, indent=2)
            handle.write('\n')
    ok = size_mb <= 8 and fps <= 15 and loop_s <= 10 and result['flashesPerSecond'] <= MAX_FLASHES and not result['redFlash']
    sys.exit(0 if ok else 1)


if __name__ == '__main__':
    main()
