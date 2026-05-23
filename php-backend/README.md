# PHP Transcript Proxy

这个目录是给小程序 `AI 爆款链接提取文案` 功能配套的 PHP 转写代理。

作用：
- 接收小程序传来的抖音视频直链 `videoUrl`
- 调用阿里云百炼 `Fun-ASR` 异步转写
- 轮询任务完成
- 返回真实口播全文和可选 SRT 字幕

## 目录

- [transcript.php](/d:/wechat-mini-program/note-demo/php-backend/transcript.php)
- [wechat-speaker.php](/d:/wechat-mini-program/note-demo/php-backend/wechat-speaker.php)

## 微信号固定绑定音色

如果你要让“不同微信号”固定绑定到不同的 `doubaoSpeakerId`，不能只靠小程序本地缓存，必须走服务端。

原因：
- 小程序前端拿不到真正稳定的微信账号唯一标识，只能先 `wx.login`
- 需要服务端用 `code2Session` 换 `openid`
- 音色分配也必须保存在服务端，才能做到“第 1 个微信号 -> 第 1 个音色，第 2 个微信号 -> 第 2 个音色”这种全局顺序绑定

### 新增接口

接口文件：
- [wechat-speaker.php](/d:/wechat-mini-program/note-demo/php-backend/wechat-speaker.php)

环境变量：
```bash
WECHAT_APPID=你的小程序AppID
WECHAT_APPSECRET=你的小程序AppSecret
WECHAT_LOGIN_PROXY_TOKEN=你自定义的接口访问令牌
WECHAT_SPEAKER_DATA_FILE=/绝对路径/speaker-assignments.json
```

前端 [app.js](/d:/wechat-mini-program/note-demo/app.js) 里需要补配置：
```js
speakerAssignmentApi: 'https://你的域名/php-backend/wechat-speaker.php',
speakerAssignmentToken: '你自定义的接口访问令牌',
```

### 请求格式

前端 POST JSON：
```json
{
  "code": "wx.login 返回的 code",
  "assignSpeaker": true,
  "avatarUrl": "用户头像",
  "nickName": "用户昵称",
  "speakerIds": [
    "S_zoqmiYt22",
    "S_toqmiYt22",
    "S_yoqmiYt22",
    "S_xoqmiYt22",
    "S_woqmiYt22",
    "S_voqmiYt22",
    "S_uoqmiYt22"
  ]
}
```

返回示例：
```json
{
  "openId": "oxxxxxxxxxxxx",
  "speakerId": "S_toqmiYt22",
  "speakerIndex": 1,
  "hasAssignment": true
}
```

## 推荐第三方接口

推荐使用阿里云百炼 `Fun-ASR` 录音文件识别 RESTful API。

官方文档：
- https://help.aliyun.com/zh/model-studio/funauidio-asr-recorded-speech-recognition-restful-api
- https://help.aliyun.com/zh/model-studio/recording-file-recognition/

原因：
- 官方 REST API，适合 PHP 服务端直接接
- 支持异步任务，适合较长音视频
- 支持 URL 文件输入
- 中文转写能力成熟

## 环境变量

部署前先配置：

```bash
DASHSCOPE_API_KEY=你的阿里云百炼API_KEY
TRANSCRIPT_PROXY_TOKEN=你自定义的代理访问令牌
ASR_POLL_INTERVAL_MS=3000
ASR_POLL_TIMEOUT_MS=180000
```

说明：
- `DASHSCOPE_API_KEY` 必填
- `TRANSCRIPT_PROXY_TOKEN` 可选，但强烈建议配置
- 小程序前端会把 `transcriptProxyToken` 放到 `Authorization: Bearer xxx`

## 小程序前端配置

修改 [app.js](/d:/wechat-mini-program/note-demo/app.js:33)：

```js
transcriptProxyApi: 'https://你的域名/php-backend/transcript.php',
transcriptProxyToken: '你自定义的代理访问令牌',
transcriptProvider: 'aliyun-fun-asr',
```

同时把你的 PHP 域名加入微信小程序 `request 合法域名`。

## 请求格式

前端 POST JSON：

```json
{
  "provider": "aliyun-fun-asr",
  "videoUrl": "https://example.com/video.mp4",
  "videoId": "1234567890",
  "shareUrl": "https://v.douyin.com/xxxx/",
  "title": "视频标题",
  "source": "douyin"
}
```

## 返回格式

示例：

```json
{
  "provider": "aliyun-fun-asr",
  "source": "douyin",
  "videoId": "1234567890",
  "title": "视频标题",
  "taskId": "task-xxx",
  "videoUrl": "https://example.com/video.mp4",
  "transcript": "完整口播全文",
  "srt": "1\n00:00:00,000 --> 00:00:02,000\n第一句字幕",
  "paragraphs": [
    {
      "text": "第一句字幕",
      "beginMs": 0,
      "endMs": 2000
    }
  ]
}
```

## 部署建议

直接把抖音播放链接交给阿里云转写，在很多场景下可以工作，但不一定稳定。

更稳妥的生产方案：
1. 服务端先下载抖音视频
2. 上传到你自己的 OSS / COS / CDN
3. 再把稳定的公开 URL 交给阿里云 ASR

原因：
- 抖音播放地址可能有时效
- 可能有防盗链
- 直链失效会导致转写任务失败

## 本地测试

如果本机有 PHP：

```bash
php -S 0.0.0.0:8080 -t php-backend
```

然后把前端地址配置成：

```js
transcriptProxyApi: 'http://127.0.0.1:8080/transcript.php'
```

注意：
- 微信开发者工具里本地调试可临时关闭域名校验
- 真机必须走 HTTPS

## 当前限制

这个代理目前只实现了 `aliyun-fun-asr`。

如果你后面要：
- 自动下载视频再转存 OSS
- 支持超长视频
- 支持腾讯云 ASR 作为备选
- 支持字幕文件直接导出

可以在这个目录继续扩展。
