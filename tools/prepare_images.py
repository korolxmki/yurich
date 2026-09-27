#!/usr/bin/env python3
"""Resize the watermark-free photos into the web-sized assets the site loads."""
import json, os
from PIL import Image, ImageOps

SRC, OUT = 'photos_clean', 'assets/img/works'
FULL, THUMB, Q = 1500, 760, 82

# slug -> source file, category, caption
WORKS = [
 ('kuhnya-grafit-podsvetka',  'photo_10_2026-09-27_12-51-21.jpg', 'grafit',   'Графитовая кухня с контурной подсветкой'),
 ('kuhnya-grafit-bar',        'photo_11_2026-09-27_12-51-21.jpg', 'grafit',   'Графит и дерево с барной зоной'),
 ('kuhnya-grafit-vytyazhka',  'photo_3_2026-09-27_12-51-21.jpg',  'grafit',   'Серый матовый фасад с чёрной вытяжкой'),
 ('kuhnya-belaya-mramor',     'photo_15_2026-09-27_12-51-21.jpg', 'svetlye',  'Белая кухня-столовая с мраморным полом'),
 ('kuhnya-belaya-uglovaya',   'photo_16_2026-09-27_12-51-21.jpg', 'svetlye',  'Белая угловая кухня в минимализме'),
 ('kuhnya-belaya-chernyy',    'photo_17_2026-09-27_12-51-21.jpg', 'svetlye',  'Белые фасады с чёрной столешницей'),
 ('kuhnya-belaya-derevo',     'photo_19_2026-09-27_12-51-21.jpg', 'svetlye',  'Белый гарнитур с деревянной столешницей'),
 ('kuhnya-belaya-ostrov',     'photo_4_2026-09-27_12-51-21.jpg',  'svetlye',  'Белая кухня с островом'),
 ('kuhnya-belaya-vitrina',    'photo_6_2026-09-27_12-51-21.jpg',  'svetlye',  'Белая кухня со стеклянной витриной'),
 ('kuhnya-belaya-mramor-2',   'photo_7_2026-09-27_12-51-21.jpg',  'svetlye',  'Светлая кухня с мраморным фартуком'),
 ('kuhnya-belaya-okno',       'photo_8_2026-09-27_12-51-21.jpg',  'svetlye',  'Кухня у окна с деревянной столешницей'),
 ('kuhnya-belaya-ugol',       'photo_9_2026-09-27_12-51-21.jpg',  'svetlye',  'Угловая кухня со встроенной техникой'),
 ('kuhnya-belaya-nisha',      'photo_1_2026-09-27_12-51-21.jpg',  'svetlye',  'Белая кухня с нишей под технику'),
 ('kuhnya-belaya-reshetka',   'photo_20_2026-09-27_12-51-21.jpg', 'svetlye',  'Светлая кухня с деревянной стеновой панелью'),
 ('kuhnya-zelenaya-bolshaya', 'photo_1_2026-09-27_12-49-59.jpg',  'tsvetnye', 'Кухня цвета хаки во всю стену'),
 ('kuhnya-zelenaya-uglovaya', 'photo_3_2026-09-27_12-48-15.jpg',  'tsvetnye', 'Тёмно-зелёная угловая кухня'),
 ('kuhnya-olivkovaya-vitrina','photo_4_2026-09-27_12-49-59.jpg',  'tsvetnye', 'Оливковый гарнитур с витриной под посуду'),
 ('kuhnya-olivkovaya-reyki',  'photo_5_2026-09-27_12-49-59.jpg',  'tsvetnye', 'Оливковый глянец с рейками'),
 ('kuhnya-sinyaya-reyki',     'photo_5_2026-09-27_12-51-21.jpg',  'tsvetnye', 'Синяя кухня с реечным фасадом'),
 ('kuhnya-zelenaya-derevo',   'photo_6_2026-09-27_12-48-15.jpg',  'tsvetnye', 'Тёмно-зелёная кухня с деревянной столешницей'),
 ('kuhnya-zelenaya-stol',     'photo_2_2026-09-27_12-48-15.jpg',  'tsvetnye', 'Кухня с выносным обеденным столом'),
 ('detal-stoleshnica',        'photo_18_2026-09-27_12-51-21.jpg', 'detali',   'Кромка деревянной столешницы'),
 ('detal-glyanec',            'photo_6_2026-09-27_12-49-59.jpg',  'detali',   'Глянцевый фасад крупным планом'),
 ('detal-mramor',             'photo_2_2026-09-27_12-51-21.jpg',  'detali',   'Чёрная столешница под камень'),
]

PORTRAITS = [('yurich-about.jpg', 'photo_2026-07-30_12-36-67.jpg', 1200)]


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


if __name__ == '__main__':
    main()
