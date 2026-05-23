<?php

declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode([
        'error' => 'Method Not Allowed',
        'message' => 'Use POST'
    ], JSON_UNESCAPED_UNICODE);
    exit;
}

$proxyToken = getenv('TRANSCRIPT_PROXY_TOKEN') ?: '';
if ($proxyToken !== '') {
    $authHeader = getAuthorizationHeader();
    if ($authHeader !== 'Bearer ' . $proxyToken) {
        http_response_code(401);
        echo json_encode([
            'error' => 'Unauthorized',
            'message' => 'Invalid Authorization token'
        ], JSON_UNESCAPED_UNICODE);
        exit;
    }
}

$rawBody = file_get_contents('php://input');
$input = json_decode($rawBody ?: '', true);
if (!is_array($input)) {
    http_response_code(400);
    echo json_encode([
        'error' => 'Bad Request',
        'message' => 'Invalid JSON body'
    ], JSON_UNESCAPED_UNICODE);
    exit;
}

$provider = trim((string)($input['provider'] ?? 'aliyun-fun-asr'));
$videoUrl = trim((string)($input['videoUrl'] ?? ''));
$videoId = trim((string)($input['videoId'] ?? ''));
$title = trim((string)($input['title'] ?? ''));
$source = trim((string)($input['source'] ?? 'douyin'));

if ($provider !== 'aliyun-fun-asr') {
    http_response_code(400);
    echo json_encode([
        'error' => 'Bad Request',
        'message' => 'Only provider aliyun-fun-asr is supported'
    ], JSON_UNESCAPED_UNICODE);
    exit;
}

if ($videoUrl === '') {
    http_response_code(400);
    echo json_encode([
        'error' => 'Bad Request',
        'message' => 'videoUrl is required'
    ], JSON_UNESCAPED_UNICODE);
    exit;
}

$dashscopeApiKey = getenv('DASHSCOPE_API_KEY') ?: '';
if ($dashscopeApiKey === '') {
    http_response_code(500);
    echo json_encode([
        'error' => 'Server Misconfigured',
        'message' => 'Missing DASHSCOPE_API_KEY'
    ], JSON_UNESCAPED_UNICODE);
    exit;
}

$pollIntervalMs = max(1000, (int)(getenv('ASR_POLL_INTERVAL_MS') ?: 3000));
$pollTimeoutMs = max(10000, (int)(getenv('ASR_POLL_TIMEOUT_MS') ?: 180000));

