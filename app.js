// app.js
App({
  onLaunch() {
    // 初始化本地存储
    const records = wx.getStorageSync('records')
    if (!records) {
      wx.setStorageSync('records', [])
    }
  },

  globalData: {
    userInfo: null
  }
})
