const APP_NAME = '鱼籽记账'
const DEFAULT_IMAGE_URL = '/images/share-cover.png'

const PAGE_SHARE_CONFIG = {
  'pages/index/index': {
    title: `${APP_NAME}｜随手记清每一笔收支`,
    path: '/pages/index/index',
    entry: 'index'
  },
  'pages/ai/ai': {
    title: `${APP_NAME}｜记账 + AI 工具都能用`,
    path: '/pages/ai/ai',
    entry: 'ai'
  },
  'pages/mine/mine': {
    title: `${APP_NAME}｜看看我的本月收支汇总`,
    path: '/pages/mine/mine',
    entry: 'mine'
  }
}

function setupShareMenu() {
  if (!wx.showShareMenu) return

  wx.showShareMenu({
    menus: ['shareAppMessage', 'shareTimeline']
  })
}

function buildQuery(params) {
  return Object.keys(params)
    .filter((key) => params[key] !== undefined && params[key] !== null && params[key] !== '')
    .map((key) => `${encodeURIComponent(key)}=${encodeURIComponent(String(params[key]))}`)
    .join('&')
}

function getShareConfig(pageKey) {
  return PAGE_SHARE_CONFIG[pageKey] || PAGE_SHARE_CONFIG['pages/index/index']
}

function buildShareAppMessage(pageKey, extras = {}) {
  const config = getShareConfig(pageKey)
  const query = buildQuery({
    fromShare: 1,
    shareScene: 'friend',
    shareEntry: config.entry,
    ...extras
  })

  return {
    title: config.title,
    path: query ? `${config.path}?${query}` : config.path,
    imageUrl: DEFAULT_IMAGE_URL
  }
}

function buildShareTimeline(pageKey, extras = {}) {
  const config = getShareConfig(pageKey)

  return {
    title: config.title,
    query: buildQuery({
      fromShare: 1,
      shareScene: 'timeline',
      shareEntry: config.entry,
      ...extras
    }),
    imageUrl: DEFAULT_IMAGE_URL
  }
}

function parseShareOptions(options = {}) {
  return {
    fromShare: String(options.fromShare || '') === '1',
    shareScene: String(options.shareScene || ''),
    shareEntry: String(options.shareEntry || '')
  }
}

module.exports = {
  setupShareMenu,
  buildShareAppMessage,
  buildShareTimeline,
  parseShareOptions,
  DEFAULT_IMAGE_URL
}
