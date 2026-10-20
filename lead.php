<?php
/**
 * Отправка заявки в Telegram с обычного хостинга (Hostiman и подобные).
 *
 * Зачем это нужно. Форма не может стучаться в api.telegram.org напрямую:
 * браузер не умеет хранить секреты, и токен бота оказался бы в исходнике
 * страницы. По такому токену кто угодно шлёт сообщения от имени бота — мусор
 * полетел бы прямо в рабочую группу. Поэтому токен лежит в secrets.php рядом,
 * а наружу торчит только этот адрес.
 *
 * Куда вписать токен: скопируйте secrets.example.php в secrets.php и
 * заполните. Файл с расширением .php сервер выполняет, а не отдаёт текстом,
 * поэтому прочитать его из браузера нельзя. В репозиторий он не коммитится.
 */
declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');

function out(int $code, array $body): never {
    http_response_code($code);
    echo json_encode($body, JSON_UNESCAPED_UNICODE);
    exit;
}

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
    header('Allow: POST');
    out(405, ['ok' => false, 'error' => 'method']);
}

$cfg = is_file(__DIR__ . '/secrets.php') ? require __DIR__ . '/secrets.php' : [];
$token = (string)($cfg['token'] ?? '');
$chat  = (string)($cfg['chat_id'] ?? '');
if ($token === '') { $token = (string)(getenv('TELEGRAM_BOT_TOKEN') ?: ''); }
if ($chat === '')  { $chat  = (string)(getenv('TELEGRAM_CHAT_ID') ?: ''); }
if ($token === '' || $chat === '') {
    error_log('lead.php: не заданы token или chat_id');
    out(500, ['ok' => false, 'error' => 'not-configured']);
}

$raw = file_get_contents('php://input');
$d = json_decode(is_string($raw) ? $raw : '', true);
if (!is_array($d)) { $d = $_POST; }

// Поля приходят из открытой формы, то есть это чужой ввод: режем по длине,
// схлопываем пробелы и экранируем — иначе в сообщение подмешают разметку.
$clean = static function (mixed $v, int $max): string {
    $s = is_scalar($v) ? (string)$v : '';
    $s = (string)preg_replace('/\s+/u', ' ', $s);
    return mb_substr(trim($s), 0, $max);
};
$esc = static fn(string $s): string => htmlspecialchars($s, ENT_NOQUOTES | ENT_SUBSTITUTE, 'UTF-8');

// Ловушка для ботов: поле спрятано от людей, заполнить его может только
// автомат. Отвечаем «принято», чтобы он не искал обход.
if ($clean($d['company'] ?? '', 60) !== '') { out(200, ['ok' => true]); }

$name     = $clean($d['name'] ?? '', 80);
$phone    = $clean($d['phone'] ?? '', 40);
$estimate = $clean($d['estimate'] ?? '', 140);
$comment  = $clean($d['comment'] ?? '', 600);
$consent  = ($d['consent'] ?? false) === true || ($d['consent'] ?? '') === 'true';

if (mb_strlen($name) < 2) { out(400, ['ok' => false, 'error' => 'name']); }
if (strlen((string)preg_replace('/\D/', '', $phone)) < 10) { out(400, ['ok' => false, 'error' => 'phone']); }
if (!$consent) { out(400, ['ok' => false, 'error' => 'consent']); }

$lines = ['<b>Заявка с сайта</b>', 'Имя: ' . $esc($name), 'Телефон: ' . $esc($phone)];
if ($estimate !== '') { $lines[] = 'Расчёт: ' . $esc($estimate); }
if ($comment !== '')  { $lines[] = 'Сообщение: ' . $esc($comment); }

$payload = json_encode([
    'chat_id' => $chat,
    'text' => implode("\n", $lines),
    'parse_mode' => 'HTML',
    'disable_web_page_preview' => true,
], JSON_UNESCAPED_UNICODE);

// адрес API можно подменить переменной окружения — нужно для проверки,
// чтобы не слать тестовые заявки в рабочую группу
$base = (string)(getenv('TELEGRAM_API') ?: 'https://api.telegram.org');
$url = $base . '/bot' . $token . '/sendMessage';

$res = false;
if (function_exists('curl_init')) {
    $ch = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_POST => true,
        CURLOPT_POSTFIELDS => $payload,
        CURLOPT_HTTPHEADER => ['Content-Type: application/json'],
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT => 12,
    ]);
    $res = curl_exec($ch);
    if ($res === false) { error_log('lead.php: curl: ' . curl_error($ch)); }
    curl_close($ch);
} else {
    // на части хостингов cURL выключен — уходим через потоковый контекст
    $ctx = stream_context_create(['http' => [
        'method' => 'POST',
        'header' => "Content-Type: application/json\r\n",
        'content' => $payload,
        'timeout' => 12,
        'ignore_errors' => true,
    ]]);
    $res = @file_get_contents($url, false, $ctx);
}

$answer = is_string($res) ? json_decode($res, true) : null;
if (!is_array($answer) || ($answer['ok'] ?? false) !== true) {
    // подробности пишем в лог, наружу не отдаём: в них бывает лишнее
    error_log('lead.php: Telegram отказал: ' . mb_substr((string)$res, 0, 300));
    out(502, ['ok' => false, 'error' => 'telegram']);
}

out(200, ['ok' => true]);
