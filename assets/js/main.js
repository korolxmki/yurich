/* ЮРИЧ МЕБЕЛЬ — интерактив лендинга */
(() => {
'use strict';

const $  = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const cfg    = window.SITE   || {};
const works  = window.WORKS  || [];
const collections = window.COLLECTIONS || [];
const posts  = window.POSTS  || [];
const videos = window.VIDEOS || [];

/* В однофайловой сборке картинки лежат в window.ASSETS как data-URI, а страницы
   блога живут по хешу. В обычной версии обе функции возвращают исходный путь. */
const asset = path => (window.ASSETS && window.ASSETS[path]) || path;
const postHref = slug => (window.ASSETS ? '#/post/' : 'post.html?slug=') + encodeURIComponent(slug);

const money = n => new Intl.NumberFormat('ru-RU').format(Math.round(n / 1000) * 1000) + ' ₽';
const ruDate = iso => new Date(iso).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));

/* ——— шапка ——— */
const header = $('.header');
if (header) {
  const onScroll = () => header.classList.toggle('is-stuck', window.scrollY > 12);
  addEventListener('scroll', onScroll, { passive: true });
  onScroll();
}

const burger = $('#burger'), nav = $('#nav');
if (burger && nav) {
  burger.addEventListener('click', () => {
    const open = burger.getAttribute('aria-expanded') === 'true';
    burger.setAttribute('aria-expanded', String(!open));
    nav.classList.toggle('is-open', !open);
  });
  nav.addEventListener('click', e => {
    if (e.target.tagName !== 'A') return;
    nav.classList.remove('is-open');
    burger.setAttribute('aria-expanded', 'false');
  });
}

/* ——— плавный переход по якорям ———
   CSS scroll-behavior работает не везде (например, когда страница отрисована
   внутри фрейма), поэтому ведём прокрутку сами — и с тем же поведением. */
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
document.addEventListener('click', e => {
  const a = e.target.closest('a[href^="#"]');
  if (!a || e.defaultPrevented || e.metaKey || e.ctrlKey || e.shiftKey) return;
  const id = a.getAttribute('href').slice(1);
  if (!id) return;
  const target = document.getElementById(id);
  // цель спрятана (в однофайловой сборке — на другом экране): не перехватываем,
  // пусть сменится хеш и роутер сам покажет нужный экран
  if (!target || target.closest('[hidden]')) return;
  e.preventDefault();
  // липкая шапка всегда «в зоне видимости», прокрутка к ней ничего не делает —
  // ссылка на неё означает «в самый верх страницы»
  const pinned = ['sticky', 'fixed'].includes(getComputedStyle(target).position);
  const behavior = reduceMotion ? 'auto' : 'smooth';
  if (pinned) scrollTo({ top: 0, behavior });
  else target.scrollIntoView({ behavior, block: 'start' });
  history.replaceState(null, '', '#' + id);
});

/* подсветка активного пункта меню */
const sections = $$('main section[id]');
const navLinks = new Map($$('#nav a[href^="#"]').map(a => [a.getAttribute('href').slice(1), a]));
if (sections.length && navLinks.size && 'IntersectionObserver' in window) {
  const spy = new IntersectionObserver(entries => {
    entries.forEach(en => {
      const link = navLinks.get(en.target.id);
      if (!link || !en.isIntersecting) return;
      navLinks.forEach(a => a.classList.remove('is-active'));
      link.classList.add('is-active');
    });
  }, { rootMargin: '-45% 0px -50% 0px' });
  sections.forEach(s => spy.observe(s));
}

/* ——— появление при скролле ——— */
const reveal = () => {
  // детям групп раздаём порядковый номер — из него CSS считает задержку
  $$('.stagger').forEach(g => [...g.children].forEach((el, i) => el.style.setProperty('--i', i)));

  // сторож в <head> ждёт этот флаг: он значит, что скрипт дошёл до анимаций
  window.__revealReady = true;

  const items = $$('.reveal:not(.is-in), .stagger:not(.is-in)');
  if (!('IntersectionObserver' in window)) return items.forEach(el => el.classList.add('is-in'));
  const io = new IntersectionObserver((entries, obs) => {
    entries.forEach(en => {
      if (!en.isIntersecting) return;
      en.target.classList.add('is-in');
      obs.unobserve(en.target);
    });
  }, { rootMargin: '0px 0px -8% 0px', threshold: .08 });
  items.forEach(el => io.observe(el));
};

