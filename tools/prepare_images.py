#!/usr/bin/env python3
"""Resize the watermark-free photos into the web-sized assets the site loads."""
import json, os
from PIL import Image, ImageOps

SRC, OUT = 'photos_clean', 'assets/img/works'
FULL, THUMB, Q = 1500, 760, 82

# slug -> source file, category, caption
# Один кадр на кухню: снимки одного и того же гарнитура с разных ракурсов
# в портфолио не идут.
WORKS = [
 ('kuhnya-grafit-podsvetka',  'photo_10_2026-09-27_12-51-21.jpg', 'grafit',   'Графитовая кухня с контурной подсветкой'),
 ('kuhnya-grafit-vytyazhka',  'photo_3_2026-09-27_12-51-21.jpg',  'grafit',   'Серый матовый фасад с чёрной вытяжкой'),
 ('kuhnya-belaya-mramor',     'photo_15_2026-09-27_12-51-21.jpg', 'svetlye',  'Белая кухня-столовая с мраморным полом'),
 ('kuhnya-belaya-uglovaya',   'photo_16_2026-09-27_12-51-21.jpg', 'svetlye',  'Белая угловая кухня в минимализме'),
 ('kuhnya-belaya-chernyy',    'photo_17_2026-09-27_12-51-21.jpg', 'svetlye',  'Белые фасады с чёрной столешницей'),
 ('kuhnya-belaya-derevo',     'photo_19_2026-09-27_12-51-21.jpg', 'svetlye',  'Белый гарнитур с деревянной столешницей'),
 ('kuhnya-belaya-ostrov',     'photo_4_2026-09-27_12-51-21.jpg',  'svetlye',  'Белая кухня с островом'),
 ('kuhnya-belaya-vitrina',    'photo_6_2026-09-27_12-51-21.jpg',  'svetlye',  'Белая кухня со стеклянной витриной'),
 ('kuhnya-belaya-ugol',       'photo_9_2026-09-27_12-51-21.jpg',  'svetlye',  'Угловая кухня со встроенной техникой'),
 ('kuhnya-belaya-nisha',      'photo_1_2026-09-27_12-51-21.jpg',  'svetlye',  'Белая кухня с нишей под технику'),
 ('kuhnya-belaya-reshetka',   'photo_20_2026-09-27_12-51-21.jpg', 'svetlye',  'Светлая кухня с деревянной стеновой панелью'),
 ('kuhnya-zelenaya-bolshaya', 'photo_1_2026-09-27_12-49-59.jpg',  'tsvetnye', 'Кухня цвета хаки во всю стену'),
 ('kuhnya-olivkovaya-vitrina','photo_4_2026-09-27_12-49-59.jpg',  'tsvetnye', 'Оливковый гарнитур с витриной под посуду'),
 ('kuhnya-olivkovaya-reyki',  'photo_5_2026-09-27_12-49-59.jpg',  'tsvetnye', 'Оливковый глянец с рейками'),
 ('kuhnya-sinyaya-reyki',     'photo_5_2026-09-27_12-51-21.jpg',  'tsvetnye', 'Синяя кухня с реечным фасадом'),
 ('kuhnya-zelenaya-derevo',   'photo_6_2026-09-27_12-48-15.jpg',  'tsvetnye', 'Тёмно-зелёная кухня с деревянной столешницей'),
]

PORTRAITS = [('yurich-about.jpg', 'photo_2026-07-30_12-36-67.jpg', 1200)]

# Коллекции собираются из фотографий фабрики (photos_vardek_clean).
# slug -> исходный файл. Названия и цены задаются в content/collections.js.
COLLECTION_SRC = 'photos_vardek_clean'
COLLECTION_PHOTOS = [
    ('emal-1', 'p06_1.jpg'), ('emal-2', 'p01_1.jpg'), ('emal-3', 'p09_1.jpg'), ('emal-4', 'p05_1.jpg'),
    ('derevo-1', 'p08_1.jpg'), ('derevo-2', 'p13_1.jpg'), ('derevo-3', 'p20_1.jpg'), ('derevo-4', 'p14_1.jpg'),
    ('cvet-1', 'p04_1.jpg'), ('cvet-2', 'p02_1.jpg'), ('cvet-3', 'p03_1.jpg'), ('cvet-4', 'p07_1.jpg'),
    ('grafit-1', 'p16_1.jpg'), ('grafit-2', 'p17_1.jpg'), ('grafit-3', 'p10_1.jpg'),
    ('klassika-1', 'p11_1.jpg'), ('klassika-2', 'p12_1.jpg'),
    ('glyanec-1', 'p18_1.jpg'), ('glyanec-2', 'p19_1.jpg'),
]


def save(im, path, width):
    im = ImageOps.exif_transpose(im).convert('RGB')
    if im.width > width:
        im = im.resize((width, round(im.height * width / im.width)), Image.LANCZOS)
    im.save(path, quality=Q, optimize=True, progressive=True)
    return im.size


def main():
    os.makedirs(OUT, exist_ok=True)
    os.makedirs(f'{OUT}/thumb', exist_ok=True)
    index = []
    for slug, src, cat, caption in WORKS:
        im = Image.open(os.path.join(SRC, src))
        w, h = save(im, f'{OUT}/{slug}.jpg', FULL)
        save(im, f'{OUT}/thumb/{slug}.jpg', THUMB)
        index.append({'slug': slug, 'category': cat, 'caption': caption, 'w': w, 'h': h})
        print(f'{slug:28} {cat:9} {w}x{h}')
    with open('content/works.js', 'w') as fh:
        fh.write('window.WORKS = ' + json.dumps(index, ensure_ascii=False, indent=1) + ';\n')

    for dst, src, width in PORTRAITS:
        print(dst, save(Image.open(os.path.join(SRC, src)), f'assets/img/{dst}', width))

    os.makedirs('assets/img/collections/thumb', exist_ok=True)
    for slug, src in COLLECTION_PHOTOS:
        im = Image.open(os.path.join(COLLECTION_SRC, src))
        w, h = save(im, f'assets/img/collections/{slug}.jpg', FULL)
        save(im, f'assets/img/collections/thumb/{slug}.jpg', THUMB)
        print(f'коллекции: {slug:12} {w}x{h}')


if __name__ == '__main__':
    main()
