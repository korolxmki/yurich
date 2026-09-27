/* Общие скрипты: шапка при скролле, год в подвале, появление блоков */
(function () {
  "use strict";

  var root = document.documentElement;
  root.classList.add("js"); // без JS ничего не прячем

  var reduced = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---------- шапка ---------- */
  var header = document.querySelector(".header");
  if (header) {
    var onScroll = function () {
      header.classList.toggle("is-stuck", window.scrollY > 8);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
  }

  var year = document.getElementById("year");
  if (year) year.textContent = new Date().getFullYear();

  /* ---------- появление блоков ---------- */
  var STEP = 70;      // задержка между соседями в группе, мс
  var MAX_DELAY = 350;

  var observer = null;
  if (!reduced && "IntersectionObserver" in window) {
    observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        e.target.classList.add("is-in");
        observer.unobserve(e.target);
      });
    }, { rootMargin: "0px 0px -8% 0px", threshold: 0.08 });
  }

  function watch(el, delay) {
    if (!el) return;
    el.classList.add("reveal");
    if (delay) el.style.setProperty("--d", Math.min(delay, MAX_DELAY) + "ms");
    if (!observer) { el.classList.add("is-in"); return; }

    // то, что уже на экране или выше него, показываем сразу: наблюдатель
    // срабатывает только на пересечение и «прокрученные» блоки пропустил бы
    var top = el.getBoundingClientRect().top;
    if (top < window.innerHeight * 0.92) {
      requestAnimationFrame(function () { el.classList.add("is-in"); });
      return;
    }
    observer.observe(el);
  }

  // группы, внутри которых соседи появляются по очереди
  [
    ".section__head",
    ".cats > .cat",
    ".features > .feature",
    ".steps > .step",
    ".split > div",
    ".preview-grid > a",
    ".center",
    ".cta",
    ".page-head > *",
    ".filters",
    ".results"
  ].forEach(function (sel) {
    Array.prototype.forEach.call(document.querySelectorAll(sel), function (el, i) {
      watch(el, i * STEP);
    });
  });

  // works.js подключает сюда плитки каталога
  window.revealWatch = watch;
})();