/* ——— счётчики ———
   Цифру в подписи («8 лет», «400+», «30 дней») подкручиваем от нуля,
   текст вокруг неё сохраняем как есть. */
function countUp(el) {
  const raw = el.dataset.value ?? el.textContent;
  el.dataset.value = raw;
  // цифра, возможно с разрядами через пробел («1 000»), но без пробела перед словом
  const m = raw.match(/\d+(?:\s\d{3})*/);
  if (!m) return;
  const target = parseInt(m[0].replace(/\s/g, ''), 10);
  if (!target) return;
  const before = raw.slice(0, m.index), after = raw.slice(m.index + m[0].length);
  const started = performance.now(), dur = 1100;
  const tick = now => {
    const t = Math.min(1, (now - started) / dur);
    const eased = 1 - Math.pow(1 - t, 3);
    el.textContent = before + Math.round(target * eased).toLocaleString('ru-RU') + after;
    if (t < 1) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

function initCounters() {
  const nums = $$('.fact__num');
  if (!nums.length) return;
  if (reduceMotion || !('IntersectionObserver' in window)) return;
  const io = new IntersectionObserver((entries, obs) => {
    entries.forEach(en => {
      if (!en.isIntersecting) return;
      countUp(en.target);
      obs.unobserve(en.target);
    });
  }, { threshold: .6 });
  nums.forEach(n => io.observe(n));
}

/* ——— лёгкий параллакс фото в первом экране ——— */
function initParallax() {
  const media = $('.hero__media');
  if (!media || reduceMotion) return;
  let ticking = false;
  const apply = () => {
    const y = Math.min(scrollY, 900);
    media.style.transform = `translate3d(0, ${(y * -0.06).toFixed(1)}px, 0)`;
    ticking = false;
  };
  addEventListener('scroll', () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(apply);
  }, { passive: true });
  apply();
}

/* ——— картинки работ проявляются по мере загрузки ——— */
function fadeInImages(root = document) {
  $$('.work img', root).forEach(img => {
    if (img.complete && img.naturalWidth) return img.classList.add('is-loaded');
    img.addEventListener('load', () => img.classList.add('is-loaded'), { once: true });
    img.addEventListener('error', () => img.classList.add('is-loaded'), { once: true });
  });
}

/* ——— портфолио ——— */
const gallery = $('#gallery');
let galleryItems = works;   // что сейчас в сетке работ
let shown = works;          // что листает лайтбокс: работы или фото коллекции

function renderGallery(filter) {
  if (!gallery) return;
  galleryItems = works.filter(w => w.category === filter);
  shown = galleryItems;
  gallery.innerHTML = galleryItems.map((w, i) => `
    <figure class="work" data-index="${i}" style="animation-delay:${Math.min(i, 11) * 35}ms">
      <img src="${asset(`assets/img/works/thumb/${w.slug}.jpg`)}" alt="${esc(w.caption)}" loading="lazy" decoding="async">
      <figcaption>${esc(w.caption)}</figcaption>
    </figure>`).join('');
  fadeInImages(gallery);
}

$('#filters')?.addEventListener('click', e => {
  const btn = e.target.closest('.filter');
  if (!btn) return;
  $$('.filter').forEach(b => b.classList.toggle('is-active', b === btn));
  renderGallery(btn.dataset.filter);
});

gallery?.addEventListener('click', e => {
  const fig = e.target.closest('.work');
  if (!fig) return;
  shown = galleryItems;      // вернуть лайтбоксу список работ после коллекции
  openLightbox(Number(fig.dataset.index));
});

/* ——— коллекции ———
   Карточка открывает лайтбокс с фотографиями своей линейки. */
function renderCollections(root) {
  if (!root || !collections.length) return;
  root.innerHTML = collections.map(c => `
    <button class="collection" type="button" data-collection="${esc(c.slug)}">
      <div class="collection__img">
        <img src="${asset(`assets/img/collections/thumb/${c.cover}.jpg`)}" alt="${esc(c.name)}" loading="lazy" decoding="async">
        <span class="collection__count">${c.photos.length} фото</span>
      </div>
      <div class="collection__body">
        <p class="collection__material">${esc(c.material)}</p>
        <h3>${esc(c.name)}</h3>
        <p class="collection__tagline">${esc(c.tagline)}</p>
        <div class="collection__price"><span>от</span><b>${money(c.priceFrom)}</b><span>за метр</span></div>
      </div>
    </button>`).join('');

  root.addEventListener('click', e => {
    const card = e.target.closest('[data-collection]');
    if (!card) return;
    const c = collections.find(x => x.slug === card.dataset.collection);
    if (!c) return;
    shown = c.photos.map(slug => ({
      src: asset(`assets/img/collections/${slug}.jpg`),
      caption: `${c.name} — ${c.material}`,
    }));
    openLightbox(0);
  });
}

/* ——— лайтбокс ——— */
const lb = $('#lightbox'), lbImg = $('#lbImg'), lbCap = $('#lbCap');
let lbIndex = 0;

function openLightbox(i) {
  if (!lb || !shown.length) return;
  lbIndex = (i + shown.length) % shown.length;
  const w = shown[lbIndex];
  lbImg.src = w.src || asset(`assets/img/works/${w.slug}.jpg`);
  lbImg.alt = w.caption;
  lbCap.textContent = w.caption;
  lb.classList.add('is-open');
  document.body.style.overflow = 'hidden';
}
function closeLightbox() {
  lb?.classList.remove('is-open');
  document.body.style.overflow = '';
}
$('#lbClose')?.addEventListener('click', closeLightbox);
$('#lbPrev') ?.addEventListener('click', () => openLightbox(lbIndex - 1));
$('#lbNext') ?.addEventListener('click', () => openLightbox(lbIndex + 1));
lb?.addEventListener('click', e => { if (e.target === lb) closeLightbox(); });
addEventListener('keydown', e => {
  if (!lb?.classList.contains('is-open')) return;
  if (e.key === 'Escape')     closeLightbox();
  if (e.key === 'ArrowLeft')  openLightbox(lbIndex - 1);
  if (e.key === 'ArrowRight') openLightbox(lbIndex + 1);
});

/* ——— видео ——— */
function videoCard(v) {
  // ролик бывает двух видов: свой файл (v.file) и чужой проигрыватель
  // (v.embed — YouTube, VK, Instagram). Вертикальные рилсы просим 9/16.
  const ratio = v.ratio || '16/9';
  const cover = v.cover ? `<img class="video__cover" src="${esc(asset(v.cover))}" alt="" loading="lazy">` : '';
  const title = v.title ? `<div class="video__title">${esc(v.title)}</div>` : '';

  // свой файл без обложки показываем сразу проигрывателем: браузер сам
  // возьмёт первый кадр, иначе на месте ролика чёрный прямоугольник
  if (v.file && !v.cover) {
    return `<div class="video" style="aspect-ratio:${esc(ratio)}">
      <video class="video__player" src="${esc(asset(v.file))}" controls playsinline
             preload="metadata"></video>${title}</div>`;
  }
  const src = v.file ? ` data-file="${esc(asset(v.file))}"` : ` data-embed="${esc(v.embed)}"`;
  return `<div class="video" style="aspect-ratio:${esc(ratio)}"${src}>
    ${cover}
    <button class="video__play" type="button" aria-label="Смотреть: ${esc(v.title || 'видео')}">
      <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M7 4.5v15l13-7.5-13-7.5Z"/></svg>
    </button>
    ${title}
  </div>`;
}
const emptyVideo = note => `<div class="video video--empty">
  <div class="video__note">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><rect x="2" y="5" width="14" height="14" rx="3"/><path d="m16 10 6-3v10l-6-3" stroke-linejoin="round"/></svg>
    ${note}
  </div></div>`;

function renderVideos(root, limit) {
  if (!root) return;
  const list = limit ? videos.slice(0, limit) : videos;

  // один ролик не растягиваем на всю ширину — ставим по центру и ограничиваем
  const one = list.length <= 1;
  root.classList.toggle('videos--one', one);
  if (one) {
    const vert = (list[0]?.ratio || '').startsWith('9');
    root.style.setProperty('--one-w', vert ? '400px' : '860px');
  } else {
    root.style.removeProperty('--one-w');
  }

  if (!list.length) {
    root.innerHTML = emptyVideo('Здесь появится ролик с производства — добавьте его в <b>content/videos.js</b>');
    return;
  }
  root.innerHTML = list.map(videoCard).join('');

  $$('.video__play', root).forEach(btn => btn.addEventListener('click', () => {
    const box = btn.closest('.video');
    box.innerHTML = box.dataset.file
      ? `<video class="video__player" src="${box.dataset.file}" controls playsinline autoplay></video>`
      : `<iframe src="${box.dataset.embed}${box.dataset.embed.includes('?') ? '&' : '?'}autoplay=1"
           title="Видео" allow="autoplay; encrypted-media; picture-in-picture" allowfullscreen loading="lazy"></iframe>`;
  }));
}

/* ——— блог ——— */
function postCard(p) {
  return `<a class="post-card" href="${postHref(p.slug)}">
    <div class="post-card__img"><img src="${esc(asset(p.cover))}" alt="" loading="lazy"></div>
    <div class="post-card__body">
      <div class="post-card__meta"><span class="tag">${esc(p.tag)}</span><span>${ruDate(p.date)}</span><span>${esc(p.read)}</span></div>
      <h3>${esc(p.title)}</h3>
      <p>${esc(p.excerpt)}</p>
      <span class="link-arrow" style="margin-top:6px">Читать
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M2 8h11M9 4l4 4-4 4" stroke-linecap="round" stroke-linejoin="round"/></svg>
      </span>
    </div></a>`;
}

const sorted = [...posts].sort((a, b) => b.date.localeCompare(a.date));
const postsRoot = $('#posts');
if (postsRoot) postsRoot.innerHTML = sorted.slice(0, 3).map(postCard).join('');
const allPostsRoot = $('#allPosts');
if (allPostsRoot) allPostsRoot.innerHTML = sorted.map(postCard).join('');
const footerPosts = $('#footerPosts');
if (footerPosts) footerPosts.innerHTML = sorted.slice(0, 4)
  .map(p => `<li><a href="${postHref(p.slug)}">${esc(p.title.split(':')[0])}</a></li>`).join('');

/* ——— калькулятор ——— */
/* Плавный переход суммы: от показанной сейчас к новой, а не скачком. */
let moneyFrame = 0;
function tweenMoney(el, to) {
  if (!el) return;
  const from = Number(el.dataset.value || 0);
  el.dataset.value = to;
  if (reduceMotion || !from) { el.textContent = money(to); return; }
  cancelAnimationFrame(moneyFrame);
  const started = performance.now(), dur = 420;
  const tick = now => {
    const t = Math.min(1, (now - started) / dur);
    const eased = 1 - Math.pow(1 - t, 3);
    el.textContent = money(from + (to - from) * eased);
    if (t < 1) moneyFrame = requestAnimationFrame(tick);
  };
  moneyFrame = requestAnimationFrame(tick);
}

const calcForm = $('#calcForm');
function calculate() {
  if (!calcForm) return;
  const length = parseFloat($('#length').value);
  const layout = parseFloat($('#layout').value);   // надбавка за форму гарнитура
  const facade = parseFloat($('#facade').value);   // цена метра под ключ
  const total  = length * layout * facade;

  $('#lengthOut').textContent = length.toFixed(1).replace('.', ',');
  tweenMoney($('#sumTotal'), total);
  const hidden = $('#leadEstimate');
  if (hidden) hidden.value = `${money(total)} · ${length.toFixed(1)} м · ` +
    `${$('#layout').selectedOptions[0].text.toLowerCase()} · ${$('#facade').selectedOptions[0].text}`;
}
calcForm?.addEventListener('input', calculate);
calculate();

/* ——— контакты из content/config.js ——— */
function applyConfig() {
  const set = (sel, fn) => $$(sel).forEach(fn);
  if (cfg.phoneRaw || cfg.phone) {
    set('[data-site="tel"]', a => { a.href = 'tel:' + (cfg.phoneRaw || '').replace(/[^\d+]/g, ''); a.textContent = cfg.phone; });
  }
  if (cfg.email)   set('[data-site="mail"]', a => { a.href = 'mailto:' + cfg.email; a.textContent = cfg.email; });
  if (cfg.address) set('[data-site="address"]', el => { el.textContent = cfg.address; });
  if (cfg.hours)   set('[data-site="hours"]', el => { el.textContent = cfg.hours; });

  const social = {
    whatsapp: cfg.whatsapp ? 'https://wa.me/' + cfg.whatsapp.replace(/\D/g, '') : '',
    telegram: cfg.telegram ? (/^https?:/.test(cfg.telegram) ? cfg.telegram : 'https://t.me/' + cfg.telegram.replace(/^@/, '')) : '',
    vk:       cfg.vk || '',
  };
  Object.entries(social).forEach(([key, url]) => {
    set(`[data-site="${key}"]`, a => {
      if (!url) return a.remove();          // не показываем кнопку без ссылки
      a.href = url; a.target = '_blank'; a.rel = 'noopener';
    });
  });
}
applyConfig();

/* ——— заявка ——— */
function leadText(name, phone) {
  const est = $('#leadEstimate')?.value;
  return [
    'Заявка с сайта «Юрич Мебель»',
    `Имя: ${name}`,
    `Телефон: ${phone}`,
    est ? `Расчёт: ${est}` : '',
  ].filter(Boolean).join('\n');
}

$('#leadForm')?.addEventListener('submit', async e => {
  e.preventDefault();
  const form = e.currentTarget;
  const status = $('#leadStatus');
  const name  = $('#leadName').value.trim();
  const phone = $('#leadPhone').value.trim();

  if (name.length < 2)                      return say(status, 'Укажите, как к вам обращаться.', true);
  if (phone.replace(/\D/g, '').length < 10) return say(status, 'Проверьте номер телефона.', true);

  const text = leadText(name, phone);
  const btn = form.querySelector('button[type=submit]');

  // Ни один канал не настроен — открываем WhatsApp с готовым текстом,
  // чтобы заявка всё равно дошла, а не исчезла в никуда.
  if (!cfg.bitrixWebhook && !cfg.formEndpoint) return viaWhatsApp(text, status);

  btn.disabled = true;
  say(status, 'Отправляем…');
  try {
    if (cfg.bitrixWebhook) await sendToBitrix(name, phone);
    else await sendToEndpoint(form);
    say(status, 'Заявка отправлена — перезвоним в течение рабочего дня.');
    form.reset();
    calculate();
  } catch (err) {
    // CRM не ответила — не теряем заявку, уводим в WhatsApp
    console.warn('Заявку не удалось отправить:', err);
    if (!viaWhatsApp(text, status)) {
      say(status, `Не удалось отправить. Позвоните нам: ${cfg.phone || ''}`, true);
    }
  } finally {
    btn.disabled = false;
  }
});

/* Лид в Битрикс24 через входящий вебхук: crm.lead.add */
async function sendToBitrix(name, phone) {
  const base = cfg.bitrixWebhook.replace(/\/+$/, '');
  const body = new URLSearchParams();
  body.set('fields[TITLE]', `Заявка с сайта — ${name}`);
  body.set('fields[NAME]', name);
  body.set('fields[PHONE][0][VALUE]', phone);
  body.set('fields[PHONE][0][VALUE_TYPE]', 'WORK');
  body.set('fields[SOURCE_ID]', cfg.bitrixSource || 'WEB');
  const est = $('#leadEstimate')?.value;
  if (est) body.set('fields[COMMENTS]', 'Расчёт на сайте: ' + est);

  const res = await fetch(base + '/crm.lead.add.json', { method: 'POST', body });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.error) throw new Error(data.error_description || data.error || res.status);
  return data.result;
}

