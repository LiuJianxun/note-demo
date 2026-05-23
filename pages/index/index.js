const recordStore = require('../../utils/record-store')
const shareConfig = require('../../utils/share-config')

const WEEKDAY_MAP = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六']
const CATEGORY_ICON_MAP = {
  工资: '薪',
  红包: '红',
  兼职: '兼',
  理财: '财',
  礼金: '礼',
  其他: '其',
  餐饮: '餐',
  交通: '行',
  购物: '购',
  娱乐: '乐',
  日用: '日',
  蔬菜: '菜',
  水果: '果',
  零食: '零',
  运动: '动',
  通讯: '讯',
  服饰: '衣',
  美容: '美',
  住房: '房',
  居家: '家',
  孩子: '娃',
  长辈: '长',
  社交: '友',
  旅行: '游',
  烟酒: '酒',
  数码: '数',
  汽车: '车',
  医疗: '医',
  书籍: '书',
  学习: '学',
  宠物: '宠',
  礼物: '赠',
  维修: '修',
  捐赠: '捐',
  彩票: '彩',
  亲友: '亲',
  快递: '递'
}

Page({
  data: {
    navBarMetrics: {},
    currentTime: '',
    weatherText: '天气加载中',
    weatherDebug: '',
    moodText: '',
    animatedMoodText: '',
    todayIncome: '0.00',
    todayExpense: '0.00',
    monthIncome: '0.00',
    monthExpense: '0.00',
    recentGroups: [],
    showModal: false,
    modalType: 'income',
    amount: '',
    note: '',
    selectedCategory: '',
    categories: [],
    incomeCategories: ['工资', '红包', '兼职', '理财', '礼金', '其他'],
    expenseCategories: [
      '餐饮', '交通', '购物', '娱乐', '日用', '蔬菜', '水果', '零食', '运动', '通讯',
      '服饰', '美容', '住房', '居家', '孩子', '长辈', '社交', '旅行', '烟酒', '数码',
      '汽车', '医疗', '书籍', '学习', '宠物', '礼金', '礼物', '维修', '捐赠', '彩票',
      '亲友', '快递', '其他'
    ],
    touchStartX: 0,
    touchStartY: 0,
    currentSwipeId: null,
    showMonthPicker: false,
    currentMonth: '',
    displayMonth: '',
    userInfo: null,
    showAuthModal: false,
    pendingRecordType: '',
    authAvatarUrl: '',
    authNickName: ''
  },

  timeTimer: null,
  moodTimer: null,

  onLoad(options) {
    const now = new Date()
    const moodText = this.getDailyMood(now)
    const navBarMetrics = getApp().getNavBarMetrics ? getApp().getNavBarMetrics() : {}
    this.shareContext = shareConfig.parseShareOptions(options)

    this.setData({
      navBarMetrics,
      currentMonth: this.formatMonth(now),
      displayMonth: this.formatDisplayMonth(now),
      moodText,
      animatedMoodText: ''
    })

    this.enableShareMenus()
    this.updateCurrentTime()
    this.startMoodTyping()
    this.loadWeather()
    this.loadUserInfo()
    this.loadData()
  },

  onShow() {
    this.updateCurrentTime()
    this.startMoodTyping()
    this.loadUserInfo()
    this.loadData()

    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({
        selected: 0
      })
    }
  },

  onHide() {
    this.clearTimeTimer()
    this.clearMoodTimer()
  },

  onUnload() {
    this.clearTimeTimer()
    this.clearMoodTimer()
  },

  enableShareMenus() {
    shareConfig.setupShareMenu()
  },

  onShareAppMessage() {
    return shareConfig.buildShareAppMessage('pages/index/index')
  },

  onShareTimeline() {
    return shareConfig.buildShareTimeline('pages/index/index')
  },

  updateCurrentTime() {
    this.clearTimeTimer()
    this.setData({
      currentTime: this.formatFullTime(new Date())
    })

    this.timeTimer = setInterval(() => {
      this.setData({
        currentTime: this.formatFullTime(new Date())
      })
    }, 1000)
  },

  clearTimeTimer() {
    if (!this.timeTimer) return
    clearInterval(this.timeTimer)
    this.timeTimer = null
  },

  startMoodTyping() {
    this.clearMoodTimer()
    const fullText = String(this.data.moodText || '').trim()

    if (!fullText) {
      this.setData({
        animatedMoodText: ''
      })
      return
    }

    let index = 0

    const typeNext = () => {
      if (!this.data.moodText) return

      if (index <= fullText.length) {
        this.setData({
          animatedMoodText: fullText.slice(0, index)
        })
        index += 1
        this.moodTimer = setTimeout(typeNext, index === 1 ? 240 : 110)
        return
      }

      this.moodTimer = setTimeout(() => {
        index = 0
        this.setData({
          animatedMoodText: ''
        })
        this.moodTimer = setTimeout(typeNext, 220)
      }, 1500)
    }

    typeNext()
  },

  clearMoodTimer() {
    if (!this.moodTimer) return
    clearTimeout(this.moodTimer)
    this.moodTimer = null
  },

  loadWeather() {
    const cachedWeather = wx.getStorageSync('todayWeather')
    const today = this.formatDate(new Date())

    if (cachedWeather && cachedWeather.date === today && cachedWeather.text) {
      this.setData({
        weatherText: cachedWeather.text
      })
    }

    wx.getLocation({
      type: 'wgs84',
      success: (location) => {
        this.requestWeather(location.latitude, location.longitude)
      },
      fail: (error) => {
        this.setData({
          weatherDebug: `定位失败：${error && error.errMsg ? error.errMsg : ''}`
        })
        this.requestWeather(39.9042, 116.4074)
      }
    })
  },

  requestWeather(latitude, longitude) {
    wx.request({
      url: 'https://api.open-meteo.com/v1/forecast',
      method: 'GET',
      data: {
        latitude,
        longitude,
        daily: 'weather_code,temperature_2m_max,temperature_2m_min',
        timezone: 'auto',
        forecast_days: 1
      },
      success: (res) => {
        if (res.statusCode < 200 || res.statusCode >= 300) {
          this.handleWeatherFail(`天气接口异常：HTTP ${res.statusCode}`)
          return
        }

        const daily = res.data && res.data.daily
        if (!daily || !daily.temperature_2m_min || !daily.temperature_2m_max) {
          this.handleWeatherFail('天气数据为空')
          return
        }

        const min = Math.round(daily.temperature_2m_min[0])
        const max = Math.round(daily.temperature_2m_max[0])
        const code = daily.weather_code ? daily.weather_code[0] : 0
        const weatherText = `${min}°C - ${max}°C ${this.getWeatherName(code)}`

        wx.setStorageSync('todayWeather', {
          date: this.formatDate(new Date()),
          text: weatherText
        })

        this.setData({
          weatherText,
          weatherDebug: ''
        })
      },
      fail: (error) => {
        this.handleWeatherFail(error && error.errMsg ? error.errMsg : '天气请求失败')
      }
    })
  },

  handleWeatherFail(reason) {
    const cachedWeather = wx.getStorageSync('todayWeather')
    const today = this.formatDate(new Date())

    if (cachedWeather && cachedWeather.date === today && cachedWeather.text) {
      this.setData({
        weatherText: cachedWeather.text,
        weatherDebug: reason
      })
      return
    }

    this.setData({
      weatherText: '天气暂不可用',
      weatherDebug: reason
    })
  },

  showWeatherDebug() {
    if (!this.data.weatherDebug) return

    wx.showModal({
      title: '天气加载失败',
      content: this.data.weatherDebug,
      showCancel: false
    })
  },

  loadUserInfo() {
    const app = getApp()
    const userInfo = app.getUserProfile ? app.getUserProfile() : (wx.getStorageSync('userInfo') || null)

    this.setData({
      userInfo
    })
  },

  loadData() {
    const records = recordStore.readRecords()
    const today = this.formatDate(new Date())
    const currentMonth = this.data.currentMonth
    let todayIncome = 0
    let todayExpense = 0
    let monthIncome = 0
    let monthExpense = 0
    const monthRecords = []

    records.forEach((record) => {
      const recordDate = record.date
      const recordMonth = String(recordDate || '').slice(0, 7)
      const amount = parseFloat(record.amount || 0)

      if (recordDate === today) {
        if (record.type === 'income') {
          todayIncome += amount
        } else {
          todayExpense += amount
        }
      }

      if (recordMonth === currentMonth) {
        if (record.type === 'income') {
          monthIncome += amount
        } else {
          monthExpense += amount
        }
        monthRecords.push(record)
      }
    })

    this.setData({
      todayIncome: todayIncome.toFixed(2),
      todayExpense: todayExpense.toFixed(2),
      monthIncome: monthIncome.toFixed(2),
      monthExpense: monthExpense.toFixed(2),
      recentGroups: this.buildRecentGroups(monthRecords)
    })
  },

  buildRecentGroups(records) {
    const sortedRecords = records
      .slice()
      .sort((a, b) => Number(b.id || 0) - Number(a.id || 0))
      .slice(0, 12)

    const groups = []
    const groupMap = {}

    sortedRecords.forEach((record) => {
      const date = record.date || ''
      if (!groupMap[date]) {
        groupMap[date] = {
          date,
          title: this.formatGroupDate(date),
          incomeTotal: 0,
          expenseTotal: 0,
          records: []
        }
        groups.push(groupMap[date])
      }

      const amount = parseFloat(record.amount || 0)
      const iconText = CATEGORY_ICON_MAP[record.category] || ''

      if (record.type === 'income') {
        groupMap[date].incomeTotal += amount
      } else {
        groupMap[date].expenseTotal += amount
      }

      groupMap[date].records.push({
        ...record,
        idText: String(record.id),
        iconText,
        hasIcon: Boolean(iconText),
        titleText: String(record.note || record.category || '未分类').trim(),
        detailText: `${record.category || '未分类'} · ${record.time || ''}`,
        amountText: `${record.type === 'income' ? '+' : '-'}${Number(amount).toFixed(2)}`
      })
    })

    return groups.map((group) => ({
      ...group,
      summaryText: this.buildGroupSummary(group.incomeTotal, group.expenseTotal)
    }))
  },

  buildGroupSummary(incomeTotal, expenseTotal) {
    const income = incomeTotal.toFixed(2)
    const expense = expenseTotal.toFixed(2)

    if (incomeTotal > 0 && expenseTotal > 0) {
      return `收入：${income}  支出：${expense}`
    }

    if (incomeTotal > 0) {
      return `收入：${income}`
    }

    return `支出：${expense}`
  },

  showIncomeModal() {
    this.ensureUserAuthorized('income')
  },

  showExpenseModal() {
    this.ensureUserAuthorized('expense')
  },

  ensureUserAuthorized(type) {
    const app = getApp()
    const showAuthModal = () => {
      this.setData({
        showAuthModal: true,
        pendingRecordType: type,
        authAvatarUrl: '',
        authNickName: ''
      })
    }
    const openRecord = () => {
      this.openRecordModal(type)
    }
    const currentUserInfo = app.getUserProfile ? app.getUserProfile() : (this.data.userInfo || wx.getStorageSync('userInfo'))

    if (!app.resolveCurrentWechatIdentity) {
      if (!currentUserInfo || !currentUserInfo.avatarUrl || !currentUserInfo.nickName) {
        showAuthModal()
        return
      }

      openRecord()
      return
    }

    app.resolveCurrentWechatIdentity()
      .then((identity) => {
        const activeUserInfo = identity && identity.openId && app.syncUserProfileWithOpenId
          ? app.syncUserProfileWithOpenId(identity.openId)
          : currentUserInfo

        this.setData({
          userInfo: activeUserInfo || null
        })

        if (!activeUserInfo || !activeUserInfo.avatarUrl || !activeUserInfo.nickName) {
          showAuthModal()
          return
        }

        openRecord()
      })
      .catch(() => {
        if (!currentUserInfo || !currentUserInfo.avatarUrl || !currentUserInfo.nickName) {
          showAuthModal()
          return
        }

        openRecord()
      })
  },

  openRecordModal(type) {
    const isIncome = type === 'income'
    const categories = isIncome ? this.data.incomeCategories : this.data.expenseCategories

    this.setData({
      showModal: true,
      modalType: type,
      categories,
      selectedCategory: categories[0] || '',
      amount: '',
      note: ''
    })
  },

  hideAuthModal() {
    this.setData({
      showAuthModal: false,
      pendingRecordType: '',
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
    const pendingRecordType = this.data.pendingRecordType || 'income'
    const saveProfile = app.saveUserProfileWithWechatIdentity || app.saveUserProfile

    wx.showLoading({
      title: '授权中',
      mask: true
    })

    Promise.resolve(saveProfile.call(app, { avatarUrl, nickName }))
      .then((userInfo) => {
        if (!userInfo) {
          throw new Error('未获取到当前微信号信息')
        }

        this.setData({
          userInfo,
          showAuthModal: false,
          pendingRecordType: '',
          authAvatarUrl: '',
          authNickName: ''
        })

        this.openRecordModal(pendingRecordType)
      })
      .catch((error) => {
        wx.showToast({
          title: error && error.message ? error.message : '微信授权失败',
          icon: 'none'
        })
      })
      .finally(() => {
        wx.hideLoading()
      })
  },

  hideModal() {
    this.setData({
      showModal: false
    })
  },

  stopPropagation() {},

  onAmountInput(e) {
    this.setData({
      amount: e.detail.value || ''
    })
  },

  onNoteInput(e) {
    this.setData({
      note: e.detail.value || ''
    })
  },

  selectCategory(e) {
    this.setData({
      selectedCategory: e.currentTarget.dataset.category
    })
  },

  saveRecord() {
    const { amount, note, selectedCategory, modalType } = this.data
    const value = parseFloat(amount)

    if (!amount || Number.isNaN(value) || value <= 0) {
      wx.showToast({
        title: '请输入正确金额',
        icon: 'none'
      })
      return
    }

    const now = new Date()
    recordStore.appendRecord({
      id: Date.now(),
      type: modalType,
      amount: value.toFixed(2),
      category: selectedCategory,
      note: String(note || '').trim(),
      date: this.formatDate(now),
      time: this.formatTime(now)
    })

    wx.showToast({
      title: '记账成功',
      icon: 'success'
    })

    this.hideModal()
    this.loadData()
  },

  confirmDelete(e) {
    const id = e.currentTarget.dataset.id

    wx.showModal({
      title: '提示',
      content: '确定要删除这条记录吗？',
      success: (res) => {
        if (res.confirm) {
          this.deleteRecord(id)
        }
      }
    })
  },

  deleteRecord(id) {
    const records = recordStore.readRecords().filter((item) => String(item.id) !== String(id))
    recordStore.writeRecords(records)

    wx.showToast({
      title: '删除成功',
      icon: 'success'
    })

    this.loadData()
    this.setData({
      currentSwipeId: null
    })
  },

  onTouchStart(e) {
    const id = e.currentTarget.dataset.id
    this.setData({
      touchStartX: e.touches[0].clientX,
      touchStartY: e.touches[0].clientY,
      currentSwipeId: this.data.currentSwipeId === id ? this.data.currentSwipeId : null
    })
  },

  onTouchMove(e) {
    const touchMoveX = e.touches[0].clientX
    const touchMoveY = e.touches[0].clientY
    const deltaX = this.data.touchStartX - touchMoveX
    const deltaY = Math.abs(this.data.touchStartY - touchMoveY)

    if (deltaX > 30 && deltaX > deltaY) {
      this.setData({
        currentSwipeId: e.currentTarget.dataset.id
      })
    } else if (deltaX < -30 && Math.abs(deltaX) > deltaY) {
      this.setData({
        currentSwipeId: null
      })
    }
  },

  onTouchEnd() {},

  showMonthPicker() {
    this.setData({
      showMonthPicker: true
    })
  },

  hideMonthPicker() {
    this.setData({
      showMonthPicker: false
    })
  },

  prevMonth() {
    const [year, month] = this.data.currentMonth.split('-').map(Number)
    const date = new Date(year, month - 1, 1)
    date.setMonth(date.getMonth() - 1)

    this.setData({
      currentMonth: this.formatMonth(date),
      displayMonth: this.formatDisplayMonth(date)
    })
    this.loadData()
  },

  nextMonth() {
    const [year, month] = this.data.currentMonth.split('-').map(Number)
    const date = new Date(year, month - 1, 1)
    date.setMonth(date.getMonth() + 1)

    this.setData({
      currentMonth: this.formatMonth(date),
      displayMonth: this.formatDisplayMonth(date)
    })
    this.loadData()
  },

  formatDate(date) {
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  },

  formatMonth(date) {
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    return `${year}-${month}`
  },

  formatTime(date) {
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    const hour = String(date.getHours()).padStart(2, '0')
    const minute = String(date.getMinutes()).padStart(2, '0')
    return `${month}-${day} ${hour}:${minute}`
  },

  formatFullTime(date) {
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    const hour = String(date.getHours()).padStart(2, '0')
    const minute = String(date.getMinutes()).padStart(2, '0')
    const second = String(date.getSeconds()).padStart(2, '0')
    return `${year}-${month}-${day} ${hour}:${minute}:${second}`
  },

  formatDisplayMonth(date) {
    const year = date.getFullYear()
    const month = date.getMonth() + 1
    return `${year}年${month}月`
  },

  formatGroupDate(dateString) {
    if (!dateString) return ''
    const date = new Date(`${dateString}T00:00:00`)
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    return `${month}月${day}日 ${WEEKDAY_MAP[date.getDay()]}`
  },

  getWeatherName(code) {
    if ([0].includes(code)) return '晴'
    if ([1, 2, 3].includes(code)) return '多云'
    if ([45, 48].includes(code)) return '雾'
    if ([51, 53, 55, 56, 57].includes(code)) return '毛毛雨'
    if ([61, 63, 65, 66, 67, 80, 81, 82].includes(code)) return '雨'
    if ([71, 73, 75, 77, 85, 86].includes(code)) return '雪'
    if ([95, 96, 99].includes(code)) return '雷雨'
    return '天气良好'
  },

  getDailyMood(date) {
    const quotes = [
      '把每一笔花费看清，也是在把生活过明白。',
      '稳定地向前，比偶尔的热烈更接近答案。',
      '今日认真一点，明日就轻松一点。',
      '钱有去处，心有秩序，日子便有回声。',
      '慢慢来，清醒地选择，坚定地积累。',
      '生活的丰盛，常从一次如实记录开始。',
      '愿你把琐碎安放好，也把热爱留下来。'
    ]

    const index = Math.floor(date.getTime() / 86400000) % quotes.length
    return quotes[index]
  }
})
