/* Страница статьи — рендер из content/posts.js по ?slug= */
(() => {
'use strict';
const $ = s => document.querySelector(s);
const posts = window.POSTS || [];
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
const ruDate = iso => new Date(iso).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });

const slug = new URLSearchParams(location.search).get('slug');
const post = posts.find(p => p.slug === slug);

if (!post) {
  $('#articleHead').innerHTML = '<h1 class="display">Статья не найдена</h1>';
  $('#articleBody').innerHTML = '<p>Возможно, ссылка устарела. Загляните в <a href="blog.html">список статей</a>.</p>';
} else {
  document.title = `${post.title} — Юрич Мебель`;
  document.querySelector('meta[name=description]')?.setAttribute('content', post.excerpt);
  document.querySelector('meta[property="og:title"]')?.setAttribute('content', post.title);
  document.querySelector('meta[property="og:description"]')?.setAttribute('content', post.excerpt);

  $('#crumb').textContent = post.title;
  $('#articleHead').innerHTML = `
    <div class="post-card__meta" style="margin-bottom:16px">
      <span class="tag">${esc(post.tag)}</span><span>${ruDate(post.date)}</span><span>${esc(post.read)}</span>
    </div>
    <h1 class="display" style="font-size:clamp(28px,4.4vw,48px);margin-bottom:18px">${esc(post.title)}</h1>
    <p class="lead" style="margin-bottom:34px">${esc(post.excerpt)}</p>`;

  if (post.cover) {
    $('#articleHero').hidden = false;
    $('#articleCover').src = post.cover;
    $('#articleCover').alt = post.title;
  }
  // body берётся из нашего же content-файла, посторонний HTML сюда не попадает
  $('#articleBody').innerHTML = post.body;

  const related = posts.filter(p => p.slug !== post.slug)
    .sort((a, b) => b.date.localeCompare(a.date)).slice(0, 3);
  $('#relatedPosts').innerHTML = related.map(p => `
    <a class="post-card" href="post.html?slug=${encodeURIComponent(p.slug)}">
      <div class="post-card__img"><img src="${esc(p.cover)}" alt="" loading="lazy"></div>
      <div class="post-card__body">
        <div class="post-card__meta"><span class="tag">${esc(p.tag)}</span><span>${ruDate(p.date)}</span></div>
        <h3>${esc(p.title)}</h3>
        <p>${esc(p.excerpt)}</p>
      </div></a>`).join('');
}
})();