async function sendToEndpoint(form) {
  const res = await fetch(cfg.formEndpoint, {
    method: 'POST',
    headers: { 'Accept': 'application/json' },
    body: new FormData(form),
  });
  if (!res.ok) throw new Error(res.status);
}

function viaWhatsApp(text, status) {
  if (!cfg.whatsapp) return false;
  open(`https://wa.me/${cfg.whatsapp.replace(/\D/g, '')}?text=${encodeURIComponent(text)}`, '_blank', 'noopener');
  say(status, 'Открыли WhatsApp с готовым сообщением — осталось нажать «Отправить».');
  return true;
}
function say(el, msg, isError) { el.style.color = isError ? '#C0392B' : ''; el.textContent = msg; }

/* ——— мелочи ——— */
const year = $('#year');
if (year) year.textContent = String(new Date().getFullYear());

// Запускаем по шагам и порознь: если один блок споткнётся на кривых данных,
// остальные всё равно отрисуются, а reveal() снимет невидимость с контента.
// Раньше одна ошибка здесь гасила всё, что ниже первого экрана.
// стартовая вкладка берётся из разметки — порядок фильтров меняется в HTML
[
  () => renderCollections($('#collections-grid')),
  () => renderCollections($('#collections-all')),
  () => renderGallery($('.filter.is-active')?.dataset.filter || works[0]?.category),
  () => renderVideos($('#videos'), 3),
  () => renderVideos($('#allVideos')),
  reveal,
  initCounters,
  initParallax,
].forEach(step => {
  try { step(); } catch (e) { console.error('Шаг инициализации упал:', e); }
});
})();
