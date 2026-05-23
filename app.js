const recordStore = require('./utils/record-store')

const USER_INFO_KEY = 'userInfo'
const SPEAKER_ASSIGNMENTS_KEY = 'doubaoSpeakerAssignments'
const LOCAL_SPEAKER_ASSIGNMENT_MODE = 'random-local-v1'
const DOUBAO_SPEAKER_IDS = [
  'S_zoqmiYt22',
  'S_toqmiYt22',
  'S_yoqmiYt22',
  'S_xoqmiYt22',
  'S_woqmiYt22',
  'S_voqmiYt22',
  'S_uoqmiYt22'
]

App({
  onLaunch() {
    recordStore.writeRecords(recordStore.readRecords())
    this.syncStoredUserInfo()
    this.initNavBarMetrics()
  },

  globalData: {
    userInfo: null,
    navBarMetrics: null,
    aiConfig: {
      deepseekApiKey: 'sk-efabb0e81742435ab0c9d438f2b3d439',
      deepseekModel: 'deepseek-v4-flash',
      doubaoApiKey: '70addb58-ce3b-47d2-b193-1a8030dbeae6',
      doubaoSpeakerIds: DOUBAO_SPEAKER_IDS,
      doubaoSpeakerId: DOUBAO_SPEAKER_IDS[0],
      speakerAssignmentApi: '',
      speakerAssignmentToken: '',
      douyinApiBase: 'https://api.justoneapi.com',
      douyinSharePath: '/api/douyin/share-url-transfer/v1',
      douyinDetailPath: '/api/douyin/get-video-detail/v2',
      douyinExtractToken: 'vhYwBQgMvML9UgaT',
      transcriptProxyApi: '',
      transcriptProxyToken: '',
      transcriptProvider: 'aliyun-fun-asr',
      subtitleApi: 'https://shop.jsqcjs.cn/api/ai/videoClip/generate_subtitles',
      subtitleToken: 'Bearer eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJpc3MiOiJ0ZXN0LnNob3AuanNxY2pzLmNuIiwiYXVkIjoidGVzdC5zaG9wLmpzcWNqcy5jbiIsImlhdCI6MTc3NDQ4ODIwNiwibmJmIjoxNzc0NDg4MjA2LCJleHAiOjE3NzcwODAyMDYsImp0aSI6WzQ2NjAsInVzZXIiXX0.0beOt-abpw2amOHvAQhvvV-k-6w6VSgL7z_Bzlt49hI'
    }
  },

  initNavBarMetrics() {
    const systemInfo = wx.getSystemInfoSync ? wx.getSystemInfoSync() : {}
    const statusBarHeight = systemInfo.statusBarHeight || 20
    let menuButton = null

    try {
      menuButton = wx.getMenuButtonBoundingClientRect ? wx.getMenuButtonBoundingClientRect() : null
    } catch (error) {
      menuButton = null
    }

    const menuTop = menuButton && menuButton.top ? menuButton.top : statusBarHeight + 6
    const menuHeight = menuButton && menuButton.height ? menuButton.height : 32
    const titleBarHeight = menuHeight + (menuTop - statusBarHeight) * 2
    const navBarHeight = statusBarHeight + titleBarHeight
    const leftPadding = 24
    const rightPadding = menuButton && systemInfo.windowWidth
      ? Math.max(systemInfo.windowWidth - menuButton.left + 16, 96)
      : 120
    const contentWidth = systemInfo.windowWidth
      ? Math.max(systemInfo.windowWidth - leftPadding - rightPadding, 160)
      : 220

    this.globalData.navBarMetrics = {
      statusBarHeight,
      titleBarHeight,
      navBarHeight,
      leftPadding,
      rightPadding,
      contentWidth
    }

    return this.globalData.navBarMetrics
  },

  getNavBarMetrics() {
    return this.globalData.navBarMetrics || this.initNavBarMetrics()
  },

  getSpeakerPool() {
    return this.globalData.aiConfig.doubaoSpeakerIds || DOUBAO_SPEAKER_IDS
  },

  normalizeUserInfo(userInfo) {
    if (!userInfo) return null

    const avatarUrl = String(userInfo.avatarUrl || '').trim()
    const nickName = String(userInfo.nickName || '').trim()
    const openId = String(userInfo.openId || userInfo.openid || '').trim()

    if (!avatarUrl || !nickName) return null

    return {
      avatarUrl,
      nickName,
      openId,
      speakerId: String(userInfo.speakerId || '').trim(),
      speakerIndex: Number.isInteger(userInfo.speakerIndex) ? userInfo.speakerIndex : -1
    }
  },

  buildUserIdentityKey(userInfo) {
    const openId = userInfo ? String(userInfo.openId || userInfo.openid || '').trim() : ''
    if (openId) {
      return `openid::${openId}`
    }

    const normalized = this.normalizeUserInfo(userInfo)
    if (!normalized) return ''
    return `${normalized.nickName}::${normalized.avatarUrl}`
  },

  getSpeakerAssignments() {
    const assignments = wx.getStorageSync(SPEAKER_ASSIGNMENTS_KEY)
    return assignments && typeof assignments === 'object' ? assignments : {}
  },

  setSpeakerAssignments(assignments) {
    wx.setStorageSync(SPEAKER_ASSIGNMENTS_KEY, assignments)
  },

  getRandomSpeakerAssignment(speakerPool) {
    if (!Array.isArray(speakerPool) || speakerPool.length === 0) {
      return {
        speakerId: '',
        speakerIndex: 0
      }
    }

    const speakerIndex = Math.floor(Math.random() * speakerPool.length)

    return {
      speakerId: speakerPool[speakerIndex],
      speakerIndex
    }
  },

  assignSpeakerToUser(userInfo) {
    const normalized = this.normalizeUserInfo(userInfo)
    const identityKey = this.buildUserIdentityKey(normalized)
    const speakerPool = this.getSpeakerPool()

    if (!normalized || !identityKey || speakerPool.length === 0) {
      return {
        speakerId: speakerPool[0] || '',
        speakerIndex: 0
      }
    }

    const assignments = this.getSpeakerAssignments()
    const assigned = assignments[identityKey]

    if (assigned && assigned.speakerId && assigned.mode === LOCAL_SPEAKER_ASSIGNMENT_MODE) {
      return {
        speakerId: assigned.speakerId,
        speakerIndex: Number.isInteger(assigned.speakerIndex) ? assigned.speakerIndex : speakerPool.indexOf(assigned.speakerId)
      }
    }

    const randomAssignment = this.getRandomSpeakerAssignment(speakerPool)
    const speakerIndex = randomAssignment.speakerIndex
    const speakerId = randomAssignment.speakerId

    assignments[identityKey] = {
      mode: LOCAL_SPEAKER_ASSIGNMENT_MODE,
      speakerId,
      speakerIndex,
      avatarUrl: normalized.avatarUrl,
      nickName: normalized.nickName,
      assignedAt: Date.now()
    }
    this.setSpeakerAssignments(assignments)

    return {
      speakerId,
      speakerIndex
    }
  },

  saveUserProfile(userInfo, assignmentOverride = null) {
    const normalized = this.normalizeUserInfo(userInfo)
    if (!normalized) return null

    const assignedSpeaker = assignmentOverride && assignmentOverride.speakerId
      ? {
          speakerId: String(assignmentOverride.speakerId || '').trim(),
          speakerIndex: Number.isInteger(assignmentOverride.speakerIndex) ? assignmentOverride.speakerIndex : this.getSpeakerPool().indexOf(String(assignmentOverride.speakerId || '').trim())
        }
      : this.assignSpeakerToUser(normalized)
    const savedUserInfo = {
      avatarUrl: normalized.avatarUrl,
      nickName: normalized.nickName,
      openId: String((assignmentOverride && assignmentOverride.openId) || normalized.openId || '').trim(),
      speakerId: assignedSpeaker.speakerId,
      speakerIndex: assignedSpeaker.speakerIndex
    }

    wx.setStorageSync(USER_INFO_KEY, savedUserInfo)
    this.globalData.userInfo = savedUserInfo
    this.globalData.aiConfig.doubaoSpeakerId = assignedSpeaker.speakerId || this.getSpeakerPool()[0] || ''

    return savedUserInfo
  },

  syncStoredUserInfo() {
    const storedUserInfo = wx.getStorageSync(USER_INFO_KEY)
    const normalized = this.normalizeUserInfo(storedUserInfo)

    if (!normalized) {
      this.globalData.userInfo = null
      this.globalData.aiConfig.doubaoSpeakerId = this.getSpeakerPool()[0] || ''
      return null
    }

    return this.saveUserProfile(normalized)
  },

  getUserProfile() {
    return this.globalData.userInfo || this.syncStoredUserInfo()
  },

  clearStoredUserProfile() {
    try {
      wx.removeStorageSync(USER_INFO_KEY)
    } catch (error) {
      // ignore storage cleanup failure
    }

    this.globalData.userInfo = null
    this.globalData.aiConfig.doubaoSpeakerId = this.getSpeakerPool()[0] || ''
  },

  syncUserProfileWithOpenId(openId) {
    const normalizedOpenId = String(openId || '').trim()
    const userInfo = this.getUserProfile()

    if (!normalizedOpenId || !userInfo || !userInfo.openId) {
      return userInfo
    }

    if (String(userInfo.openId).trim() !== normalizedOpenId) {
      this.clearStoredUserProfile()
      return null
    }

    return userInfo
  },

  isSpeakerAssignmentServiceConfigured() {
    const config = this.globalData.aiConfig || {}
    return Boolean(String(config.speakerAssignmentApi || '').trim())
  },

  requestWechatSpeakerIdentity(options = {}) {
    const config = this.globalData.aiConfig || {}
    const api = String(config.speakerAssignmentApi || '').trim()
    const token = String(config.speakerAssignmentToken || '').trim()
    const assignSpeaker = Boolean(options.assignSpeaker)

    if (!api) {
      return Promise.resolve(null)
    }

    return new Promise((resolve, reject) => {
      wx.login({
        success: (loginRes) => {
          const code = loginRes && loginRes.code ? String(loginRes.code).trim() : ''

          if (!code) {
            reject(new Error('wx.login 未返回有效 code'))
            return
          }

          wx.request({
            url: api,
            method: 'POST',
            timeout: 20000,
            header: {
              'Content-Type': 'application/json',
              ...(token ? { Authorization: `Bearer ${token}` } : {})
            },
            data: {
              code,
              assignSpeaker,
              speakerIds: this.getSpeakerPool(),
              avatarUrl: String(options.avatarUrl || '').trim(),
              nickName: String(options.nickName || '').trim()
            },
            success: (res) => {
              if (res.statusCode < 200 || res.statusCode >= 300 || !res.data) {
                reject(new Error(`微信身份接口异常 HTTP ${res.statusCode}`))
                return
              }

              const data = res.data || {}
              const openId = String(data.openId || data.openid || '').trim()
              const speakerId = String(data.speakerId || '').trim()
              const rawSpeakerIndex = data.speakerIndex
              const speakerIndex = Number.isInteger(rawSpeakerIndex)
                ? rawSpeakerIndex
                : (typeof rawSpeakerIndex === 'number' ? Math.floor(rawSpeakerIndex) : -1)

              if (!openId) {
                reject(new Error('微信身份接口未返回 openId'))
                return
              }

              this.globalData.currentOpenId = openId
              this.syncUserProfileWithOpenId(openId)

              resolve({
                openId,
                speakerId,
                speakerIndex,
                hasAssignment: Boolean(data.hasAssignment || speakerId)
              })
            },
            fail: (error) => {
              reject(new Error(error && error.errMsg ? error.errMsg : '微信身份接口请求失败'))
            }
          })
        },
        fail: (error) => {
          reject(new Error(error && error.errMsg ? error.errMsg : 'wx.login 调用失败'))
        }
      })
    })
  },

  resolveCurrentWechatIdentity() {
    return this.requestWechatSpeakerIdentity({ assignSpeaker: false })
  },

  saveUserProfileWithWechatIdentity(userInfo) {
    const normalized = this.normalizeUserInfo(userInfo)
    if (!normalized) {
      return Promise.resolve(null)
    }

    if (!this.isSpeakerAssignmentServiceConfigured()) {
      return Promise.resolve(this.saveUserProfile(normalized))
    }

    return this.requestWechatSpeakerIdentity({
      assignSpeaker: true,
      avatarUrl: normalized.avatarUrl,
      nickName: normalized.nickName
    }).then((identity) => {
      if (!identity || !identity.openId || !identity.speakerId) {
        return this.saveUserProfile(normalized)
      }

      return this.saveUserProfile({
        ...normalized,
        openId: identity.openId
      }, identity)
    })
  },

  getCurrentSpeakerId() {
    const userInfo = this.getUserProfile()

    if (userInfo && userInfo.speakerId) {
      this.globalData.aiConfig.doubaoSpeakerId = userInfo.speakerId
      return userInfo.speakerId
    }

    const speakerId = this.getSpeakerPool()[0] || ''
    this.globalData.aiConfig.doubaoSpeakerId = speakerId
    return speakerId
  }
})
