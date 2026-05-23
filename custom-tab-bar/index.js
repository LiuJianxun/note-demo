Component({
  data: {
    selected: 0,
    list: [
      {
        pagePath: '/pages/index/index',
        text: '首页',
        iconPath: '/images/tab-home.png',
        selectedIconPath: '/images/tab-home-active.png'
      },
      {
        pagePath: '/pages/ai/ai',
        text: '',
        //iconPath: '/images/tab-schedule.png',
        //selectedIconPath: '/images/tab-schedule-active.png'
        iconPath: '',
        selectedIconPath: ''
      },
      {
        pagePath: '/pages/mine/mine',
        text: '我的',
        iconPath: '/images/tab-mine.png',
        selectedIconPath: '/images/tab-mine-active.png'
      }
    ]
  },

  methods: {
    switchTab(e) {
      const index = e.currentTarget.dataset.index
      const item = this.data.list[index]

      wx.switchTab({
        url: item.pagePath
      })
    }
  }
})
