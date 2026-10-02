#!/usr/bin/env node
/* Проверка сайта браузером — то, что глазами не увидишь.
 *
 *   node tools/check.js            # поднимает сервер сам и проверяет сайт
 *   node tools/check.js http://…   # проверяет уже поднятый адрес
 *
 * Проверяем три вещи:
 *   1. нет боковой прокрутки ни на одной ширине от 280 до 1920;
 *   2. после прохода по странице не осталось непроявившихся блоков;
 *   3. если скрипт сайта не загрузился или упал — текст всё равно виден.
 * Третий пункт важнее всех: именно из-за него сайт однажды показывал
 * только первый экран, а дальше пустоту.
 */
const { chromium } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path');

const WIDTHS = [280, 320, 360, 390, 414, 480, 560, 620, 768, 820, 900, 960, 1024, 1100, 1180, 1280, 1440, 1600, 1920];
const PAGES = ['index.html', 'collections.html', 'blog.html', 'dist/odnim-failom.html'];
const ROOT = path.resolve(__dirname, '..');
const MIME = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json', '.svg': 'image/svg+xml', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.png': 'image/png', '.webp': 'image/webp', '.woff2': 'font/woff2', '.ico': 'image/x-icon', '.txt': 'text/plain; charset=utf-8' };

function serve() {
  return new Promise(res => {
    const s = http.createServer((rq, rs) => {
      const f = path.join(ROOT, decodeURIComponent(rq.url.split('?')[0]));
      fs.readFile(f, (e, d) => e ? (rs.statusCode = 404, rs.end('нет')) :
        (rs.setHeader('Content-Type', MIME[path.extname(f).toLowerCase()] || 'application/octet-stream'), rs.end(d)));
    });
    s.listen(0, '127.0.0.1', () => res([s, `http://127.0.0.1:${s.address().port}/`]));
  });
}

(async () => {
  let server = null, base = process.argv[2];
  if (!base) [server, base] = await serve();
  const b = await chromium.launch(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {});
  let bad = 0;
  const fail = (...a) => { bad++; console.log('  ✗', ...a); };

  for (const page of PAGES) {
    const ctx = await b.newContext({ viewport: { width: 1280, height: 900 } });
    const p = await ctx.newPage();
    const errs = [];
    p.on('pageerror', e => errs.push('ошибка JS: ' + e.message));
    p.on('console', m => { if (m.type() === 'error') errs.push('консоль: ' + m.text()); });
    p.on('response', r => { if (r.status() >= 400) errs.push(`${r.status()} ${r.url().split('/').pop()}`); });
    await p.goto(base + page, { waitUntil: 'load' });
    await p.waitForTimeout(900);

    const over = [];
    for (const w of WIDTHS) {
      await p.setViewportSize({ width: w, height: 900 });
      await p.waitForTimeout(130);
      const d = await p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      if (d > 1) over.push(`${w}px:+${d}`);
    }

    await p.setViewportSize({ width: 390, height: 844 });
    await p.waitForTimeout(300);
    const H = await p.evaluate(() => document.documentElement.scrollHeight);
    for (let y = 0; y < H; y += 500) { await p.evaluate(yy => scrollTo(0, yy), y); await p.waitForTimeout(240); }
    await p.waitForTimeout(2200);   // самые поздние задержки в группах
    const stuck = await p.evaluate(() => [...document.querySelectorAll('.reveal, .stagger > *')]
      .filter(el => el.getBoundingClientRect().height > 0 && parseFloat(getComputedStyle(el).opacity) < .9).length);

    const ok = !over.length && !stuck && !errs.length;
    console.log(`${ok ? '✓' : '✗'} ${page}`);
    if (over.length) fail('боковая прокрутка:', over.join(' '));
    if (stuck) fail('не проявилось блоков:', stuck);
    errs.slice(0, 6).forEach(e => fail(e));
    await ctx.close();
  }

  // текст виден, даже если скрипту плохо
  for (const [label, setup] of [
    ['скрипт не загрузился', p => p.route('**/main.js', r => r.abort())],
    ['скрипт упал с ошибкой', p => p.route('**/main.js', r => r.fulfill({ contentType: 'application/javascript', body: 'throw new Error("тест")' }))],
    ['JS выключен', null],
  ]) {
    const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, javaScriptEnabled: !!setup || label !== 'JS выключен' });
    const p = await ctx.newPage();
    if (setup) await setup(p);
    await p.goto(base + 'index.html', { waitUntil: 'load' }).catch(() => {});
    await p.waitForTimeout(3600);   // ждём сторож (2,5 с)
    const inv = await p.$$eval('.reveal, .stagger > *', els =>
      els.filter(e => e.getBoundingClientRect().height > 0 && parseFloat(getComputedStyle(e).opacity) < .9).length);
    const txt = (await p.innerText('body')).replace(/\s+/g, ' ');
    const ok = inv === 0 && txt.includes('Своё производство');
    console.log(`${ok ? '✓' : '✗'} запас прочности: ${label}`);
    if (!ok) fail(`скрыто блоков: ${inv}, текст на месте: ${txt.includes('Своё производство')}`);
    await ctx.close();
  }

  await b.close();
  if (server) server.close();
  console.log(bad ? `\nНАЙДЕНО ПРОБЛЕМ: ${bad}` : '\nВсё чисто.');
  process.exit(bad ? 1 : 0);
})();
