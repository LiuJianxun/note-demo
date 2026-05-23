<?php

declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');

const DEFAULT_SPEAKER_IDS = [
    'S_zoqmiYt22',
    'S_toqmiYt22',
    'S_yoqmiYt22',
    'S_xoqmiYt22',
    'S_woqmiYt22',
    'S_voqmiYt22',
    'S_uoqmiYt22',
];

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    respond(405, [
        'error' => 'Method Not Allowed',
        'message' => 'Use POST'
    ]);
}

$proxyToken = getenv('WECHAT_LOGIN_PROXY_TOKEN') ?: '';
if ($proxyToken !== '' && getAuthorizationHeader() !== 'Bearer ' . $proxyToken) {
    respond(401, [
        'error' => 'Unauthorized',
        'message' => 'Invalid Authorization token'
    ]);
}

$rawBody = file_get_contents('php://input');
$input = json_decode($rawBody ?: '', true);
if (!is_array($input)) {
    respond(400, [
        'error' => 'Bad Request',
        'message' => 'Invalid JSON body'
    ]);
}

$code = trim((string)($input['code'] ?? ''));
$assignSpeaker = filter_var($input['assignSpeaker'] ?? false, FILTER_VALIDATE_BOOLEAN);
$avatarUrl = trim((string)($input['avatarUrl'] ?? ''));
$nickName = trim((string)($input['nickName'] ?? ''));
$speakerIds = normalizeSpeakerIds($input['speakerIds'] ?? []);

if ($code === '') {
    respond(400, [
        'error' => 'Bad Request',
        'message' => 'code is required'
    ]);
}

$appId = trim((string)(getenv('WECHAT_APPID') ?: ''));
$appSecret = trim((string)(getenv('WECHAT_APPSECRET') ?: ''));
if ($appId === '' || $appSecret === '') {
    respond(500, [
        'error' => 'Server Misconfigured',
        'message' => 'Missing WECHAT_APPID or WECHAT_APPSECRET'
    ]);
}

try {
    $sessionData = wechatCode2Session($appId, $appSecret, $code);
    $openId = trim((string)($sessionData['openid'] ?? ''));

    if ($openId === '') {
        throw new RuntimeException('WeChat openid not found');
    }

    $dataFile = getenv('WECHAT_SPEAKER_DATA_FILE') ?: (__DIR__ . DIRECTORY_SEPARATOR . 'speaker-assignments.json');
    $assignment = loadOrAssignSpeaker($dataFile, $openId, $speakerIds, $assignSpeaker, $avatarUrl, $nickName);

    respond(200, [
        'openId' => $openId,
        'speakerId' => $assignment['speakerId'],
        'speakerIndex' => $assignment['speakerIndex'],
        'hasAssignment' => $assignment['hasAssignment'],
        'nickName' => $assignment['nickName'],
        'avatarUrl' => $assignment['avatarUrl']
    ]);
} catch (Throwable $e) {
    respond(500, [
        'error' => 'Wechat Speaker Failed',
        'message' => $e->getMessage()
    ]);
}

