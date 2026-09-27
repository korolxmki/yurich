/* Общие скрипты: состояние шапки при скролле, год в подвале */
(function () {
  "use strict";

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
})();
