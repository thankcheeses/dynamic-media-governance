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
CHROMA_DELTA = 0.20       # red flash: one state saturated red and a CIE 1976 UCS change of more than 0.2 (WCAG 2.2 / ISO 9241-391)
WHITE_UV = (0.19784, 0.46834)  # D65; stands in for black, whose chromaticity is undefined
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
    """Frames and per-frame durations (ms) of a GIF, or of a video via ffmpeg at its own frame rate."""
    if not path.lower().endswith('.gif'):
        return video_frames_of(path)
    img = Image.open(path)
    frames, durations = [], []
    for frame in ImageSequence.Iterator(img):
        frames.append(np.asarray(frame.convert('RGB'), dtype=np.float64))
        durations.append(frame.info.get('duration', 100) or 100)
    return frames, durations


def video_frames_of(path):
    import shutil
    import subprocess
    import tempfile
    rate = subprocess.run(['ffprobe', '-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=r_frame_rate', '-of', 'csv=p=0', path], check=True, capture_output=True, text=True).stdout.strip()
    num, den = (rate.split('/') + ['1'])[:2]
    fps = float(num) / float(den)
    tmp = tempfile.mkdtemp(prefix='header-frames-')
    try:
        subprocess.run(['ffmpeg', '-v', 'error', '-i', path, os.path.join(tmp, '%05d.png')], check=True)
        names = sorted(os.listdir(tmp))
        frames = [np.asarray(Image.open(os.path.join(tmp, n)).convert('RGB'), dtype=np.float64) for n in names]
    finally:
        shutil.rmtree(tmp, ignore_errors=True)
    return frames, [1000.0 / fps] * len(frames)


def chromaticity(R, G, B):
    """CIE 1976 UCS (u', v') per pixel from linear-light RGB arrays."""
    X = 0.4124564 * R + 0.3575761 * G + 0.1804375 * B
    Y = 0.2126729 * R + 0.7151522 * G + 0.0721750 * B
    Z = 0.0193339 * R + 0.1191920 * G + 0.9503041 * B
    d = X + 15 * Y + 3 * Z
    safe = np.where(d > 1e-9, d, 1.0)
    u = np.where(d > 1e-9, 4 * X / safe, WHITE_UV[0])
    v = np.where(d > 1e-9, 9 * Y / safe, WHITE_UV[1])
    return u, v


def transitions(frames, scale):
    """Per frame step: (+1, -1 or 0) for a large-area luminance transition, and the same for red."""
    lin = [(linear(f[..., 0]), linear(f[..., 1]), linear(f[..., 2])) for f in frames]
    lums = [0.2126 * R + 0.7152 * G + 0.0722 * B for R, G, B in lin]
    ratios = [f[..., 0] / np.maximum(f.sum(axis=2), 1e-6) for f in frames]
    uvs = [chromaticity(R, G, B) for R, G, B in lin]
    general, red = [], []
    max_area = 0.0
    n = len(frames)
    for i in range(n):
        j = (i + 1) % n
        a, b = lums[i], lums[j]
        darker = np.minimum(a, b)
        up = ((b - a) >= LUM_DELTA) & (darker < DARK_MAX)
        down = ((a - b) >= LUM_DELTA) & (darker < DARK_MAX)
        up_area, down_area = up.sum() * scale, down.sum() * scale
        step = 1 if up_area > AREA_PX else -1 if down_area > AREA_PX else 0
        general.append(step)
        if step:
            max_area = max(max_area, max(up.sum(), down.sum()) / up.size)
        a_red, b_red = ratios[i] >= RED_RATIO, ratios[j] >= RED_RATIO
        du, dv = uvs[i][0] - uvs[j][0], uvs[i][1] - uvs[j][1]
        moved = np.sqrt(du * du + dv * dv) > CHROMA_DELTA
        into = moved & b_red & (~a_red | (ratios[j] > ratios[i]))
        out = moved & a_red & (~b_red | (ratios[i] > ratios[j]))
        red_up, red_down = into.sum() * scale, out.sum() * scale
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
    parser.add_argument('--red-only', action='store_true', help='only update the red-flash fields of an existing entry in --out (for headers whose GIF is no longer in the repo)')
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
        'analyzer': 'scripts/analyze-header.py (simplified WCAG 2.3.1 screen with the CIE 1976 UCS red flash rule; not a certified PEA tool)',
        'measuredAt': datetime.now(timezone.utc).strftime('%Y-%m-%d'),
    }
    print(json.dumps(result, indent=2))
    if args.out:
        entries = []
        if args.merge and os.path.exists(args.out):
            with open(args.out) as handle:
                existing = json.load(handle)
            existing = existing if isinstance(existing, list) else [existing]
            if args.red_only:
                previous = next((e for e in existing if e.get('id') == args.id), None)
                if previous is None:
                    sys.exit(f'--red-only: no existing entry for {args.id}')
                previous.pop('redFlash', None)
                result = {**previous, 'redFlashesPerSecond': result['redFlashesPerSecond'], 'redSource': os.path.basename(args.gif), 'analyzer': result['analyzer'], 'measuredAt': result['measuredAt']}
            entries = [e for e in existing if e.get('id') != args.id]
        entries.append(result)
        entries.sort(key=lambda e: e['id'])
        with open(args.out, 'w') as handle:
            json.dump(entries, handle, indent=2)
            handle.write('\n')
    ok = result['sizeMB'] <= 8 and result['fps'] <= 15 and result['loopSeconds'] <= 10 and result['flashesPerSecond'] <= MAX_FLASHES and result['redFlashesPerSecond'] <= MAX_FLASHES
    sys.exit(0 if ok else 1)


if __name__ == '__main__':
    main()
