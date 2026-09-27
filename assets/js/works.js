/* Каталог работ: разделы, лайтбокс. В каждом разделе показываем последние LIMIT работ. */
(function () {
  "use strict";

  var LIMIT = 10; // максимум фотографий в одном разделе
  var CATS = {
    kuhni: "Кухни",
    "shkafy-kupe": "Шкафы-купе",
    gorki: "Горки и ТВ-зоны",
    stoly: "Столы",
    prihozhie: "Прихожие",
    detskie: "Детские",
    lenta: "Разное"
  };

  var grid = document.getElementById("grid");
  var filters = document.getElementById("filters");
  var results = document.getElementById("results");

  var byCat = {};   // категория -> последние LIMIT фото
  var shown = [];   // то, что сейчас в сетке
  var current = null;

  fetch("assets/data/gallery.json")
    .then(function (r) {
      if (!r.ok) throw new Error(r.status);
      return r.json();
    })
    .then(function (data) {
      data
        .slice()
        .sort(function (a, b) { return a.date < b.date ? 1 : a.date > b.date ? -1 : 0; })
        .forEach(function (p) {
          if (!CATS[p.cat]) return;
          var list = byCat[p.cat] || (byCat[p.cat] = []);
          if (list.length < LIMIT) list.push(p);
        });
      buildFilters();
      applyFromHash();
    })
    .catch(function () {
      results.textContent = "Не удалось загрузить работы. Обновите страницу.";
    });

  function cats() {
    return Object.keys(CATS).filter(function (c) { return byCat[c] && byCat[c].length; });
  }

  function buildFilters() {
    filters.innerHTML = "";
    cats().forEach(function (key) {
      var btn = document.createElement("button");
      btn.className = "chip";
      btn.type = "button";
      btn.dataset.cat = key;
      btn.setAttribute("aria-pressed", "false");
      btn.innerHTML = CATS[key] + "<span>" + byCat[key].length + "</span>";
      btn.addEventListener("click", function () {
        location.hash = key;
        select(key);
      });
      filters.appendChild(btn);
    });
  }

  function applyFromHash() {
    var key = (location.hash || "").replace("#", "");
    select(byCat[key] && byCat[key].length ? key : cats()[0]);
  }

  function select(cat) {
    if (!cat || cat === current) return;
    current = cat;
    Array.prototype.forEach.call(filters.children, function (btn) {
      btn.setAttribute("aria-pressed", String(btn.dataset.cat === cat));
    });
    shown = byCat[cat];
    results.textContent = CATS[cat] + " — " + shown.length + " " + plural(shown.length);
    render();
  }

  function plural(n) {
    var d10 = n % 10, d100 = n % 100;
    if (d10 === 1 && d100 !== 11) return "фотография";
    if (d10 >= 2 && d10 <= 4 && (d100 < 10 || d100 >= 20)) return "фотографии";
    return "фотографий";
  }

  function render() {
    grid.innerHTML = "";
    var frag = document.createDocumentFragment();

    shown.forEach(function (p, i) {
      var btn = document.createElement("button");
      btn.className = "tile";
      btn.type = "button";
      btn.dataset.index = i;
      btn.setAttribute("aria-label", "Открыть фото: " + CATS[p.cat]);

      var img = document.createElement("img");
      img.src = p.thumb;
      img.loading = i < 4 ? "eager" : "lazy";
      img.decoding = "async";
      img.width = p.w;
      img.height = p.h;
      img.alt = CATS[p.cat] + " на заказ, Челябинск — работа мастерской";

      btn.appendChild(img);
      frag.appendChild(btn);
      if (window.revealWatch) window.revealWatch(btn, i * 60);
    });

    grid.appendChild(frag);
  }

  window.addEventListener("hashchange", applyFromHash);

  /* ---------- лайтбокс ---------- */
  var lb = document.getElementById("lb");
  var lbImg = document.getElementById("lb-img");
  var lbBar = document.getElementById("lb-bar");
  var lbIndex = 0;

  grid.addEventListener("click", function (e) {
    var tile = e.target.closest(".tile");
    if (tile) open(Number(tile.dataset.index));
  });

  function open(i) {
    lbIndex = i;
    show();
    lb.classList.add("is-open");
    document.body.classList.add("no-scroll");
    lb.querySelector(".lb__btn--close").focus();
  }

  function close() {
    lb.classList.remove("is-open");
    document.body.classList.remove("no-scroll");
    lbImg.removeAttribute("src");
  }

  function step(delta) {
    if (!shown.length) return;
    lbIndex = (lbIndex + delta + shown.length) % shown.length;
    show();
  }

  function show() {
    var p = shown[lbIndex];
    if (!p) return;
    lbImg.src = p.src;
    lbImg.alt = CATS[p.cat] + " на заказ — фото работы";
    lbBar.textContent = CATS[p.cat] + " · " + (lbIndex + 1) + " из " + shown.length;

    [1, -1].forEach(function (d) { // предзагрузка соседних кадров
      var n = shown[(lbIndex + d + shown.length) % shown.length];
      if (n) new Image().src = n.src;
    });
  }

  lb.addEventListener("click", function (e) {
    var act = e.target.closest("[data-act]");
    if (act) {
      var a = act.dataset.act;
      if (a === "close") close();
      if (a === "prev") step(-1);
      if (a === "next") step(1);
      return;
    }
    if (e.target === lb) close();
  });

  document.addEventListener("keydown", function (e) {
    if (!lb.classList.contains("is-open")) return;
    if (e.key === "Escape") close();
    if (e.key === "ArrowLeft") step(-1);
    if (e.key === "ArrowRight") step(1);
  });

  var touchX = null;
  lb.addEventListener("touchstart", function (e) { touchX = e.changedTouches[0].clientX; }, { passive: true });
  lb.addEventListener("touchend", function (e) {
    if (touchX === null) return;
    var dx = e.changedTouches[0].clientX - touchX;
    if (Math.abs(dx) > 45) step(dx < 0 ? 1 : -1);
    touchX = null;
  }, { passive: true });
})();
