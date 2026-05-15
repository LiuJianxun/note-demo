// pages/index/index.js
Page({
  data: {
    todayIncome: '0.00',
    todayExpense: '0.00',
    monthIncome: '0.00',
    monthExpense: '0.00',
    recentRecords: [],
    showModal: false,
    modalType: 'income', // income 或 expense
    amount: '',
    note: '',
    selectedCategory: '',
    categories: [],
    incomeCategories: ['工资', '红包', '兼职', '其他'],
    expenseCategories: ['餐饮', '交通', '购物', '娱乐', '其他'],
    touchStartX: 0,
    touchStartY: 0,
    currentSwipeId: null,
    showMonthPicker: false,
    currentMonth: '',
    displayMonth: ''
  },

  onLoad() {
    const now = new Date()
    const currentMonth = this.formatMonth(now)
    this.setData({
      currentMonth: currentMonth,
      displayMonth: this.formatDisplayMonth(now)
    })
    this.loadData()
  },

  onShow() {
    this.loadData()
  },

  // 加载数据
  loadData() {
    const records = wx.getStorageSync('records') || []

    // 计算今日收支
    const today = this.formatDate(new Date())
    let todayIncome = 0
    let todayExpense = 0

    // 计算本月收支（使用当前选择的月份）
    const currentMonth = this.data.currentMonth
    let monthIncome = 0
    let monthExpense = 0

    // 筛选当前月份的记录
    const monthRecords = []

    records.forEach(record => {
      const recordDate = record.date
      const recordMonth = recordDate.substring(0, 7)
      const amount = parseFloat(record.amount)

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

    // 获取当前月份最近5条记录
    const recentRecords = monthRecords.slice(-5).reverse()

    this.setData({
      todayIncome: todayIncome.toFixed(2),
      todayExpense: todayExpense.toFixed(2),
      monthIncome: monthIncome.toFixed(2),
      monthExpense: monthExpense.toFixed(2),
      recentRecords
    })
  },

  // 显示收入弹窗
  showIncomeModal() {
    this.setData({
      showModal: true,
      modalType: 'income',
      categories: this.data.incomeCategories,
      selectedCategory: this.data.incomeCategories[0],
      amount: '',
      note: ''
    })
  },

  // 显示支出弹窗
  showExpenseModal() {
    this.setData({
      showModal: true,
      modalType: 'expense',
      categories: this.data.expenseCategories,
      selectedCategory: this.data.expenseCategories[0],
      amount: '',
      note: ''
    })
  },

  // 隐藏弹窗
  hideModal() {
    this.setData({
      showModal: false
    })
  },

  // 阻止冒泡
  stopPropagation() {},

  // 输入金额
  onAmountInput(e) {
    this.setData({
      amount: e.detail.value
    })
  },

  // 输入备注
  onNoteInput(e) {
    this.setData({
      note: e.detail.value
    })
  },

  // 选择分类
  selectCategory(e) {
    this.setData({
      selectedCategory: e.currentTarget.dataset.category
    })
  },

  // 保存记录
  saveRecord() {
    const { amount, note, selectedCategory, modalType } = this.data

    if (!amount || parseFloat(amount) <= 0) {
      wx.showToast({
        title: '请输入正确的金额',
        icon: 'none'
      })
      return
    }

    const records = wx.getStorageSync('records') || []
    const now = new Date()

    const newRecord = {
      id: Date.now(),
      type: modalType,
      amount: parseFloat(amount).toFixed(2),
      category: selectedCategory,
      note: note || '',
      date: this.formatDate(now),
      time: this.formatTime(now)
    }

    records.push(newRecord)
    wx.setStorageSync('records', records)

    wx.showToast({
      title: '记账成功',
      icon: 'success'
    })

    this.hideModal()
    this.loadData()
  },

  // 确认删除
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

  // 删除记录
  deleteRecord(id) {
    let records = wx.getStorageSync('records') || []
    records = records.filter(item => item.id !== id)
    wx.setStorageSync('records', records)

    wx.showToast({
      title: '删除成功',
      icon: 'success'
    })

    this.loadData()
  },

  // 格式化日期 YYYY-MM-DD
  formatDate(date) {
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  },

  // 格式化月份 YYYY-MM
  formatMonth(date) {
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    return `${year}-${month}`
  },

  // 格式化时间 MM-DD HH:mm
  formatTime(date) {
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    const hour = String(date.getHours()).padStart(2, '0')
    const minute = String(date.getMinutes()).padStart(2, '0')
    return `${month}-${day} ${hour}:${minute}`
  },

  // 触摸开始
  onTouchStart(e) {
    this.setData({
      touchStartX: e.touches[0].clientX,
      touchStartY: e.touches[0].clientY
    })
  },

  // 触摸移动
  onTouchMove(e) {
    const touchMoveX = e.touches[0].clientX
    const touchMoveY = e.touches[0].clientY
    const deltaX = this.data.touchStartX - touchMoveX
    const deltaY = Math.abs(this.data.touchStartY - touchMoveY)

    // 判断是否为左滑操作（横向滑动距离大于纵向，且向左滑动超过30px）
    if (deltaX > 30 && deltaX > deltaY) {
      const id = e.currentTarget.dataset.id
      this.setData({
        currentSwipeId: id
      })
    } else if (deltaX < -30 && deltaX < -deltaY) {
      // 向右滑动，关闭删除按钮
      this.setData({
        currentSwipeId: null
      })
    }
  },

  // 触摸结束
  onTouchEnd() {
    // 可以在这里添加额外的逻辑
  },

  // 显示月份选择器
  showMonthPicker() {
    this.setData({
      showMonthPicker: true
    })
  },

  // 隐藏月份选择器
  hideMonthPicker() {
    this.setData({
      showMonthPicker: false
    })
  },

  // 上一个月
  prevMonth() {
    const [year, month] = this.data.currentMonth.split('-').map(Number)
    const date = new Date(year, month - 1, 1)
    date.setMonth(date.getMonth() - 1)

    const newMonth = this.formatMonth(date)
    this.setData({
      currentMonth: newMonth,
      displayMonth: this.formatDisplayMonth(date)
    })
    this.loadData()
  },

  // 下一个月
  nextMonth() {
    const [year, month] = this.data.currentMonth.split('-').map(Number)
    const date = new Date(year, month - 1, 1)
    date.setMonth(date.getMonth() + 1)

    const newMonth = this.formatMonth(date)
    this.setData({
      currentMonth: newMonth,
      displayMonth: this.formatDisplayMonth(date)
    })
    this.loadData()
  },

  // 格式化显示月份 YYYY年MM月
  formatDisplayMonth(date) {
    const year = date.getFullYear()
    const month = date.getMonth() + 1
    return `${year}年${month}月`
  }
})