function respond(int $statusCode, array $payload): void
{
    http_response_code($statusCode);
    echo json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

function getAuthorizationHeader(): string
{
    $headers = [
        $_SERVER['HTTP_AUTHORIZATION'] ?? '',
        $_SERVER['Authorization'] ?? ''
    ];

    foreach ($headers as $header) {
        if (is_string($header) && trim($header) !== '') {
            return trim($header);
        }
    }

    if (function_exists('getallheaders')) {
        foreach ((array)getallheaders() as $key => $value) {
            if (strtolower((string)$key) === 'authorization') {
                return trim((string)$value);
            }
        }
    }

    return '';
}

function normalizeSpeakerIds($speakerIds): array
{
    if (!is_array($speakerIds)) {
        return DEFAULT_SPEAKER_IDS;
    }

    $normalized = array_values(array_filter(array_map(static function ($item): string {
        return trim((string)$item);
    }, $speakerIds)));

    return $normalized !== [] ? $normalized : DEFAULT_SPEAKER_IDS;
}

function wechatCode2Session(string $appId, string $appSecret, string $code): array
{
    $url = 'https://api.weixin.qq.com/sns/jscode2session?appid=' . rawurlencode($appId)
        . '&secret=' . rawurlencode($appSecret)
        . '&js_code=' . rawurlencode($code)
        . '&grant_type=authorization_code';

    $response = httpJsonRequest('GET', $url, [], null, 20);
    $body = $response['body'];
    $errCode = isset($body['errcode']) ? (int)$body['errcode'] : 0;

    if ($errCode !== 0) {
        $message = trim((string)($body['errmsg'] ?? 'Unknown WeChat error'));
        throw new RuntimeException('WeChat code2Session failed: ' . $errCode . ' ' . $message);
    }

    return $body;
}

function loadOrAssignSpeaker(string $dataFile, string $openId, array $speakerIds, bool $assignSpeaker, string $avatarUrl, string $nickName): array
{
    ensureParentDirectory(dirname($dataFile));

    $handle = fopen($dataFile, 'c+');
    if ($handle === false) {
        throw new RuntimeException('Unable to open speaker assignment store');
    }

    try {
        if (!flock($handle, LOCK_EX)) {
            throw new RuntimeException('Unable to lock speaker assignment store');
        }

        $raw = stream_get_contents($handle);
        $store = json_decode($raw ?: '', true);
        if (!is_array($store)) {
            $store = [
                'counter' => 0,
                'assignments' => []
            ];
        }

        if (!isset($store['assignments']) || !is_array($store['assignments'])) {
            $store['assignments'] = [];
        }

        $assignments = $store['assignments'];
        $existing = isset($assignments[$openId]) && is_array($assignments[$openId]) ? $assignments[$openId] : null;

        if ($existing) {
            $speakerIndex = normalizeSpeakerIndex($existing['speakerIndex'] ?? -1, $existing['speakerId'] ?? '', $speakerIds);
            $speakerId = $speakerIds[$speakerIndex % count($speakerIds)];

            $existing['speakerIndex'] = $speakerIndex;
            $existing['speakerId'] = $speakerId;
            $existing['lastLoginAt'] = date('c');
            if ($avatarUrl !== '') {
                $existing['avatarUrl'] = $avatarUrl;
            }
            if ($nickName !== '') {
                $existing['nickName'] = $nickName;
            }

            $assignments[$openId] = $existing;
            $store['assignments'] = $assignments;
            persistStore($handle, $store);

            return [
                'speakerId' => $speakerId,
                'speakerIndex' => $speakerIndex,
                'hasAssignment' => true,
                'nickName' => (string)($existing['nickName'] ?? ''),
                'avatarUrl' => (string)($existing['avatarUrl'] ?? '')
            ];
        }

        if (!$assignSpeaker) {
            return [
                'speakerId' => '',
                'speakerIndex' => -1,
                'hasAssignment' => false,
                'nickName' => '',
                'avatarUrl' => ''
            ];
        }

        $counter = isset($store['counter']) ? (int)$store['counter'] : count($assignments);
        $speakerIndex = $counter % count($speakerIds);
        $speakerId = $speakerIds[$speakerIndex];
        $now = date('c');

        $assignments[$openId] = [
            'openId' => $openId,
            'speakerId' => $speakerId,
            'speakerIndex' => $speakerIndex,
            'avatarUrl' => $avatarUrl,
            'nickName' => $nickName,
            'assignedAt' => $now,
            'lastLoginAt' => $now
        ];
        $store['assignments'] = $assignments;
        $store['counter'] = $counter + 1;

        persistStore($handle, $store);

        return [
            'speakerId' => $speakerId,
            'speakerIndex' => $speakerIndex,
            'hasAssignment' => true,
            'nickName' => $nickName,
            'avatarUrl' => $avatarUrl
        ];
    } finally {
        flock($handle, LOCK_UN);
        fclose($handle);
    }
}

function normalizeSpeakerIndex($speakerIndex, $speakerId, array $speakerIds): int
{
    if (is_numeric($speakerIndex)) {
        $index = (int)$speakerIndex;
        if ($index >= 0) {
            return $index % count($speakerIds);
        }
    }

    $matchedIndex = array_search((string)$speakerId, $speakerIds, true);
    if ($matchedIndex !== false) {
        return (int)$matchedIndex;
    }

    return 0;
}

function persistStore($handle, array $store): void
{
    rewind($handle);
    ftruncate($handle, 0);
    fwrite($handle, json_encode($store, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_PRETTY_PRINT));
    fflush($handle);
}

function ensureParentDirectory(string $directory): void
{
    if (is_dir($directory)) {
        return;
    }

    if (!mkdir($directory, 0777, true) && !is_dir($directory)) {
        throw new RuntimeException('Unable to create speaker assignment directory');
    }
}

function httpJsonRequest(string $method, string $url, array $headers = [], ?array $payload = null, int $timeoutSeconds = 30): array
{
    $ch = curl_init();

    curl_setopt_array($ch, [
        CURLOPT_URL => $url,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_CUSTOMREQUEST => $method,
        CURLOPT_TIMEOUT => $timeoutSeconds,
        CURLOPT_CONNECTTIMEOUT => 10,
        CURLOPT_HTTPHEADER => $headers
    ]);

    if ($payload !== null) {
        curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES));
    }

    $raw = curl_exec($ch);
    if ($raw === false) {
        $error = curl_error($ch);
        curl_close($ch);
        throw new RuntimeException('cURL request failed: ' . $error);
    }

    $statusCode = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    $body = json_decode($raw, true);
    if (!is_array($body)) {
        $body = ['raw' => $raw];
    }

    if ($statusCode < 200 || $statusCode >= 300) {
        throw new RuntimeException('HTTP ' . $statusCode . ' ' . json_encode($body, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES));
    }

    return [
        'statusCode' => $statusCode,
        'body' => $body
    ];
}
