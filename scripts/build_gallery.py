#!/usr/bin/env python3
"""Пересобирает превью и assets/data/gallery.json по содержимому photos/vk/.

Запуск:  python3 scripts/build_gallery.py
Нужен Pillow:  pip install Pillow

Сканирует photos/vk/<категория>/*.jpg, делает превью шириной 480 px
в assets/thumbs/<категория>/ (уже существующие не трогает) и пишет
список фотографий для галереи. Имя файла вида ГГГГ-ММ-ДД_id.jpg —
дата берётся из него, категория из имени папки.
"""
import json
import os
import re
import sys
from concurrent.futures import ThreadPoolExecutor

try:
    from PIL import Image, ImageOps
except ImportError:
    sys.exit("Нужен Pillow: pip install Pillow")

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC_DIR = os.path.join(ROOT, "photos", "vk")
THUMB_W = 480
QUALITY = 76
DATE_RE = re.compile(r"(\d{4}-\d{2}-\d{2})")


def build(path):
    cat = os.path.basename(os.path.dirname(path))
    name = os.path.basename(path)
    rel_thumb = f"assets/thumbs/{cat}/{name}"
    dst = os.path.join(ROOT, rel_thumb)
    os.makedirs(os.path.dirname(dst), exist_ok=True)
    try:
        im = ImageOps.exif_transpose(Image.open(path)).convert("RGB")
        w, h = im.size
        if not (os.path.exists(dst) and os.path.getsize(dst) > 1000):
            th = im.resize((THUMB_W, max(1, round(h * THUMB_W / w))), Image.LANCZOS)
            th.save(dst, "JPEG", quality=QUALITY, optimize=True, progressive=True)
        m = DATE_RE.search(name)
        return {
            "src": os.path.relpath(path, ROOT).replace(os.sep, "/"),
            "thumb": rel_thumb,
            "w": w,
            "h": h,
            "cat": cat,
            "date": m.group(1) if m else "",
            "caption": "",
        }
    except Exception as exc:  # битый или недокачанный файл — пропускаем
        print(f"пропущено: {path} ({exc})", file=sys.stderr)
        return None


def main():
    files = []
    for folder, _, names in os.walk(SRC_DIR):
        files += [os.path.join(folder, n) for n in names if n.lower().endswith((".jpg", ".jpeg"))]
    if not files:
        sys.exit(f"В {SRC_DIR} нет фотографий")

    with ThreadPoolExecutor(max_workers=8) as ex:
        items = [r for r in ex.map(build, sorted(files)) if r]

    items.sort(key=lambda r: (r["date"], r["src"]), reverse=True)
    out = os.path.join(ROOT, "assets", "data", "gallery.json")
    os.makedirs(os.path.dirname(out), exist_ok=True)
    with open(out, "w", encoding="utf-8") as f:
        json.dump(items, f, ensure_ascii=False, separators=(",", ":"))

    by_cat = {}
    for r in items:
        by_cat[r["cat"]] = by_cat.get(r["cat"], 0) + 1
    print(f"Готово: {len(items)} фото")
    for cat, n in sorted(by_cat.items(), key=lambda kv: -kv[1]):
        print(f"  {cat}: {n}")


if __name__ == "__main__":
    main()
