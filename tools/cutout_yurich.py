#!/usr/bin/env python3
"""Вырезать Юрича с фона для первого экрана.

Исходник — портрет на ровном светлом фоне, обрезанный заказчиком. Лицо
трогать нельзя, поэтому никакой генерации: работаем только с альфа-каналом.

Главное здесь — матирование (rembg + pymatting). У края пиксели наполовину
фон, наполовину он, и просто выбить фон по цвету нельзя: на светлом фоне
сайта остаётся грязная кайма. Матирование оценивает, какой у пикселя
истинный цвет и какая доля фона, и снимает подмес.

Нижний срез уводим в прозрачность: там он обрезан кадром, и ровная линия
обрыва, да ещё с тенью от CSS, читается как ошибка вёрстки.

    python3 tools/cutout_yurich.py
"""
import os
import cv2
import numpy as np
from PIL import Image
from rembg import new_session, remove

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'photos', 'yurich-portret.webp')
DST = os.path.join(ROOT, 'assets', 'img', 'yurich-cutout.webp')

FADE = 70        # на столько пикселей растворяем нижний срез
POLYA = 6        # прозрачные поля, чтобы силуэт не упирался в край кадра
MUSOR = 400      # куски мельче — мусор, а не он


def main():
    im = Image.open(SRC).convert('RGB')
    ses = new_session('isnet-general-use')

    cut = remove(im, session=ses, alpha_matting=True,
                 alpha_matting_foreground_threshold=250,
                 alpha_matting_background_threshold=8,
                 alpha_matting_erode_size=12)
    arr = np.asarray(cut).astype(np.float32)
    rgb, alpha = arr[..., :3] / 255.0, arr[..., 3] / 255.0

    # отдельные ошмётки фона, которые сетка приняла за него
    n, lab, stats, _ = cv2.connectedComponentsWithStats((alpha > 0.5).astype(np.uint8), 8)
    if n > 2:
        keep = 1 + int(np.argmax(stats[1:, cv2.CC_STAT_AREA]))
        drop = (lab != keep) & (lab != 0)
        alpha[drop] = 0
        print(f'отдельных кусков: {n - 2}, убрано {int(drop.sum())} пикселей')

    # Обрезаем прозрачную пустоту по бокам. Она на экране не видна, но входит
    # в размер картинки, а значит уменьшает его в колонке первого экрана:
    # с полями он выходил на четверть мельче и сползал вниз.
    ys, xs = np.where(alpha > 0.02)
    y0, y1, x0, x1 = ys.min(), ys.max() + 1, xs.min(), xs.max() + 1
    print(f'обрезано пустоты: слева {x0}, справа {alpha.shape[1] - x1}, '
          f'сверху {y0}, снизу {alpha.shape[0] - y1}')
    rgb, alpha = rgb[y0:y1, x0:x1], alpha[y0:y1, x0:x1]

    # поля по краям: силуэт упирается в срез кадра, а тень от CSS по упёртому
    # краю даёт резкую линию
    rgb = np.pad(rgb, ((POLYA, POLYA), (POLYA, POLYA), (0, 0)), mode='edge')
    alpha = np.pad(alpha, ((POLYA, POLYA), (POLYA, POLYA)))
    h, w = alpha.shape

    # растворяем низ
    fade = np.ones(h, np.float32)
    fade[h - FADE:h - POLYA] = np.linspace(1, 0.05, FADE - POLYA)
    fade[h - POLYA:] = 0.0
    alpha *= fade[:, None]

    out = np.dstack([rgb * 255, np.clip(alpha, 0, 1)[..., None] * 255]).astype(np.uint8)
    Image.fromarray(out, 'RGBA').save(DST, 'WEBP', quality=92, method=6)
    print(f'{os.path.relpath(DST, ROOT)} — {os.path.getsize(DST) // 1024} КБ, {w}×{h}')


if __name__ == '__main__':
    main()
