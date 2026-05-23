const shareConfig = require('../../utils/share-config')

Page({
  data: {
    navBarMetrics: {},
    features: [
      { type: 'chat', title: 'AI 智能客服', desc: '账单问题、使用疑问，都可以直接问。', icon: '客服' },
      { type: 'copy', title: 'AI 爆款链接提取文案', desc: '粘贴抖音分享文案或链接，提取视频文案。', icon: '文案' },
      { type: 'compress', title: 'AI 图片压缩', desc: '上传图片压缩并返回临时文件。', icon: '压缩' },
      { type: 'voice', title: 'AI 声音复刻', desc: '先授权微信信息，再上传音频进行复刻。', icon: '声音' },
      { type: 'subtitle', title: 'AI 生成字幕', desc: '输入关键词，生成可直接使用的字幕文案。', icon: '字幕' }
    ],
    activeModal: '',
    modalTitle: '',
    isAiLoading: false,
    chatMessages: [
      { role: 'assistant', content: '你好，我可以帮你解答记账和 AI 工具的使用问题。' }
    ],
    chatInput: '',
    douyinLink: '',
    extractResult: '',
    imagePath: '',
    compressedImagePath: '',
    voiceAudioPath: '',
    voiceAudioFileName: '',
    voiceName: '',
    voiceCloneReady: false,
    voiceTouchStartX: 0,
    voiceTouchStartY: 0,
    currentVoiceSwipeId: '',
    playingVoiceId: '',
    loadingVoiceId: '',
    clonedVoices: [],
    subtitleKeyword: '',
    subtitleResult: '',
    showAuthModal: false,
    authAvatarUrl: '',
    authNickName: '',
    userInfo: null,
    currentSpeakerId: '',
    currentSpeakerIndex: 0
  },

  onLoad(options) {
    const navBarMetrics = getApp().getNavBarMetrics ? getApp().getNavBarMetrics() : {}
    this.shareContext = shareConfig.parseShareOptions(options)
    this.setData({
      navBarMetrics
    })
    this.enableShareMenus()
    this.loadClonedVoices()
    this.refreshIdentityState()
  },

  onShow() {
    this.loadClonedVoices()
    this.refreshIdentityState()

    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({
        selected: 1
      })
    }
  },

  onUnload() {
    this.destroyVoicePlayer()
  },

  enableShareMenus() {
    shareConfig.setupShareMenu()
  },

  onShareAppMessage() {
    return shareConfig.buildShareAppMessage('pages/ai/ai')
  },

  onShareTimeline() {
    return shareConfig.buildShareTimeline('pages/ai/ai')
  },

  refreshIdentityState() {
    this.loadUserInfo()

    const app = getApp()
    if (!app.resolveCurrentWechatIdentity) {
      return
    }

    app.resolveCurrentWechatIdentity()
      .then((identity) => {
        const activeUserInfo = identity && identity.openId && app.syncUserProfileWithOpenId
          ? app.syncUserProfileWithOpenId(identity.openId)
          : (app.getUserProfile ? app.getUserProfile() : null)
        const speakerId = identity && identity.hasAssignment
          ? identity.speakerId
          : (activeUserInfo && activeUserInfo.speakerId ? activeUserInfo.speakerId : '')
        const speakerIndex = identity && identity.hasAssignment && Number.isInteger(identity.speakerIndex)
          ? identity.speakerIndex + 1
          : (activeUserInfo && Number.isInteger(activeUserInfo.speakerIndex) ? activeUserInfo.speakerIndex + 1 : 0)

        this.setData({
          userInfo: activeUserInfo || null,
          currentSpeakerId: speakerId,
          currentSpeakerIndex: speakerIndex
        })
      })
      .catch(() => {
        this.loadUserInfo()
      })
  },

  loadUserInfo() {
    const app = getApp()
    const userInfo = app.getUserProfile ? app.getUserProfile() : (wx.getStorageSync('userInfo') || null)
    const speakerId = userInfo && userInfo.speakerId ? userInfo.speakerId : ''
    const speakerIndex = userInfo && Number.isInteger(userInfo.speakerIndex) ? userInfo.speakerIndex + 1 : 0

    this.setData({
      userInfo,
      currentSpeakerId: speakerId,
      currentSpeakerIndex: speakerIndex
    })
  },

  openFeature(e) {
    const type = e.currentTarget.dataset.type

    if (type === 'voice') {
      this.ensureVoiceAccess()
      return
    }

    this.openFeatureModal(type)
  },

  ensureVoiceAccess() {
    const app = getApp()
    const showAuthModal = () => {
      this.setData({
        showAuthModal: true,
        authAvatarUrl: '',
        authNickName: ''
      })
    }
    const openVoiceModal = () => {
      this.loadUserInfo()
      this.openFeatureModal('voice')
    }
    const currentUserInfo = app.getUserProfile ? app.getUserProfile() : (this.data.userInfo || wx.getStorageSync('userInfo'))

    if (!app.resolveCurrentWechatIdentity) {
      if (!currentUserInfo || !currentUserInfo.avatarUrl || !currentUserInfo.nickName) {
        showAuthModal()
        return
      }

      openVoiceModal()
      return
    }

    app.resolveCurrentWechatIdentity()
      .then((identity) => {
        const activeUserInfo = identity && identity.openId && app.syncUserProfileWithOpenId
          ? app.syncUserProfileWithOpenId(identity.openId)
          : currentUserInfo

        this.setData({
          currentSpeakerId: identity && identity.hasAssignment ? identity.speakerId : '',
          currentSpeakerIndex: identity && identity.hasAssignment && Number.isInteger(identity.speakerIndex) ? identity.speakerIndex + 1 : 0,
          userInfo: activeUserInfo || null
        })

        if (!activeUserInfo || !activeUserInfo.avatarUrl || !activeUserInfo.nickName) {
          showAuthModal()
          return
        }

        openVoiceModal()
      })
      .catch(() => {
        if (!currentUserInfo || !currentUserInfo.avatarUrl || !currentUserInfo.nickName) {
          showAuthModal()
          return
        }

        openVoiceModal()
      })
  },

  openFeatureModal(type) {
    const feature = this.data.features.find((item) => item.type === type)

    this.setData({
      activeModal: type,
      modalTitle: feature ? feature.title : 'AI',
      extractResult: type === 'copy' ? '' : this.data.extractResult,
      subtitleResult: type === 'subtitle' ? '' : this.data.subtitleResult
    })
  },

  hideAuthModal() {
    this.setData({
      showAuthModal: false,
      authAvatarUrl: '',
      authNickName: ''
    })
  },

  onChooseAvatar(e) {
    this.setData({
      authAvatarUrl: e.detail.avatarUrl || ''
    })
  },

  onNickNameInput(e) {
    this.setData({
      authNickName: e.detail.value || ''
    })
  },

  confirmUserInfo() {
    const avatarUrl = String(this.data.authAvatarUrl || '').trim()
    const nickName = String(this.data.authNickName || '').trim()

    if (!avatarUrl) {
      wx.showToast({
        title: '请选择微信头像',
        icon: 'none'
      })
      return
    }

    if (!nickName) {
      wx.showToast({
        title: '请输入微信昵称',
        icon: 'none'
      })
      return
    }

    const app = getApp()
    const saveProfile = app.saveUserProfileWithWechatIdentity || app.saveUserProfile

    wx.showLoading({
      title: '绑定音色中',
      mask: true
    })

    Promise.resolve(saveProfile.call(app, { avatarUrl, nickName }))
      .then((userInfo) => {
        if (!userInfo) {
          throw new Error('未获取到当前微信号信息')
        }

        this.setData({
          userInfo,
          currentSpeakerId: userInfo.speakerId || '',
          currentSpeakerIndex: userInfo && Number.isInteger(userInfo.speakerIndex) ? userInfo.speakerIndex + 1 : 0,
          showAuthModal: false,
          authAvatarUrl: '',
          authNickName: ''
        })

        this.openFeatureModal('voice')
      })
      .catch((error) => {
        wx.showToast({
          title: error && error.message ? error.message : '当前微信号绑定失败',
          icon: 'none'
        })
      })
      .finally(() => {
        wx.hideLoading()
      })
  },

  closeModal() {
    if (this.data.isAiLoading) return
    this.setData({
      activeModal: ''
    })
  },

  stopPropagation() {},

  getAiConfig() {
    return (getApp().globalData && getApp().globalData.aiConfig) || {}
  },

  requireConfig(value, message) {
    if (value) return true
    wx.showToast({
      title: message,
      icon: 'none'
    })
    return false
  },

  onChatInput(e) {
    this.setData({
      chatInput: e.detail.value || ''
    })
  },

  sendChat() {
    const content = String(this.data.chatInput || '').trim()
    const config = this.getAiConfig()
    const apiKey = String(config.deepseekApiKey || '').trim()

    if (!content || this.data.isAiLoading) return
    if (!this.requireConfig(apiKey, '请先配置 DeepSeek 密钥')) return

    const nextMessages = this.data.chatMessages.concat({ role: 'user', content })
    this.setData({
      chatMessages: nextMessages,
      chatInput: '',
      isAiLoading: true
    })

    wx.request({
      url: 'https://api.deepseek.com/chat/completions',
      method: 'POST',
      timeout: 60000,
      header: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        Authorization: `Bearer ${apiKey}`
      },
      data: {
        model: config.deepseekModel || 'deepseek-v4-flash',
        messages: [
          { role: 'system', content: '你是一个记账小程序的智能客服，回答要简洁、准确、可执行。' },
          ...nextMessages
        ],
        stream: false
      },
      success: (res) => {
        if (res.statusCode < 200 || res.statusCode >= 300) {
          this.appendChatMessage('assistant', this.getDeepSeekErrorMessage(res))
          return
        }

        const reply = res.data && res.data.choices && res.data.choices[0] && res.data.choices[0].message
        this.appendChatMessage('assistant', reply && reply.content ? reply.content : 'DeepSeek 没有返回有效内容。')
      },
      fail: (error) => {
        this.appendChatMessage('assistant', this.getRequestFailMessage(error))
      },
      complete: () => {
        this.setData({
          isAiLoading: false
        })
      }
    })
  },

  appendChatMessage(role, content) {
    this.setData({
      chatMessages: this.data.chatMessages.concat({ role, content })
    })
  },

  getDeepSeekErrorMessage(res) {
    const data = res.data || {}
    const error = data.error || {}
    const message = error.message || data.message || JSON.stringify(data)

    if (res.statusCode === 401) {
      return `DeepSeek 鉴权失败，请检查 deepseekApiKey。${message ? `\n${message}` : ''}`
    }

    if (res.statusCode === 402) {
      return 'DeepSeek 账户余额不足或计费不可用，请去控制台检查。'
    }

    if (res.statusCode === 429) {
      return 'DeepSeek 请求过于频繁，请稍后再试。'
    }

    if (res.statusCode === 400 && String(message).includes('model')) {
      return `DeepSeek 模型配置有误，请检查 deepseekModel。当前模型：${this.getAiConfig().deepseekModel || 'deepseek-v4-flash'}`
    }

    return `DeepSeek 接口异常（HTTP ${res.statusCode}）：${message || '未知错误'}`
  },

  getRequestFailMessage(error) {
    const errMsg = error && error.errMsg ? error.errMsg : ''

    if (errMsg.includes('url not in domain list') || errMsg.includes('not in domain list')) {
      return '请求被微信拦截：请在小程序后台把 api.deepseek.com 加到 request 合法域名。'
    }

    if (errMsg.includes('timeout')) {
      return 'DeepSeek 请求超时，请稍后再试。'
    }

    if (errMsg.includes('fail')) {
      return `DeepSeek 请求失败：${errMsg || '请检查网络和域名配置。'}`
    }

    return `DeepSeek 请求失败：${errMsg || '请检查网络和域名配置。'}`
  },

  onDouyinLinkInput(e) {
    this.setData({
      douyinLink: e.detail.value || ''
    })
  },

  extractCopy() {
    const shareText = String(this.data.douyinLink || '').trim()
    const shareUrl = this.extractDouyinUrl(shareText)
    const config = this.getAiConfig()

    if (!shareText || this.data.isAiLoading) return
    if (!shareUrl) {
      wx.showToast({
        title: '未识别到抖音链接',
        icon: 'none'
      })
      return
    }
    if (!this.requireConfig(config.douyinApiBase, '请先配置解析接口')) return
    if (!this.requireConfig(config.douyinExtractToken, '请先配置解析 Token')) return

    this.setData({
      isAiLoading: true,
      extractResult: '正在解析抖音分享链接...'
    })

    wx.request({
      url: `${config.douyinApiBase}${config.douyinSharePath || '/api/douyin/share-url-transfer/v1'}`,
      method: 'GET',
      header: {
        'Content-Type': 'application/json'
      },
      data: {
        token: config.douyinExtractToken,
        shareUrl
      },
      success: (res) => {
        const videoId = this.pickField(res.data, ['aweme_id', 'awemeId', 'video_id', 'videoId', 'item_id', 'itemId'])
          || this.extractDouyinVideoId(res.data)

        if (videoId) {
          this.requestDouyinDetail(config, videoId, { shareText, shareUrl })
          return
        }

        this.finishExtract(
          this.formatDouyinExtractResult(res.data, { shareText, shareUrl })
            || this.buildFallbackExtractText(shareText, shareUrl)
        )
      },
      fail: (error) => {
        this.finishExtract(this.buildFallbackExtractText(shareText, shareUrl, error))
      }
    })
  },

  requestDouyinDetail(config, videoId, context = {}) {
    wx.request({
      url: `${config.douyinApiBase}${config.douyinDetailPath || '/api/douyin/get-video-detail/v2'}`,
      method: 'GET',
      header: {
        'Content-Type': 'application/json'
      },
      data: {
        token: config.douyinExtractToken,
        awemeId: videoId,
        aweme_id: videoId,
        videoId
      },
      success: (res) => {
        const detailPayload = res.data || {}
        const videoUrl = this.extractVideoSourceUrl(detailPayload)
        const baseContext = {
          ...context,
          videoId,
          videoUrl
        }

        if (config.transcriptProxyApi && videoUrl) {
          this.requestVideoTranscript(config, detailPayload, baseContext)
          return
        }

        this.finishExtract(
          this.formatDouyinExtractResult(detailPayload, baseContext)
            || this.buildFallbackExtractText(context.shareText, context.shareUrl)
        )
      },
      fail: (error) => {
        this.finishExtract(this.buildFallbackExtractText(context.shareText, context.shareUrl, error))
      },
      complete: () => {
        this.setData({
          isAiLoading: false
        })
      }
    })
  },

  requestVideoTranscript(config, detailPayload, context) {
    this.setData({
      extractResult: '视频详情已拿到，正在提取真实口播内容...'
    })

    wx.request({
      url: config.transcriptProxyApi,
      method: 'POST',
      timeout: 180000,
      header: {
        'Content-Type': 'application/json',
        ...(config.transcriptProxyToken ? { Authorization: `Bearer ${config.transcriptProxyToken}` } : {})
      },
      data: {
        provider: config.transcriptProvider || 'aliyun-fun-asr',
        videoUrl: context.videoUrl,
        videoId: context.videoId,
        shareUrl: context.shareUrl || '',
        title: this.pickField(detailPayload, ['aweme_desc', 'awemeDesc', 'copywriting', 'desc', 'title']) || this.extractTitleFromShareText(context.shareText),
        source: 'douyin'
      },
      success: (res) => {
        const transcript = this.extractTranscriptText(res.data)
        const srtText = this.extractSrtText(res.data)

        this.finishExtract(
          this.formatDouyinExtractResult(detailPayload, {
            ...context,
            transcript,
            srtText
          }) || this.buildFallbackExtractText(context.shareText, context.shareUrl)
        )
      },
      fail: (error) => {
        this.finishExtract(
          this.formatDouyinExtractResult(detailPayload, {
            ...context,
            transcriptError: error && error.errMsg ? error.errMsg : '转写接口调用失败'
          }) || this.buildFallbackExtractText(context.shareText, context.shareUrl, error)
        )
      },
      complete: () => {
        this.setData({
          isAiLoading: false
        })
      }
    })
  },

  finishExtract(text) {
    this.setData({
      extractResult: text,
      isAiLoading: false
    })
  },

  chooseImage() {
    wx.chooseMedia({
      count: 1,
      mediaType: ['image'],
      sourceType: ['album', 'camera'],
      success: (res) => {
        const file = res.tempFiles && res.tempFiles[0]
        this.setData({
          imagePath: file ? file.tempFilePath : '',
          compressedImagePath: ''
        })
      }
    })
  },

  compressImage() {
    if (!this.data.imagePath || this.data.isAiLoading) return

    this.setData({
      isAiLoading: true
    })

    wx.compressImage({
      src: this.data.imagePath,
      quality: 70,
      success: (res) => {
        this.setData({
          compressedImagePath: res.tempFilePath
        })
      },
      fail: () => {
        wx.showToast({
          title: '压缩失败',
          icon: 'none'
        })
      },
      complete: () => {
        this.setData({
          isAiLoading: false
        })
      }
    })
  },

  chooseVoiceAudio() {
    wx.chooseMessageFile({
      count: 1,
      type: 'file',
      extension: ['mp3', 'wav', 'm4a'],
      success: (res) => {
        const file = res.tempFiles && res.tempFiles[0]
        this.setData({
          voiceAudioPath: file ? file.path : '',
          voiceAudioFileName: file ? file.name : ''
        })
        this.refreshVoiceCloneReady()
      }
    })
  },

  onVoiceNameInput(e) {
    this.setData({
      voiceName: e.detail.value || ''
    })
    this.refreshVoiceCloneReady()
  },

  refreshVoiceCloneReady() {
    this.setData({
      voiceCloneReady: Boolean(this.data.voiceAudioPath && String(this.data.voiceName || '').trim())
    })
  },

  startVoiceClone() {
    const config = this.getAiConfig()
    const app = getApp()
    const speakerId = app.getCurrentSpeakerId ? app.getCurrentSpeakerId() : (config.doubaoSpeakerId || '')

    if (!this.data.voiceCloneReady || this.data.isAiLoading) return
    if (!this.requireConfig(config.doubaoApiKey, '请先配置豆包密钥')) return
    if (!this.requireConfig(speakerId, '当前用户还没有匹配到音色 ID')) return

    const fs = wx.getFileSystemManager()
    const ext = this.getFileExt(this.data.voiceAudioFileName || this.data.voiceAudioPath)

    this.setData({
      isAiLoading: true,
      currentSpeakerId: speakerId
    })

    fs.readFile({
      filePath: this.data.voiceAudioPath,
      encoding: 'base64',
      success: (fileRes) => {
        wx.request({
          url: 'https://openspeech.bytedance.com/api/v3/tts/voice_clone',
          method: 'POST',
          header: {
            'Content-Type': 'application/json',
            'X-Api-Key': config.doubaoApiKey,
            'X-Api-Request-Id': this.generateRequestId()
          },
          data: {
            speaker_id: speakerId,
            audio: {
              data: fileRes.data,
              format: ext || 'mp3'
            },
            language: 0
          },
          success: (res) => {
            if (res.statusCode < 200 || res.statusCode >= 300) {
              wx.showToast({
                title: '复刻失败',
                icon: 'none'
              })
              return
            }

            const voice = this.buildClonedVoice(res.data)
            const clonedVoices = [voice].concat(this.data.clonedVoices)
            wx.setStorageSync('aiClonedVoices', clonedVoices)

            wx.showToast({
              title: '复刻成功',
              icon: 'success'
            })

            this.setData({
              clonedVoices,
              activeModal: '',
              voiceAudioPath: '',
              voiceAudioFileName: '',
              voiceName: '',
              voiceCloneReady: false
            })
          },
          fail: () => {
            wx.showToast({
              title: '复刻请求失败',
              icon: 'none'
            })
          },
          complete: () => {
            this.setData({
              isAiLoading: false
            })
          }
        })
      },
      fail: () => {
        this.setData({
          isAiLoading: false
        })
        wx.showToast({
          title: '音频读取失败',
          icon: 'none'
        })
      }
    })
  },

  buildClonedVoice(response) {
    const data = response && (response.data || response) || {}

    return {
      id: String(Date.now()),
      name: String(this.data.voiceName || '').trim(),
      speakerId: data.icl_speaker_id || data.speaker_id || data.speakerId || data.voice_id || data.id || this.data.currentSpeakerId || '',
      audioUrl: data.demo_audio || data.demoAudio || data.audio_url || data.audioUrl || data.url || '',
      rawSpeakerId: data.speaker_id || '',
      assignedSpeakerId: this.data.currentSpeakerId || '',
      createdAt: this.formatDateTime(new Date())
    }
  },

  loadClonedVoices() {
    const clonedVoices = (wx.getStorageSync('aiClonedVoices') || []).map((item) => ({
      ...item,
      id: String(item.id || Date.now()),
      audioUrl: item.audioUrl || item.demoAudio || item.demo_audio || ''
    }))

    this.setData({
      clonedVoices
    })
  },

  onVoiceTouchStart(e) {
    const id = String(e.currentTarget.dataset.id)

    this.setData({
      voiceTouchStartX: e.touches[0].clientX,
      voiceTouchStartY: e.touches[0].clientY,
      currentVoiceSwipeId: this.data.currentVoiceSwipeId === id ? this.data.currentVoiceSwipeId : ''
    })
  },

  onVoiceTouchMove(e) {
    const touchMoveX = e.touches[0].clientX
    const touchMoveY = e.touches[0].clientY
    const deltaX = this.data.voiceTouchStartX - touchMoveX
    const deltaY = Math.abs(this.data.voiceTouchStartY - touchMoveY)
    const id = String(e.currentTarget.dataset.id)

    if (deltaX > 30 && deltaX > deltaY) {
      this.setData({
        currentVoiceSwipeId: id
      })
    } else if (deltaX < -30 && Math.abs(deltaX) > deltaY) {
      this.setData({
        currentVoiceSwipeId: ''
      })
    }
  },

  confirmDeleteVoice(e) {
    const id = String(e.currentTarget.dataset.id)

    wx.showModal({
      title: '提示',
      content: '确定要删除这条复刻声音吗？',
      confirmText: '删除',
      confirmColor: '#e74c3c',
      success: (res) => {
        if (res.confirm) {
          this.deleteVoice(id)
        }
      }
    })
  },

  deleteVoice(id) {
    if (this.data.playingVoiceId === id && this.voicePlayer) {
      if (this.voicePlayerState) {
        this.voicePlayerState.manuallyStopped = true
      }
      this.voicePlayer.stop()
    }

    const clonedVoices = this.data.clonedVoices.filter((item) => String(item.id) !== id)
    wx.setStorageSync('aiClonedVoices', clonedVoices)

    this.setData({
      clonedVoices,
      currentVoiceSwipeId: '',
      playingVoiceId: this.data.playingVoiceId === id ? '' : this.data.playingVoiceId
    })

    wx.showToast({
      title: '删除成功',
      icon: 'success'
    })
  },

  playClonedVoice(e) {
    const id = String(e.currentTarget.dataset.id)
    const url = e.currentTarget.dataset.url
    const localUrl = e.currentTarget.dataset.localUrl

    if (!url) {
      wx.showToast({
        title: '暂无可播放音频',
        icon: 'none'
      })
      return
    }

    if (this.data.loadingVoiceId) return

    if (this.voicePlayer && this.data.playingVoiceId === id) {
      if (this.voicePlayerState) {
        this.voicePlayerState.manuallyStopped = true
      }
      this.voicePlayer.stop()
      this.setData({
        playingVoiceId: ''
      })
      return
    }

    if (localUrl) {
      this.startVoicePlayer(id, localUrl)
      return
    }

    this.setData({
      loadingVoiceId: id
    })

    wx.downloadFile({
      url,
      success: (res) => {
        if (res.statusCode !== 200 || !res.tempFilePath) {
          wx.showToast({
            title: '音频下载失败',
            icon: 'none'
          })
          return
        }

        this.updateClonedVoiceLocalPath(id, res.tempFilePath)
        this.startVoicePlayer(id, res.tempFilePath)
      },
      fail: () => {
        const systemInfo = wx.getSystemInfoSync ? wx.getSystemInfoSync() : {}

        if (systemInfo.platform === 'ios') {
          wx.showToast({
            title: '请先配置音频下载域名',
            icon: 'none'
          })
          return
        }

        this.startVoicePlayer(id, url)
      },
      complete: () => {
        this.setData({
          loadingVoiceId: ''
        })
      }
    })
  },

  updateClonedVoiceLocalPath(id, localAudioPath) {
    const clonedVoices = this.data.clonedVoices.map((item) => (
      String(item.id) === id ? { ...item, localAudioPath } : item
    ))

    this.setData({
      clonedVoices
    })
  },

  startVoicePlayer(id, src) {
    this.destroyVoicePlayer()
    const player = wx.createInnerAudioContext()
    const playState = {
      started: false,
      ended: false,
      manuallyStopped: false,
      destroyed: false
    }

    this.voicePlayer = player
    this.voicePlayerState = playState
    player.obeyMuteSwitch = false
    player.src = src

    player.onPlay(() => {
      playState.started = true
      this.setData({
        playingVoiceId: id
      })
    })

    player.onEnded(() => {
      playState.ended = true
      this.setData({
        playingVoiceId: ''
      })
    })

    player.onStop(() => {
      playState.manuallyStopped = true
      this.setData({
        playingVoiceId: ''
      })
    })

    player.onError((error) => {
      setTimeout(() => {
        if (playState.destroyed || playState.started || playState.ended || playState.manuallyStopped) {
          console.warn('忽略非致命音频错误', error)
          return
        }

        if (this.voicePlayer !== player) return

        this.setData({
          playingVoiceId: ''
        })
        wx.showToast({
          title: '音频播放失败，请检查格式',
          icon: 'none'
        })
      }, 300)
    })

    player.play()
  },

  destroyVoicePlayer() {
    if (!this.voicePlayer) return

    if (this.voicePlayerState) {
      this.voicePlayerState.destroyed = true
    }

    this.voicePlayer.destroy()
    this.voicePlayer = null
    this.voicePlayerState = null
  },

  onSubtitleKeywordInput(e) {
    this.setData({
      subtitleKeyword: e.detail.value || ''
    })
  },

  generateSubtitle() {
    const keyword = String(this.data.subtitleKeyword || '').trim()
    const config = this.getAiConfig()

    if (!keyword || this.data.isAiLoading) return
    if (!this.requireConfig(config.subtitleApi, '请先配置字幕接口')) return
    if (!this.requireConfig(config.subtitleToken, '请先配置字幕 Token')) return

    this.setData({
      isAiLoading: true,
      subtitleResult: ''
    })

    wx.request({
      url: config.subtitleApi,
      method: 'POST',
      header: {
        'Content-Type': 'application/json',
        'x-token': config.subtitleToken
      },
      data: {
        keyword
      },
      success: (res) => {
        if (res.statusCode < 200 || res.statusCode >= 300 || (res.data && res.data.status && res.data.status !== 200)) {
          this.setData({
            subtitleResult: this.getSubtitleErrorMessage(res)
          })
          return
        }

        this.setData({
          subtitleResult: this.formatSubtitleData(res.data) || this.pickText(res.data) || '接口没有返回字幕内容。'
        })
      },
      fail: () => {
        wx.showToast({
          title: '生成失败',
          icon: 'none'
        })
      },
      complete: () => {
        this.setData({
          isAiLoading: false
        })
      }
    })
  },

  getSubtitleErrorMessage(res) {
    const data = res.data || {}
    const message = data.message || data.msg || data.error || JSON.stringify(data)
    return `字幕接口异常（HTTP ${res.statusCode}）：${message || '未知错误'}`
  },

  formatSubtitleData(payload) {
    const data = this.findSubtitlePayload(payload)

    if (Array.isArray(data)) {
      return data.map((item) => {
        if (typeof item === 'string') return item
        return item.text || item.content || item.subtitle || item.words || JSON.stringify(item)
      }).join('\n')
    }

    if (data && typeof data === 'object') {
      const subtitles = data.subtitles || data.subtitle_list || data.subtitleList || data.list
      if (Array.isArray(subtitles)) {
        return subtitles.map((item) => {
          if (typeof item === 'string') return item
          return item.text || item.content || item.subtitle || item.words || JSON.stringify(item)
        }).join('\n')
      }
    }

    return ''
  },

  findSubtitlePayload(payload) {
    if (!payload) return null
    if (Array.isArray(payload)) return payload
    if (typeof payload !== 'object') return null

    const directKeys = ['subtitles', 'subtitle_list', 'subtitleList', 'list', 'data']
    for (let i = 0; i < directKeys.length; i += 1) {
      const value = payload[directKeys[i]]
      if (Array.isArray(value)) return value
    }

    for (let i = 0; i < directKeys.length; i += 1) {
      const value = payload[directKeys[i]]
      if (value && typeof value === 'object') {
        const found = this.findSubtitlePayload(value)
        if (found) return found
      }
    }

    const values = Object.keys(payload).map((key) => payload[key])
    for (let i = 0; i < values.length; i += 1) {
      const value = values[i]
      if (value && typeof value === 'object') {
        const found = this.findSubtitlePayload(value)
        if (found) return found
      }
    }

    return null
  },

  pickText(payload) {
    if (!payload) return ''
    if (typeof payload === 'string') return payload

    const candidates = [
      payload.copywriting,
      payload.aweme_desc,
      payload.awemeDesc,
      payload.subtitle,
      payload.content,
      payload.text,
      payload.title,
      payload.desc,
      payload.data && payload.data.copywriting,
      payload.data && payload.data.aweme_desc,
      payload.data && payload.data.awemeDesc,
      payload.data && payload.data.subtitle,
      payload.data && payload.data.content,
      payload.data && payload.data.text,
      payload.data && payload.data.title,
      payload.data && payload.data.desc
    ]

    return candidates.find((item) => typeof item === 'string' && item.trim()) || ''
  },

  pickField(payload, keys) {
    if (!payload || typeof payload !== 'object') return ''

    for (let i = 0; i < keys.length; i += 1) {
      const value = payload[keys[i]]
      if (value || value === 0) return value
    }

    const values = Object.keys(payload).map((key) => payload[key])
    for (let i = 0; i < values.length; i += 1) {
      const value = values[i]
      if (value && typeof value === 'object') {
        const found = this.pickField(value, keys)
        if (found || found === 0) return found
      }
    }

    return ''
  },

  extractDouyinUrl(text) {
    if (!text) return ''

    const urls = String(text).match(/https?:\/\/[^\s]+/g) || []
    const douyinUrl = urls.find((item) => /douyin\.com/i.test(item))
    return douyinUrl ? douyinUrl.replace(/[),.;，。！？]$/, '') : ''
  },

  extractDouyinVideoId(payload) {
    const urlCandidates = [
      this.pickField(payload, ['url', 'share_url', 'shareUrl', 'video_url', 'videoUrl', 'item_url', 'itemUrl']),
      this.pickText(payload)
    ].filter(Boolean)

    for (let i = 0; i < urlCandidates.length; i += 1) {
      const text = String(urlCandidates[i])
      const matched = text.match(/video\/(\d+)/) || text.match(/modal_id=(\d+)/) || text.match(/aweme_id=(\d+)/)
      if (matched && matched[1]) {
        return matched[1]
      }
    }

    return ''
  },

  formatDouyinExtractResult(payload, context = {}) {
    if (!payload) return ''

    const videoId = context.videoId
      || this.pickField(payload, ['aweme_id', 'awemeId', 'video_id', 'videoId', 'item_id', 'itemId'])
      || this.extractDouyinVideoId(payload)
    const title = this.pickField(payload, ['aweme_desc', 'awemeDesc', 'copywriting', 'desc', 'title', 'content', 'text'])
      || this.extractTitleFromShareText(context.shareText)
    const author = this.pickField(payload, ['nickname', 'author_name', 'authorName', 'unique_id', 'uniqueId', 'sec_user_name', 'secUserName'])
    const createTime = this.pickField(payload, ['create_time', 'createTime'])
    const diggCount = this.pickField(payload, ['digg_count', 'diggCount'])
    const commentCount = this.pickField(payload, ['comment_count', 'commentCount'])
    const collectCount = this.pickField(payload, ['collect_count', 'collectCount'])
    const shareCount = this.pickField(payload, ['share_count', 'shareCount'])
    const lines = []

    if (title) {
      lines.push('视频文案：')
      lines.push(title)
    }

    if (author) {
      lines.push(`作者：${author}`)
    }

    if (videoId) {
      lines.push(`视频ID：${videoId}`)
    }

    const stats = this.formatDouyinStats({
      diggCount,
      commentCount,
      collectCount,
      shareCount
    })
    if (stats) {
      lines.push(`互动数据：${stats}`)
    }

    const publishTime = this.formatTimestamp(createTime)
    if (publishTime) {
      lines.push(`发布时间：${publishTime}`)
    }

    if (context.shareUrl) {
      lines.push(`分享链接：${context.shareUrl}`)
    }

    if (context.transcript) {
      lines.push('真实口播全文：')
      lines.push(context.transcript)
    }

    if (context.srtText) {
      lines.push('字幕结果：')
      lines.push(context.srtText)
    }

    if (context.transcriptError) {
      lines.push(`口播转写：${context.transcriptError}`)
    }

    return lines.join('\n\n').trim()
  },

  buildFallbackExtractText(shareText, shareUrl, error) {
    const title = this.extractTitleFromShareText(shareText)
    const lines = []

    if (title) {
      lines.push('已从分享文案中提取到内容：')
      lines.push(title)
    } else {
      lines.push('没有从接口拿到完整视频详情。')
    }

    if (shareUrl) {
      lines.push(`分享链接：${shareUrl}`)
    }

    if (error && error.errMsg) {
      lines.push(`接口错误：${error.errMsg}`)
    }

    lines.push('如果你要提取视频里真正的口播/字幕内容，还需要额外接入“视频下载 + 语音转文字”接口。')

    return lines.join('\n\n')
  },

  extractTitleFromShareText(shareText) {
    if (!shareText) return ''

    let text = String(shareText)
      .replace(/https?:\/\/[^\s]+/g, ' ')
      .replace(/复制此链接[^]*$/i, ' ')
      .replace(/打开Dou音搜索[^]*$/i, ' ')
      .replace(/[A-Za-z0-9@._-]+\s*:\s*/g, ' ')
      .replace(/\d{2}\/\d{2}/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()

    const parts = text.split('#').map((item) => item.trim()).filter(Boolean)
    if (parts.length > 0) {
      text = parts[0]
    }

    return text
  },

  formatDouyinStats(stats) {
    const items = []

    if (stats.diggCount || stats.diggCount === 0) {
      items.push(`点赞 ${stats.diggCount}`)
    }
    if (stats.commentCount || stats.commentCount === 0) {
      items.push(`评论 ${stats.commentCount}`)
    }
    if (stats.collectCount || stats.collectCount === 0) {
      items.push(`收藏 ${stats.collectCount}`)
    }
    if (stats.shareCount || stats.shareCount === 0) {
      items.push(`分享 ${stats.shareCount}`)
    }

    return items.join('  ')
  },

  extractVideoSourceUrl(payload) {
    return this.pickField(payload, [
      'play_url',
      'playUrl',
      'video_url',
      'videoUrl',
      'nwm_url',
      'nwmUrl',
      'download_url',
      'downloadUrl',
      'src',
      'url'
    ])
  },

  extractTranscriptText(payload) {
    if (!payload) return ''
    if (typeof payload === 'string') return payload

    const text = this.pickField(payload, [
      'transcript',
      'text',
      'content',
      'result',
      'full_text',
      'fullText',
      'speech_text',
      'speechText'
    ])

    if (typeof text === 'string' && text.trim()) {
      return text.trim()
    }

    const paragraphs = this.pickField(payload, ['paragraphs', 'sentences', 'segments', 'utterances'])
    if (Array.isArray(paragraphs)) {
      return paragraphs.map((item) => {
        if (typeof item === 'string') return item
        return item.text || item.content || item.sentence || item.words || ''
      }).filter(Boolean).join('\n')
    }

    return ''
  },

  extractSrtText(payload) {
    if (!payload || typeof payload !== 'object') return ''

    const srt = this.pickField(payload, ['srt', 'subtitle', 'subtitle_text', 'subtitleText'])
    return typeof srt === 'string' ? srt.trim() : ''
  },

  formatTimestamp(value) {
    if (!value && value !== 0) return ''

    const timestamp = Number(value)
    if (Number.isNaN(timestamp) || timestamp <= 0) return ''

    const date = new Date(String(timestamp).length === 13 ? timestamp : timestamp * 1000)
    if (Number.isNaN(date.getTime())) return ''

    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    const hour = String(date.getHours()).padStart(2, '0')
    const minute = String(date.getMinutes()).padStart(2, '0')
    return `${year}-${month}-${day} ${hour}:${minute}`
  },

  getFileExt(fileName) {
    const matched = String(fileName).match(/\.([a-zA-Z0-9]+)$/)
    return matched ? matched[1].toLowerCase() : ''
  },

  generateRequestId() {
    return `${Date.now()}-${Math.random().toString(16).slice(2)}`
  },

  formatDateTime(date) {
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    const hour = String(date.getHours()).padStart(2, '0')
    const minute = String(date.getMinutes()).padStart(2, '0')
    return `${year}-${month}-${day} ${hour}:${minute}`
  }
})