try {
    $submitPayload = [
        'model' => 'funasr',
        'input' => [
            'file_urls' => [$videoUrl]
        ],
        'parameters' => [
            'language_hints' => ['zh'],
            'enable_inverse_text_normalization' => true,
            'enable_punctuation_prediction' => true
        ]
    ];

    $submitResponse = httpJsonRequest(
        'POST',
        'https://dashscope.aliyuncs.com/api/v1/services/audio/asr/transcription',
        [
            'Authorization: Bearer ' . $dashscopeApiKey,
            'Content-Type: application/json',
            'X-DashScope-Async: enable'
        ],
        $submitPayload,
        60
    );

    $taskId = (string)pickField($submitResponse['body'], ['task_id', 'taskId', 'output.task_id', 'output.taskId']);
    if ($taskId === '') {
        throw new RuntimeException('Aliyun task_id not found in submit response');
    }

    $deadline = (int)(microtime(true) * 1000) + $pollTimeoutMs;
    $taskBody = [];

    while ((int)(microtime(true) * 1000) < $deadline) {
        usleep($pollIntervalMs * 1000);

        $taskResponse = httpJsonRequest(
            'GET',
            'https://dashscope.aliyuncs.com/api/v1/tasks/' . rawurlencode($taskId),
            [
                'Authorization: Bearer ' . $dashscopeApiKey
            ],
            null,
            60
        );

        $taskBody = $taskResponse['body'];
        $taskStatus = strtoupper((string)pickField($taskBody, ['output.task_status', 'output.taskStatus', 'task_status', 'taskStatus']));

        if ($taskStatus === 'SUCCEEDED') {
            break;
        }

        if ($taskStatus === 'FAILED' || $taskStatus === 'CANCELED') {
            $message = (string)pickField($taskBody, ['output.message', 'message', 'output.error_message', 'error_message', 'code']);
            throw new RuntimeException('Aliyun ASR task failed: ' . $message);
        }
    }

    $taskStatus = strtoupper((string)pickField($taskBody, ['output.task_status', 'output.taskStatus', 'task_status', 'taskStatus']));
    if ($taskStatus !== 'SUCCEEDED') {
        throw new RuntimeException('Aliyun ASR polling timeout');
    }

    $resultUrl = (string)pickField($taskBody, [
        'output.results.0.transcription_url',
        'output.results.0.transcriptionUrl',
        'results.0.transcription_url',
        'results.0.transcriptionUrl'
    ]);

    if ($resultUrl === '') {
        throw new RuntimeException('Aliyun transcription_url not found');
    }

    $resultResponse = httpJsonRequest(
        'GET',
        $resultUrl,
        [],
        null,
        60
    );

    $resultBody = $resultResponse['body'];
    $transcript = extractTranscriptText($resultBody);
    $segments = extractSegments($resultBody);
    $srt = buildSrtFromSegments($segments);

    echo json_encode([
        'provider' => 'aliyun-fun-asr',
        'source' => $source,
        'videoId' => $videoId,
        'title' => $title,
        'taskId' => $taskId,
        'videoUrl' => $videoUrl,
        'transcript' => $transcript,
        'srt' => $srt,
        'paragraphs' => array_map(static function (array $segment): array {
            return [
                'text' => $segment['text'],
                'beginMs' => $segment['beginMs'],
                'endMs' => $segment['endMs']
            ];
        }, $segments),
        'raw' => [
            'task' => $taskBody,
            'result' => $resultBody
        ]
    ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
} catch (Throwable $e) {
    http_response_code(500);
    echo json_encode([
        'error' => 'Transcript Failed',
        'message' => $e->getMessage()
    ], JSON_UNESCAPED_UNICODE);
}

function getAuthorizationHeader(): string
{
    $headers = [
        $_SERVER['HTTP_AUTHORIZATION'] ?? '',
        $_SERVER['Authorization'] ?? ''
    ];

    foreach ($headers as $header) {
        if (is_string($header) && $header !== '') {
            return trim($header);
        }
    }

    if (function_exists('getallheaders')) {
        $allHeaders = getallheaders();
        foreach ($allHeaders as $key => $value) {
            if (strtolower((string)$key) === 'authorization') {
                return trim((string)$value);
            }
        }
    }

    return '';
}

function httpJsonRequest(string $method, string $url, array $headers = [], ?array $payload = null, int $timeoutSeconds = 60): array
{
    $ch = curl_init();

    curl_setopt_array($ch, [
        CURLOPT_URL => $url,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_CUSTOMREQUEST => $method,
        CURLOPT_TIMEOUT => $timeoutSeconds,
        CURLOPT_CONNECTTIMEOUT => 20,
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
        $message = is_array($body) ? json_encode($body, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) : (string)$raw;
        throw new RuntimeException('HTTP ' . $statusCode . ' ' . $message);
    }

    return [
        'statusCode' => $statusCode,
        'body' => $body
    ];
}

function pickField($payload, array $paths)
{
    foreach ($paths as $path) {
        $value = readPath($payload, $path);
        if ($value !== null && $value !== '') {
            return $value;
        }
    }

    return '';
}

function readPath($payload, string $path)
{
    if (!is_array($payload)) {
        return null;
    }

    $current = $payload;
    foreach (explode('.', $path) as $part) {
        if (is_array($current) && array_key_exists($part, $current)) {
            $current = $current[$part];
            continue;
        }

        if (is_array($current) && ctype_digit($part) && array_key_exists((int)$part, $current)) {
            $current = $current[(int)$part];
            continue;
        }

        return null;
    }

    return $current;
}

function extractTranscriptText(array $payload): string
{
    $directKeys = ['transcript', 'text', 'full_text', 'fullText', 'content'];
    foreach ($directKeys as $key) {
        $value = pickField($payload, [$key]);
        if (is_string($value) && trim($value) !== '') {
            return trim($value);
        }
    }

    $segments = extractSegments($payload);
    if ($segments !== []) {
        return implode("\n", array_map(static function (array $segment): string {
            return $segment['text'];
        }, $segments));
    }

    $allStrings = collectStrings($payload);
    return trim(implode("\n", $allStrings));
}

function extractSegments(array $payload): array
{
    $candidates = [
        pickField($payload, ['transcripts']),
        pickField($payload, ['paragraphs']),
        pickField($payload, ['sentences']),
        pickField($payload, ['segments']),
        pickField($payload, ['result.sentences']),
        pickField($payload, ['result.segments'])
    ];

    foreach ($candidates as $candidate) {
        if (!is_array($candidate)) {
            continue;
        }

        $segments = [];
        foreach ($candidate as $item) {
            if (!is_array($item)) {
                continue;
            }

            $text = trim((string)pickField($item, ['text', 'content', 'sentence', 'transcript']));
            if ($text === '') {
                continue;
            }

            $beginMs = normalizeMs(pickField($item, ['begin_time', 'beginTime', 'start_time', 'startTime', 'begin_ms', 'start_ms']));
            $endMs = normalizeMs(pickField($item, ['end_time', 'endTime', 'stop_time', 'stopTime', 'end_ms', 'stop_ms']));

            $segments[] = [
                'text' => $text,
                'beginMs' => $beginMs,
                'endMs' => $endMs
            ];
        }

        if ($segments !== []) {
            return $segments;
        }
    }

    return [];
}

function normalizeMs($value): int
{
    if ($value === '' || $value === null) {
        return 0;
    }

    $number = (float)$value;
    if ($number <= 0) {
        return 0;
    }

    return (int)round($number);
}

function buildSrtFromSegments(array $segments): string
{
    if ($segments === []) {
        return '';
    }

    $lines = [];
    foreach ($segments as $index => $segment) {
        $lines[] = (string)($index + 1);
        $lines[] = formatSrtTime($segment['beginMs']) . ' --> ' . formatSrtTime($segment['endMs']);
        $lines[] = $segment['text'];
        $lines[] = '';
    }

    return trim(implode("\n", $lines));
}

function formatSrtTime(int $milliseconds): string
{
    $hours = (int)floor($milliseconds / 3600000);
    $milliseconds -= $hours * 3600000;
    $minutes = (int)floor($milliseconds / 60000);
    $milliseconds -= $minutes * 60000;
    $seconds = (int)floor($milliseconds / 1000);
    $milliseconds -= $seconds * 1000;

    return sprintf('%02d:%02d:%02d,%03d', $hours, $minutes, $seconds, $milliseconds);
}

function collectStrings($value): array
{
    if (is_string($value)) {
        $trimmed = trim($value);
        return $trimmed === '' ? [] : [$trimmed];
    }

    if (!is_array($value)) {
        return [];
    }

    $result = [];
    foreach ($value as $item) {
        $result = array_merge($result, collectStrings($item));
    }

    return $result;
}
