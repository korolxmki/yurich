#!/usr/bin/env python3
"""Вырезать Юрича с чёрного фона для первого экрана.

Исходник — портрет, который заказчик смонтировал сам. Лицо трогать нельзя,
поэтому никакой генерации: только альфа-канал и кромка.

Три вещи, которые делает скрипт:

1. Матирование (rembg + pymatting). Фон чёрный, и у края пиксели подмешаны
   к нему: если просто выбить чёрный, на светлом фоне останется тёмный ореол.
   Матирование оценивает истинный цвет пикселя у края и снимает подмес.

2. Чистка следов монтажа. По правому краю остались две вещи: светлая рваная
   кромка вдоль тёмного предплечья и полупрозрачная серая «ножка» ниже локтя.
   Ни то, ни другое — не он.

3. Нижний срез уводим в прозрачность. Иначе ровная линия обрыва, да ещё с
   тенью от CSS, читается как ошибка вёрстки.

    python3 tools/cutout_yurich.py
"""
import os
import cv2
import numpy as np
from PIL import Image
from rembg import new_session, remove

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'photos', 'yurich-portret-montazh.jpg')
DST = os.path.join(ROOT, 'assets', 'img', 'yurich-cutout.webp')

# зона правого края, где остались следы монтажа: там только кожа и ткань,
# ни волос, ни бахромы, поэтому кромку можно править жёстко
SLED = (slice(950, 1075), slice(640, 848))   # светлая рваная кромка
NOGA_Y = 985                                  # ниже — полупрозрачная серая полоса
FADE = 58                                     # на столько пикселей растворяем низ


def main():
    im = Image.open(SRC).convert('RGB')
    ses = new_session('isnet-general-use')

    # 1. силуэт с оценкой истинного цвета у края
    cut = remove(im, session=ses, alpha_matting=True,
                 alpha_matting_foreground_threshold=250,
                 alpha_matting_background_threshold=8,
                 alpha_matting_erode_size=12)
    arr = np.asarray(cut).astype(np.float32)
    rgb, alpha = arr[..., :3] / 255.0, arr[..., 3] / 255.0
    h, w = alpha.shape

    # 2а. светлая кромка вдоль тёмного края: сравниваем яркость пикселя с
    #     яркостью «мякоти» рядом — опору берём размытием глубоко внутри силуэта
    lum = rgb.max(axis=2)
    inner = cv2.erode((alpha > 0.95).astype(np.uint8), np.ones((9, 9), np.uint8))
    ref = cv2.inpaint((lum * 255).astype(np.uint8), 1 - inner, 11, cv2.INPAINT_TELEA)
    ref = cv2.GaussianBlur(ref.astype(np.float32) / 255.0, (0, 0), 4)

    ys, xs = SLED
    # яркое там, где вокруг темно, — это чужое: либо полупрозрачная кромка,
    # либо совсем непрозрачные крапины, оставшиеся от монтажа
    svetlo = lum[ys, xs] > ref[ys, xs] + 0.14
    kraj = svetlo & ((alpha[ys, xs] < 0.995) | (ref[ys, xs] < 0.35))
    sub = alpha[ys, xs]
    sub[kraj] = 0.0
    # после вырезания точек край рваный — приглаживаем его медианой
    sub = cv2.medianBlur((sub * 255).astype(np.uint8), 5).astype(np.float32) / 255.0
    alpha[ys, xs] = cv2.GaussianBlur(sub, (0, 0), 0.8)
    print(f'светлая кромка: убрано {int(kraj.sum())} пикселей')

    # 2б. ниже локтя одна ткань: полупрозрачную кромку убираем целиком
    low = alpha[NOGA_Y:].copy()
    low = np.where(low < 0.88, 0.0, low)
    alpha[NOGA_Y:] = cv2.GaussianBlur(low, (0, 0), 0.8)

    # 2в. отдельные ошмётки
    m = (alpha > 0.5).astype(np.uint8)
    n, lab, stats, _ = cv2.connectedComponentsWithStats(m, 8)
    if n > 2:
        keep = 1 + int(np.argmax(stats[1:, cv2.CC_STAT_AREA]))
        drop = (lab != keep) & (lab != 0)
        alpha[drop] = 0
        print(f'отдельных кусков: {n - 2}, убрано {int(drop.sum())} пикселей')

    # 3. растворяем низ
    fade = np.ones(h, np.float32)
    fade[h - FADE:h - 4] = np.linspace(1, 0.06, FADE - 4)
    fade[h - 4:] = 0.0
    alpha *= fade[:, None]

    out = np.dstack([rgb * 255, np.clip(alpha, 0, 1)[..., None] * 255]).astype(np.uint8)
    Image.fromarray(out, 'RGBA').save(DST, 'WEBP', quality=92, method=6)
    print(f'{os.path.relpath(DST, ROOT)} — {os.path.getsize(DST) // 1024} КБ, {w}×{h}')


if __name__ == '__main__':
    main()
