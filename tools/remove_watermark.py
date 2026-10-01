#!/usr/bin/env python3
"""Detect and remove the "B"-in-a-ring-of-stars watermark stamped on the kitchen photos.

The badge always sits in the bottom-left corner, sized ~11-14% of the image height. It
comes in an opaque and a translucent variant, so detection correlates the badge's *shape*
against image luminance (brightness-invariant) rather than thresholding for white.
Matched regions are then filled in with LaMa.

    python3 tools/remove_watermark.py --dry-run      # detect only
    python3 tools/remove_watermark.py                # detect + inpaint into photos_clean/
"""
import argparse, glob, json, os
import cv2, numpy as np
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
TPL = cv2.imread(os.path.join(HERE, 'watermark_template.png'), 0)
AR = TPL.shape[0] / TPL.shape[1]


def locate(img, anywhere=False):
    """Best badge candidate: (box, score, contrast).

    By default only the bottom-left corner is searched, which is where the first
    batch of photos carried the badge. `anywhere` scans the whole frame instead —
    later batches put it bottom-right and bottom-centre too.
    """
    h, w = img.shape[:2]
    oy, ox = (0, w) if anywhere else (int(h * 0.72), int(w * 0.30))
    gray = cv2.GaussianBlur(cv2.cvtColor(img[oy:h, 0:ox], cv2.COLOR_BGR2GRAY), (3, 3), 0)

    lo, hi = (int(0.05 * h), int(0.20 * h)) if anywhere else (max(30, int(0.09 * h)), int(0.17 * h))
    best = (-2.0, None)
    for side in range(max(24, lo), max(lo + 4, hi), 2):
        tw, th = side, int(side * AR)
        if th >= gray.shape[0] or tw >= gray.shape[1]:
            continue
        t = cv2.resize(TPL, (tw, th), interpolation=cv2.INTER_AREA)
        # знак встречается и белым, и чёрным: на тёмный шаблон отклик
        # отрицательный, поэтому берём лучший из двух полярностей
        for probe in (t, 255 - t):
            _, mx, _, loc = cv2.minMaxLoc(cv2.matchTemplate(gray, probe, cv2.TM_CCOEFF_NORMED))
            if mx > best[0]:
                best = (mx, (loc[0], oy + loc[1], tw, th))
    score, box = best
    if box is None:
        return None, -1.0, -1.0
    bx, by, bw, bh = box
    stamp = cv2.resize(TPL, (bw, bh), interpolation=cv2.INTER_AREA) > 127
    patch = cv2.cvtColor(img[by:by + bh, bx:bx + bw], cv2.COLOR_BGR2GRAY).astype(float)
    # знак бывает тёмным — знак разницы не важен, важна её величина
    return box, score, abs(float(patch[stamp].mean() - patch[~stamp].mean()))


def is_watermark(img, box, score, contrast, anywhere=False):
    """A strong shape match, or a weaker one that still sits hard in a corner."""
    if box is None:
        return False
    if score > 0.45:
        return True
    h, w = img.shape[:2]
    bx, by, bw, bh = box
    near_bottom = (h - by - bh) < 0.08 * h
    near_side = bx < 0.08 * w or (w - bx - bw) < 0.08 * w
    in_corner = near_bottom and (near_side if anywhere else bx < 0.06 * w)
    return score > 0.25 and contrast > 40 and in_corner


def build_mask(shape, box, grow=0.14, close=0.10):
    """Badge silhouette, dilated past its antialiased edge and closed into one blob."""
    h, w = shape
    bx, by, bw, bh = box
    m = np.zeros((h, w), np.uint8)
    m[by:by + bh, bx:bx + bw] = cv2.resize(TPL, (bw, bh), interpolation=cv2.INTER_LINEAR)
    kd = max(3, int(round(grow * bw)) | 1)
    m = cv2.dilate(m, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (kd, kd)))
    kc = max(5, int(round(close * bw)) | 1)
    m = cv2.morphologyEx(m, cv2.MORPH_CLOSE, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (kc, kc)))
    return (m > 40).astype(np.uint8) * 255


def inpaint(lama, img, box, grow=0.14, zoom_to=640, ctx=1.6):
    """Fill the badge in. LaMa runs at a fixed internal resolution, so feeding it a
    magnified crop around the badge — rather than the whole frame — leaves it far more
    detail to continue countertop edges, cabinet gaps and plinths across the hole."""
    h, w = img.shape[:2]
    bx, by, bw, bh = box
    px, py = int(bw * ctx), int(bh * ctx)
    cx0, cy0 = max(0, bx - px), max(0, by - py)
    cx1, cy1 = min(w, bx + bw + px), min(h, by + bh + py)

    mask = build_mask((h, w), box, grow=grow)
    crop, cmask = img[cy0:cy1, cx0:cx1], mask[cy0:cy1, cx0:cx1]
    ch, cw = crop.shape[:2]
    scale = zoom_to / max(ch, cw)
    if scale > 1:
        zi = cv2.resize(crop, None, fx=scale, fy=scale, interpolation=cv2.INTER_CUBIC)
        zm = cv2.resize(cmask, None, fx=scale, fy=scale, interpolation=cv2.INTER_NEAREST)
    else:
        zi, zm = crop, cmask

    filled = np.array(lama(Image.fromarray(cv2.cvtColor(zi, cv2.COLOR_BGR2RGB)),
                           Image.fromarray(zm)))[:zi.shape[0], :zi.shape[1]]
    filled = cv2.cvtColor(filled, cv2.COLOR_RGB2BGR)
    if scale > 1:
        filled = cv2.resize(filled, (cw, ch), interpolation=cv2.INTER_AREA)

    out = img.copy()
    region = out[cy0:cy1, cx0:cx1]
    region[cmask > 0] = filled[cmask > 0]     # everything outside the mask stays original
    out[cy0:cy1, cx0:cx1] = region
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--src', default='photos')
    ap.add_argument('--out', default='photos_clean')
    ap.add_argument('--dry-run', action='store_true')
    ap.add_argument('--anywhere', action='store_true',
                    help='искать знак по всему кадру, а не только в левом нижнем углу')
    a = ap.parse_args()

    files = sorted(glob.glob(os.path.join(a.src, '*.jpg')))
    os.makedirs(a.out, exist_ok=True)
    lama = None
    if not a.dry_run:
        from simple_lama_inpainting import SimpleLama
        lama = SimpleLama()

    report = {}
    for f in files:
        name = os.path.basename(f)
        img = cv2.imread(f)
        box, score, contrast = locate(img, a.anywhere)
        hit = is_watermark(img, box, score, contrast, a.anywhere)
        report[name] = {'watermark': bool(hit), 'box': list(map(int, box)) if box else None,
                        'score': round(score, 3), 'contrast': round(contrast, 1)}
        print(f'{name:40} {"WM" if hit else "--"} score={score:.3f} contrast={contrast:6.1f}')
        if a.dry_run:
            continue
        dst = os.path.join(a.out, name)
        if not hit:
            cv2.imwrite(dst, img, [cv2.IMWRITE_JPEG_QUALITY, 95])
            continue
        cv2.imwrite(dst, inpaint(lama, img, box), [cv2.IMWRITE_JPEG_QUALITY, 95])

    name = 'watermark_report.json' if a.src == 'photos' else 'watermark_report_%s.json' % os.path.basename(a.src.rstrip('/'))
    json.dump(report, open(os.path.join(HERE, name), 'w'), indent=1)
    print(f'\n{sum(v["watermark"] for v in report.values())} of {len(report)} photos carried the watermark')


if __name__ == '__main__':
    main()
