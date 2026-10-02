#!/usr/bin/env python3
"""Собрать весь сайт в один файл dist/index.html.

Три страницы (главная, блог, статья) становятся тремя экранами с роутером по
хешу, а стили, шрифты, скрипты, данные и картинки уезжают внутрь файла.
Картинки по дороге пережимаются в WebP — иначе base64 раздувает файл вдвое.

    python3 tools/build_single.py
"""
import base64, io, json, os, re, shutil
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DIST = os.path.join(ROOT, 'dist')
WEBP_QUALITY = 76
MAX_SIDE = 1280      # внутри одного файла картинки крупнее не нужны


def read(path):
    with open(os.path.join(ROOT, path), encoding='utf-8') as fh:
        return fh.read()


def data_uri(raw, mime):
    return f'data:{mime};base64,' + base64.b64encode(raw).decode()


def as_webp(path):
    """Перекодировать картинку в WebP и вернуть data-URI."""
    im = Image.open(os.path.join(ROOT, path))
    if max(im.size) > MAX_SIDE:
        k = MAX_SIDE / max(im.size)
        im = im.resize((round(im.width * k), round(im.height * k)), Image.LANCZOS)
    buf = io.BytesIO()
    if im.mode in ('RGBA', 'LA', 'P'):
        im.convert('RGBA').save(buf, 'WEBP', quality=WEBP_QUALITY, method=6)
    else:
        im.convert('RGB').save(buf, 'WEBP', quality=WEBP_QUALITY, method=6)
    return data_uri(buf.getvalue(), 'image/webp')


def inner_main(html):
    """Содержимое <main> страницы."""
    return html[html.index('<main>') + len('<main>'): html.index('</main>')]


