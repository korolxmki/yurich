#!/usr/bin/env python3
"""Собрать папку для заливки на обычный хостинг — dist/site.

В неё попадает только то, что нужно браузеру и серверу: страницы, стили,
скрипты, картинки, данные, lead.php и .htaccess. Исходники фотографий,
скрипты сборки и README остаются в репозитории.

Попутно генерируются robots.txt и sitemap.xml, а в каждую страницу
подставляются canonical и og:url. Адрес сайта берётся из siteUrl
в content/config.js — он один на все эти места, менять нужно только там.

    python3 tools/build_hosting.py
"""
import os
import re
import shutil
from datetime import date

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'dist', 'site')

PAGES = ['index.html', 'blog.html', 'post.html', 'collections.html', 'privacy.html']
FILES = ['lead.php', 'secrets.example.php', '.htaccess']
DIRS = ['assets', 'content']

# что показывать поисковику: адрес, насколько часто меняется, важность
MAP = [
    ('', 'weekly', '1.0'),
    ('collections.html', 'monthly', '0.8'),
    ('blog.html', 'weekly', '0.7'),
    ('privacy.html', 'yearly', '0.2'),
]


def read(path):
    with open(os.path.join(ROOT, path), encoding='utf-8') as fh:
        return fh.read()


def site_url():
    m = re.search(r"siteUrl:\s*'([^']+)'", read('content/config.js'))
    if not m:
        raise SystemExit('В content/config.js не задан siteUrl')
    return m.group(1).rstrip('/')


def posts():
    """Статьи блога: адрес и дата — прямо из content/posts.js."""
    body = read('content/posts.js')
    slugs = re.findall(r'"slug":\s*"([^"]+)"', body)
    dates = re.findall(r'"date":\s*"([^"]+)"', body)
    return list(zip(slugs, dates))


def canonical(html, url, path):
    """Подставить canonical и og:url. Без них поисковик считает адреса
    с ?slug= и без него разными страницами и делит между ними вес."""
    full = url + '/' + path if path else url + '/'
    tags = f'<link rel="canonical" href="{full}">\n<meta property="og:url" content="{full}">'
    if 'rel="canonical"' in html:
        return html
    return html.replace('<link rel="stylesheet"', tags + '\n<link rel="stylesheet"', 1)


def build():
    url = site_url()
    shutil.rmtree(OUT, ignore_errors=True)
    os.makedirs(OUT, exist_ok=True)

    for name in PAGES:
        # у страницы статьи адрес зависит от ?slug=, её canonical ставит скрипт
        html = read(name)
        if name != 'post.html':
            html = canonical(html, url, '' if name == 'index.html' else name)
        with open(os.path.join(OUT, name), 'w', encoding='utf-8') as fh:
            fh.write(html)

    for name in FILES:
        shutil.copy2(os.path.join(ROOT, name), os.path.join(OUT, name))
    for name in DIRS:
        shutil.copytree(os.path.join(ROOT, name), os.path.join(OUT, name))

    with open(os.path.join(OUT, 'robots.txt'), 'w', encoding='utf-8') as fh:
        fh.write(
            'User-agent: *\n'
            'Allow: /\n'
            '\n'
            '# служебное в поиске не нужно\n'
            'Disallow: /lead.php\n'
            'Disallow: /secrets.example.php\n'
            '\n'
            f'Sitemap: {url}/sitemap.xml\n'
        )

    today = date.today().isoformat()
    rows = [(f'{url}/{path}' if path else f'{url}/', today, freq, pri)
            for path, freq, pri in MAP]
    rows += [(f'{url}/post.html?slug={slug}', d, 'yearly', '0.6') for slug, d in posts()]

    body = '\n'.join(
        f'  <url>\n    <loc>{loc}</loc>\n    <lastmod>{mod}</lastmod>\n'
        f'    <changefreq>{freq}</changefreq>\n    <priority>{pri}</priority>\n  </url>'
        for loc, mod, freq, pri in rows)
    with open(os.path.join(OUT, 'sitemap.xml'), 'w', encoding='utf-8') as fh:
        fh.write('<?xml version="1.0" encoding="UTF-8"?>\n'
                 '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
                 f'{body}\n</urlset>\n')

    total = sum(os.path.getsize(os.path.join(r, f))
                for r, _, fs in os.walk(OUT) for f in fs)
    print(f'dist/site — готово к заливке: {len(rows)} адресов в карте сайта, '
          f'{total / 1024 / 1024:.1f} МБ')
    print(f'адрес сайта: {url}  (меняется в content/config.js → siteUrl)')


if __name__ == '__main__':
    build()
