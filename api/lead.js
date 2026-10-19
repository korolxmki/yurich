/* Отправка заявки в Telegram.
 *
 * Зачем эта прослойка. Сайт статический, и соблазн был послать POST в
 * api.telegram.org прямо из формы. Так делать нельзя: браузер не умеет хранить
 * секреты, и токен бота оказался бы в исходнике страницы. По такому токену
 * кто угодно читает и шлёт сообщения от имени бота, то есть мусор полетел бы
 * прямо в рабочую группу. Поэтому токен живёт в переменных окружения Vercel,
 * а наружу торчит только этот адрес.
 *
 * Переменные окружения (Vercel → Settings → Environment Variables):
 *   TELEGRAM_BOT_TOKEN — токен от @BotFather
 *   TELEGRAM_CHAT_ID   — куда слать (для группы число отрицательное)
 */
const API = 'https://api.telegram.org/bot';

// Поля приходят из открытой формы, то есть это чужой ввод: режем по длине,
// схлопываем пробелы и экранируем — иначе в сообщение можно подмешать разметку.
const clean = (v, max) => String(v == null ? '' : v).replace(/\s+/g, ' ').trim().slice(0, max);
const esc = s => s.replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ ok: false, error: 'method' });
  }

  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) {
    console.error('Не заданы TELEGRAM_BOT_TOKEN или TELEGRAM_CHAT_ID');
    return res.status(500).json({ ok: false, error: 'not-configured' });
  }

  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch { body = {}; } }
  body = body || {};

  // Ловушка для ботов: поле спрятано от людей, и заполнить его может только
  // автомат. Отвечаем «принято», чтобы он не искал обход.
  if (clean(body.company, 60)) return res.status(200).json({ ok: true });

  const name = clean(body.name, 80);
  const phone = clean(body.phone, 40);
  const estimate = clean(body.estimate, 140);
  const comment = clean(body.comment, 600);

  if (name.length < 2) return res.status(400).json({ ok: false, error: 'name' });
  if (phone.replace(/\D/g, '').length < 10) return res.status(400).json({ ok: false, error: 'phone' });
  if (body.consent !== true) return res.status(400).json({ ok: false, error: 'consent' });

  const text = [
    '<b>Заявка с сайта</b>',
    `Имя: ${esc(name)}`,
    `Телефон: ${esc(phone)}`,
    estimate ? `Расчёт: ${esc(estimate)}` : '',
    comment ? `Сообщение: ${esc(comment)}` : '',
  ].filter(Boolean).join('\n');

  try {
    const r = await fetch(`${API}${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML', disable_web_page_preview: true }),
    });
    const data = await r.json().catch(() => ({}));
    if (!r.ok || !data.ok) {
      // описание ошибки пишем в лог, наружу не отдаём: в нём бывает лишнее
      console.error('Telegram отказал:', data.description || r.status);
      return res.status(502).json({ ok: false, error: 'telegram' });
    }
    return res.status(200).json({ ok: true });
  } catch (e) {
    console.error('Заявку отправить не удалось:', e && e.message);
    return res.status(502).json({ ok: false, error: 'network' });
  }
};