def build():
    index, blog, post = read('index.html'), read('blog.html'), read('post.html')
    collections = read('collections.html')

    # ——— стили: шрифты превращаем в data-URI прямо внутри @font-face ———
    fonts = read('assets/css/fonts.css')
    for name in sorted(os.listdir(os.path.join(ROOT, 'assets/fonts'))):
        with open(os.path.join(ROOT, 'assets/fonts', name), 'rb') as fh:
            fonts = fonts.replace(f"url('../fonts/{name}')",
                                  f"url({data_uri(fh.read(), 'font/woff2')})")
    css = fonts + '\n' + read('assets/css/style.css')

    # картинки, на которые ссылается сам CSS (фон первого экрана и т.п.),
    # тоже должны уехать внутрь файла — иначе в сборке они отвалятся
    for rel in sorted(set(re.findall(r"url\('\.\./img/([^']+)'\)", css))):
        css = css.replace(f"url('../img/{rel}')", f"url({as_webp('assets/img/' + rel)})")

    # ——— картинки ———
    assets, static = {}, {}
    for folder, files in (
        ('assets/img/works', None),
        ('assets/img/works/thumb', None),
    ):
        for name in sorted(os.listdir(os.path.join(ROOT, folder))):
            if name.endswith('.jpg'):
                assets[f'{folder}/{name}'] = as_webp(f'{folder}/{name}')
    for folder in ('assets/img/collections', 'assets/img/collections/thumb'):
        for name in sorted(os.listdir(os.path.join(ROOT, folder))):
            if name.endswith('.jpg'):
                assets[f'{folder}/{name}'] = as_webp(f'{folder}/{name}')
    for path in ('assets/img/yurich-cutout.png', 'assets/img/yurich-about.jpg'):
        static[path] = as_webp(path)
    with open(os.path.join(ROOT, 'assets/img/favicon.svg'), 'rb') as fh:
        static['assets/img/favicon.svg'] = data_uri(fh.read(), 'image/svg+xml')

    # ——— три экрана ———
    home = inner_main(index)
    blog_view = inner_main(blog)
    post_view = inner_main(post)
    coll_view = inner_main(collections)

    # id="collections" есть и на главной, и у секции-обёртки страницы коллекций
    coll_view = coll_view.replace('id="collections-all"', 'id="collections-all"')

    # id="video" есть и на главной, и в блоге — в одном документе это конфликт
    blog_view = blog_view.replace('id="video"', 'id="blog-video"')

    # шапка, подвал и оверлеи берём с главной
    header = index[index.index('<!-- ШАПКА -->'):index.index('<main>')]
    tail = index[index.index('<!-- ПОДВАЛ -->'):index.index('<script src="content/config.js">')]

    def fix_links(html):
        html = html.replace('href="./#', 'href="#')
        html = html.replace('href="blog.html#video"', 'href="#/blog"')
        html = html.replace('href="blog.html"', 'href="#/blog"')
        html = html.replace('href="collections.html"', 'href="#/collections"')
        html = html.replace('href="./"', 'href="#/"')
        return html

    header, tail = fix_links(header), fix_links(tail)
    home, blog_view, post_view, coll_view = map(fix_links, (home, blog_view, post_view, coll_view))

    # ——— скрипты ———
    scripts = '\n'.join(read(f'content/{n}.js') for n in ('config', 'collections', 'works', 'posts', 'videos'))
    scripts += '\nwindow.ASSETS = ' + json.dumps(assets) + ';\n'
    scripts += read('assets/js/post.js') + '\n' + read('assets/js/main.js')

    router = '''
/* ——— роутер: три экрана в одном файле ———
   #/blog и #/post/<slug> переключают экран, остальные хеши — якоря на главной. */
(() => {
  'use strict';
  const views = { home: document.getElementById('view-home'),
                  blog: document.getElementById('view-blog'),
                  post: document.getElementById('view-post'),
                  collections: document.getElementById('view-collections') };
  let current = null;

  function show(name) {
    if (current === name) return false;
    Object.entries(views).forEach(([k, el]) => { el.hidden = k !== name; });
    // подсветка меню живёт от секций главной: на других экранах гасим её,
    // при возврате ставим «Главная» — дальше её поправит наблюдатель за секциями
    document.querySelectorAll('.nav a').forEach(a => a.classList.remove('is-active'));
    if (name === 'home') document.querySelector('.nav a[href="#top"]')?.classList.add('is-active');
    current = name;
    return true;
  }

  function route() {
    const hash = location.hash || '#/';
    const postMatch = hash.match(/^#\\/post\\/(.+)$/);

    if (postMatch) {
      const switched = show('post');
      window.renderPost(decodeURIComponent(postMatch[1]));
      if (switched) scrollTo(0, 0);
      return;
    }
    if (hash.startsWith('#/blog')) {
      if (show('blog')) scrollTo(0, 0);
      return;
    }
    if (hash.startsWith('#/collections')) {
      if (show('collections')) scrollTo(0, 0);
      return;
    }

    const switched = show('home');
    const id = hash.replace(/^#\\/?/, '');
    const target = id && document.getElementById(id);
    if (target) target.scrollIntoView({ behavior: switched ? 'auto' : 'smooth', block: 'start' });
    else if (switched) scrollTo(0, 0);
  }

  addEventListener('hashchange', route);
  route();
})();
'''

    page = f'''<!doctype html>
<html lang="ru">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Юрич Мебель — кухни на заказ по вашим размерам</title>
<meta name="description" content="Проектируем и производим кухни на заказ: бесплатный замер и проект, собственное производство, гарантия 3 года. Портфолио работ, расчёт стоимости онлайн.">
<meta property="og:title" content="Юрич Мебель — создаём пространство жизни">
<meta property="og:description" content="Кухни на заказ по вашим размерам. Замер и проект бесплатно, гарантия 3 года.">
<meta property="og:type" content="website">
<link rel="icon" href="{static['assets/img/favicon.svg']}" type="image/svg+xml">
<style>
{css}
</style>
<noscript><style>.reveal,.stagger>*{{opacity:1!important;transform:none!important}}.hero__title span,.hero__sub,.hero__cta,.hero__facts,.hero__photo,.hero__blob,.hero__badge,.work img{{opacity:1!important;animation:none!important}}#view-blog,#view-post,#view-collections{{display:none}}</style></noscript>
</head>
<body>
{header}
<main>
  <div id="view-home">{home}</div>
  <div id="view-blog" hidden>{blog_view}</div>
  <div id="view-post" hidden>{post_view}</div>
  <div id="view-collections" hidden>{coll_view}</div>
</main>
{tail}
<script>
{scripts}
{router}
</script>
</body>
</html>
'''

    # статические картинки в разметке — простой заменой пути на data-URI
    for path, uri in static.items():
        page = page.replace(f'src="{path}"', f'src="{uri}"')
        page = page.replace(f'content="{path}"', f'content="{uri}"')

    os.makedirs(DIST, exist_ok=True)
    out = os.path.join(DIST, 'index.html')
    with open(out, 'w', encoding='utf-8') as fh:
        fh.write(page)

    left = re.findall(r'(?:src|href)="(assets/[^"]+)"', page)
    size = os.path.getsize(out) / 1024 / 1024
    print(f'dist/index.html — {size:.1f} МБ, картинок внутри {len(assets) + len(static)}')
    if left:
        print('ВНИМАНИЕ, остались внешние ссылки:', sorted(set(left)))
    return out


if __name__ == '__main__':
    build()
