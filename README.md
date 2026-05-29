# 鱼籽记账

一款简洁实用的微信小程序记账工具，数据本地存储，安全可靠。

## 功能概览

| 页面 | 功能 |
|------|------|
| **首页** | 实时时间、天气展示、收支记账、按月筛选、左滑删除 |
| **AI 工具** | AI 客服、抖音链接提取文案、图片压缩、声音复刻、生成字幕 |
| **我的** | 月度收支汇总、打卡签到、数据备份/恢复、清空数据 |

## 项目结构

```
note-demo/
├── app.js                  # 小程序入口，全局数据、用户身份、音色分配
├── app.json                # 全局配置、页面路由、TabBar
├── app.wxss                # 全局样式
├── project.config.json     # 项目配置
├── sitemap.json            # 搜索索引配置
├── custom-tab-bar/         # 自定义底部 TabBar
├── pages/
│   ├── index/              # 首页：记账、天气、时间
│   ├── ai/                 # AI 工具页：5 大 AI 功能
│   └── mine/               # 我的页：统计、打卡、备份
├── utils/
│   ├── record-store.js     # 记账数据读写、本地备份
│   └── share-config.js     # 分享配置（好友/朋友圈）
├── images/                 # 图标资源（TabBar、页面图标、分享封面）
└── php-backend/            # PHP 后端代理（可选）
    ├── transcript.php      # 阿里云 Fun-ASR 语音转写代理
    ├── wechat-speaker.php  # 微信身份与音色绑定服务
    └── README.md           # 后端部署文档
```

## 技术栈

- **前端**：微信小程序原生框架（WXML + WXSS + JS）
- **数据存储**：`wx.getStorageSync` + 本地文件系统备份
- **AI 接口**：DeepSeek（智能客服）、豆包 TTS（声音复刻）
- **第三方服务**：Open-Meteo（天气）、抖音解析 API
- **可选后端**：PHP + 阿里云百炼 Fun-ASR（视频口播转写）

## 本地开发

1. 使用 **微信开发者工具** 导入项目
2. 填写 `appid`（`project.config.json` 中已配置）
3. 如需 AI 功能，在 `app.js` 中配置对应 API Key：

```js
// app.js 中 globalData.aiConfig 配置
{
  deepseekApiKey: '你的 DeepSeek API Key',
  doubaoApiKey: '你的豆包 API Key',
  douyinApiBase: '抖音解析接口地址',
  douyinExtractToken: '抖音解析 Token'
}
```

4. 编译预览即可

## 数据安全

- 所有记账数据存储在本地，不上传云端
- 支持导出 JSON 备份文件，可随时恢复
- 用户头像/昵称仅在本地缓存，用于音色分配标识

## 分享支持

- 支持分享给微信好友（带封面图）
- 支持分享到朋友圈
- 各页面独立分享文案，见 `utils/share-config.js`

## 可选后端部署

如需使用「AI 爆款链接提取文案」的完整功能（视频口播转写），或需要服务端固定绑定微信音色，可部署 `php-backend/` 目录下的 PHP 服务：

- [后端部署文档](./php-backend/README.md)

## 注意事项

- 真机调试时，需在微信小程序后台配置 `request 合法域名`
- AI 功能依赖第三方 API，请确保网络畅通且密钥有效
- 声音复刻功能需要用户授权微信信息以分配音色

---

> 日常记账，轻松管理每一笔收支。
