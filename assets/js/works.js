/* Каталог работ: фильтры, подгрузка по частям, лайтбокс */
(function () {
  "use strict";

  var BATCH = 60;
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
  var moreBtn = document.getElementById("more");
  var moreWrap = document.getElementById("more-wrap");

  var all = [];
  var shown = [];
  var offset = 0;
  var current = "all";

  /* ---------- загрузка данных ---------- */
  fetch("assets/data/gallery.json")
    .then(function (r) {
      if (!r.ok) throw new Error(r.status);
      return r.json();
    })
    .then(function (data) {
      all = data.slice().sort(function (a, b) {
        return a.date < b.date ? 1 : a.date > b.date ? -1 : 0;
      });
      buildFilters();
      applyFromHash();
    })
    .catch(function () {
      results.textContent = "Не удалось загрузить список работ. Обновите страницу.";
    });

  /* ---------- фильтры ---------- */
  function buildFilters() {
    var counts = { all: all.length };
    all.forEach(function (p) {
      counts[p.cat] = (counts[p.cat] || 0) + 1;
    });

    var order = ["all"].concat(Object.keys(CATS).filter(function (c) { return counts[c]; }));
    filters.innerHTML = "";
    order.forEach(function (key) {
      var btn = document.createElement("button");
      btn.className = "chip";
      btn.type = "button";
      btn.dataset.cat = key;
      btn.setAttribute("aria-pressed", "false");
      btn.innerHTML = (key === "all" ? "Все работы" : CATS[key]) +
        '<span>' + counts[key] + "</span>";
      btn.addEventListener("click", function () {
        location.hash = key === "all" ? "" : key;
        select(key);
      });
      filters.appendChild(btn);
    });
  }

  function applyFromHash() {
    var key = (location.hash || "").replace("#", "");
    select(CATS[key] ? key : "all");
  }

  function select(cat) {
    current = cat;
    Array.prototype.forEach.call(filters.children, function (btn) {
      btn.setAttribute("aria-pressed", String(btn.dataset.cat === cat));
    });
    shown = cat === "all" ? all : all.filter(function (p) { return p.cat === cat; });
    offset = 0;
    grid.innerHTML = "";
    render();
  }

  function render() {
    var slice = shown.slice(offset, offset + BATCH);
    var frag = document.createDocumentFragment();

    slice.forEach(function (p, i) {
      var idx = offset + i;
      var btn = document.createElement("button");
      btn.className = "tile";
      btn.type = "button";
      btn.dataset.index = idx;
      btn.setAttribute("aria-label", "Открыть фото: " + (CATS[p.cat] || p.cat));

      var img = document.createElement("img");
      img.src = p.thumb;
      img.loading = "lazy";
      img.decoding = "async";
      img.width = p.w;
      img.height = p.h;
      img.alt = (CATS[p.cat] || p.cat) + " на заказ, Челябинск — работа мастерской";
      btn.appendChild(img);
      frag.appendChild(btn);
    });

    grid.appendChild(frag);
    offset += slice.length;

    results.textContent = "Показано " + offset + " из " + shown.length +
      (current === "all" ? " работ" : " — " + CATS[current].toLowerCase());
    moreWrap.hidden = offset >= shown.length;
  }

  moreBtn.addEventListener("click", render);
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
    lbImg.alt = (CATS[p.cat] || p.cat) + " на заказ — фото работы";
    lbBar.textContent = (CATS[p.cat] || "") + " · " + (lbIndex + 1) + " из " + shown.length;

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
