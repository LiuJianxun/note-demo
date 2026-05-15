// pages/mine/mine.js
Page({
  data: {
    monthIncome: '0.00',
    monthExpense: '0.00',
    balance: '0.00',
    showAllRecords: false,
    allRecords: []
  },

  onLoad() {
    this.loadData()
  },

  onShow() {
    this.loadData()
  },

  // 加载数据
  loadData() {
    const records = wx.getStorageSync('records') || []

    // 计算本月收支
    const currentMonth = this.formatMonth(new Date())
    let monthIncome = 0
    let monthExpense = 0

    records.forEach(record => {
      const recordMonth = record.date.substring(0, 7)
      const amount = parseFloat(record.amount)

      if (recordMonth === currentMonth) {
        if (record.type === 'income') {
          monthIncome += amount
        } else {
          monthExpense += amount
        }
      }
    })

    const balance = monthIncome - monthExpense

    this.setData({
      monthIncome: monthIncome.toFixed(2),
      monthExpense: monthExpense.toFixed(2),
      balance: balance.toFixed(2)
    })
  },

  // 查看全部账单
  goToAllRecords() {
    const records = wx.getStorageSync('records') || []
    const allRecords = records.reverse()

    this.setData({
      showAllRecords: true,
      allRecords
    })
  },

  // 隐藏全部账单
  hideAllRecords() {
    this.setData({
      showAllRecords: false
    })
  },

  // 阻止冒泡
  stopPropagation() {},

  // 清空所有数据
  clearAllData() {
    wx.showModal({
      title: '确认清空',
      content: '确定要清空所有记账数据吗？此操作不可恢复！',
      confirmText: '确定清空',
      confirmColor: '#e74c3c',
      success: (res) => {
        if (res.confirm) {
          wx.setStorageSync('records', [])
          wx.showToast({
            title: '清空成功',
            icon: 'success'
          })
          this.loadData()
        }
      }
    })
  },

  // 关于小程序
  showAbout() {
    wx.showModal({
      title: '关于小程序',
      content: '日常记账小程序 v1.0\n\n一款简洁实用的记账工具，帮助你轻松管理日常收支。\n\n数据存储在本地，安全可靠。',
      showCancel: false,
      confirmText: '知道了'
    })
  },

  // 格式化月份 YYYY-MM
  formatMonth(date) {
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    return `${year}-${month}`
  }
})
