const recordStore = require('../../utils/record-store')
const shareConfig = require('../../utils/share-config')

const CHECK_IN_HISTORY_KEY = 'checkInHistory'

Page({
  data: {
    navBarMetrics: {},
    monthIncome: '0.00',
    monthExpense: '0.00',
    balance: '0.00',
    showAllRecords: false,
    allRecords: [],
    userInfo: null,
    checkedInToday: false,
    consecutiveCheckInDays: 0,
    recordDays: 0,
    totalRecordCount: 0
  },

  onLoad(options) {
    const navBarMetrics = getApp().getNavBarMetrics ? getApp().getNavBarMetrics() : {}
    this.shareContext = shareConfig.parseShareOptions(options)

    this.setData({
      navBarMetrics
    })
    this.enableShareMenus()
    this.loadUserInfo()
    this.loadData()
    this.loadCheckInStats()
  },

  onShow() {
    this.loadUserInfo()
    this.loadData()
    this.loadCheckInStats()

    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({
        selected: 2
      })
    }
  },

  enableShareMenus() {
    shareConfig.setupShareMenu()
  },

  onShareAppMessage() {
    return shareConfig.buildShareAppMessage('pages/mine/mine')
  },

  onShareTimeline() {
    return shareConfig.buildShareTimeline('pages/mine/mine')
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
    const currentMonth = this.formatMonth(new Date())
    let monthIncome = 0
    let monthExpense = 0

    records.forEach((record) => {
      const recordMonth = String(record.date || '').slice(0, 7)
      const amount = parseFloat(record.amount || 0)

      if (recordMonth === currentMonth) {
        if (record.type === 'income') {
          monthIncome += amount
        } else {
          monthExpense += amount
        }
      }
    })

    const balance = monthIncome - monthExpense
    const recordDays = new Set(records.map((record) => record.date).filter(Boolean)).size

    this.setData({
      monthIncome: monthIncome.toFixed(2),
      monthExpense: monthExpense.toFixed(2),
      balance: balance.toFixed(2),
      recordDays,
      totalRecordCount: records.length
    })
  },

  loadCheckInStats() {
    const today = this.formatDate(new Date())
    const history = this.getCheckInHistory()

    this.setData({
      checkedInToday: history.includes(today),
      consecutiveCheckInDays: this.calculateConsecutiveDays(history)
    })
  },

  getCheckInHistory() {
    const history = wx.getStorageSync(CHECK_IN_HISTORY_KEY)
    if (!Array.isArray(history)) return []

    return Array.from(new Set(history.filter(Boolean))).sort()
  },

  saveCheckInHistory(history) {
    wx.setStorageSync(CHECK_IN_HISTORY_KEY, Array.from(new Set(history.filter(Boolean))).sort())
  },

  calculateConsecutiveDays(history) {
    if (!history.length) return 0

    const historySet = new Set(history)
    const today = new Date()
    let cursor = new Date(today.getFullYear(), today.getMonth(), today.getDate())
    let count = 0

    if (!historySet.has(this.formatDate(cursor))) {
      cursor.setDate(cursor.getDate() - 1)
    }

    while (historySet.has(this.formatDate(cursor))) {
      count += 1
      cursor.setDate(cursor.getDate() - 1)
    }

    return count
  },

  handleCheckIn() {
    const today = this.formatDate(new Date())
    const history = this.getCheckInHistory()

    if (history.includes(today)) {
      wx.showToast({
        title: '今日已打卡',
        icon: 'none'
      })
      return
    }

    history.push(today)
    this.saveCheckInHistory(history)
    this.loadCheckInStats()

    wx.showToast({
      title: '今日打卡成功',
      icon: 'success'
    })
  },

  goToAllRecords() {
    const records = recordStore.readRecords()

    this.setData({
      showAllRecords: true,
      allRecords: records.slice().reverse()
    })
  },

  hideAllRecords() {
    this.setData({
      showAllRecords: false
    })
  },

  stopPropagation() {},

  clearAllData() {
    wx.showModal({
      title: '确认清空',
      content: '确定要清空所有记账数据吗？此操作不可恢复。',
      confirmText: '确认清空',
      confirmColor: '#e74c3c',
      success: (res) => {
        if (!res.confirm) return

        recordStore.clearRecords()
        wx.showToast({
          title: '清空成功',
          icon: 'success'
        })

        this.loadData()
      }
    })
  },

  exportBackup() {
    const records = recordStore.readRecords()
    recordStore.writeRecords(records)
    const filePath = recordStore.getBackupPath()

    if (wx.shareFileMessage) {
      wx.shareFileMessage({
        filePath,
        fileName: '记账数据备份.json',
        success: () => {
          wx.showToast({
            title: '已生成备份',
            icon: 'success'
          })
        },
        fail: () => {
          wx.showModal({
            title: '备份文件已生成',
            content: filePath,
            showCancel: false
          })
        }
      })
      return
    }

    wx.showModal({
      title: '备份文件已生成',
      content: filePath,
      showCancel: false
    })
  },

  importBackup() {
    wx.chooseMessageFile({
      count: 1,
      type: 'file',
      extension: ['json'],
      success: (res) => {
        const file = res.tempFiles && res.tempFiles[0]

        if (!file || !file.path) {
          wx.showToast({
            title: '未选择备份文件',
            icon: 'none'
          })
          return
        }

        try {
          const records = recordStore.importRecordsFromFile(file.path)
          wx.showToast({
            title: `已恢复${records.length}条`,
            icon: 'success'
          })
          this.loadData()
        } catch (error) {
          wx.showToast({
            title: '备份文件无效',
            icon: 'none'
          })
        }
      }
    })
  },

  showAbout() {
    wx.showModal({
      title: '关于小程序',
      content: '日常记账小程序 v1.0\n\n一款简洁实用的记账工具，帮助你轻松管理日常收支。\n\n数据存储在本地，安全可靠。',
      showCancel: false,
      confirmText: '知道了'
    })
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
  }
})
