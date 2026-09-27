#!/usr/bin/env python3
"""Собирает dist/ — версию сайта для хостинга: только те фотографии, которые
реально показываются, в формате WebP.

Запуск:  python3 scripts/build_dist.py [--limit 10] [--quality 84]
Нужен Pillow:  pip install Pillow

Каталог показывает последние LIMIT работ в каждом разделе (см. LIMIT в
assets/js/works.js), поэтому в dist/ попадают только они плюс обложки и
превью с главной. HTML и gallery.json переписываются на .webp.
"""
import argparse
import json
import os
import re
import shutil
import sys
from concurrent.futures import ThreadPoolExecutor

try:
    from PIL import Image, ImageOps
except ImportError:
    sys.exit("Нужен Pillow: pip install Pillow")

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DIST = os.path.join(ROOT, "dist")
PAGES = ("index.html", "works.html")
PLAIN = ("assets/css/style.css", "assets/js/main.js", "assets/js/works.js", ".nojekyll")


def convert(src_rel, dst_rel, max_side, quality):
    src, dst = os.path.join(ROOT, src_rel), os.path.join(DIST, dst_rel)
    os.makedirs(os.path.dirname(dst), exist_ok=True)
    im = ImageOps.exif_transpose(Image.open(src)).convert("RGB")
    if max(im.size) > max_side:
        k = max_side / max(im.size)
        im = im.resize((round(im.width * k), round(im.height * k)), Image.LANCZOS)
    im.save(dst, "WEBP", quality=quality, method=6)
    return os.path.getsize(dst)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--limit", type=int, default=10, help="фотографий в разделе (как LIMIT в works.js)")
    ap.add_argument("--quality", type=int, default=84, help="качество WebP для крупных фото")
    args = ap.parse_args()

    gallery = json.load(open(os.path.join(ROOT, "assets/data/gallery.json"), encoding="utf-8"))
    gallery.sort(key=lambda r: r["date"], reverse=True)

    used, per_cat = [], {}
    for r in gallery:
        n = per_cat.get(r["cat"], 0)
        if n < args.limit:
            per_cat[r["cat"]] = n + 1
            used.append(r)

    if os.path.isdir(DIST):
        shutil.rmtree(DIST)

    pages = {}
    extra_thumbs, covers = set(), set()
    for page in PAGES:
        html = open(os.path.join(ROOT, page), encoding="utf-8").read()
        extra_thumbs |= set(re.findall(r'"(assets/thumbs/[^"]+\.jpg)"', html))
        covers |= set(re.findall(r'"(assets/img/[^"]+\.jpg)"', html))
        pages[page] = re.sub(r'(assets/(?:img|thumbs)/[^"]+?)\.jpg', r"\1.webp", html)

    jobs = []
    for r in used:
        jobs.append((r["src"], r["src"].replace(".jpg", ".webp"), 1080, args.quality))
        jobs.append((r["thumb"], r["thumb"].replace(".jpg", ".webp"), 480, 76))
    for t in extra_thumbs:  # превью на главной
        jobs.append((t, t.replace(".jpg", ".webp"), 480, 76))
    for c in covers:
        jobs.append((c, c.replace(".jpg", ".webp"), 1600 if "hero" in c else 900, args.quality))

    seen, uniq = set(), []
    for j in jobs:
        if j[1] not in seen:
            seen.add(j[1])
            uniq.append(j)

    with ThreadPoolExecutor(max_workers=8) as ex:
        total = sum(ex.map(lambda a: convert(*a), uniq))

    for rel in PLAIN:
        src = os.path.join(ROOT, rel)
        if not os.path.exists(src):
            continue
        dst = os.path.join(DIST, rel)
        os.makedirs(os.path.dirname(dst), exist_ok=True)
        shutil.copyfile(src, dst)

    for page, html in pages.items():
        open(os.path.join(DIST, page), "w", encoding="utf-8").write(html)

    trimmed = [
        dict(r, src=r["src"].replace(".jpg", ".webp"), thumb=r["thumb"].replace(".jpg", ".webp"))
        for r in used
    ]
    os.makedirs(os.path.join(DIST, "assets/data"), exist_ok=True)
    json.dump(trimmed, open(os.path.join(DIST, "assets/data/gallery.json"), "w", encoding="utf-8"),
              ensure_ascii=False, separators=(",", ":"))

    files = sum(len(f) for _, _, f in os.walk(DIST))
    print(f"dist/: {len(used)} фото в каталоге, {len(uniq)} изображений, {files} файлов, {total/1024/1024:.1f} МБ")
    for cat, n in sorted(per_cat.items(), key=lambda kv: -kv[1]):
        print(f"  {cat}: {n}")


if __name__ == "__main__":
    main()
