const STORAGE_KEY = 'records'
const BACKUP_FILE = 'records-backup.json'

function getBackupPath() {
  return `${wx.env.USER_DATA_PATH}/${BACKUP_FILE}`
}

function normalizeRecords(records) {
  return Array.isArray(records) ? records : []
}

function readBackupSync() {
  const fs = wx.getFileSystemManager()

  try {
    const content = fs.readFileSync(getBackupPath(), 'utf8')
    const parsed = JSON.parse(content)
    return normalizeRecords(Array.isArray(parsed) ? parsed : parsed.records)
  } catch (error) {
    return []
  }
}

function writeBackupSync(records) {
  const fs = wx.getFileSystemManager()
  const payload = {
    version: 1,
    updatedAt: new Date().toISOString(),
    records: normalizeRecords(records)
  }

  try {
    fs.writeFileSync(getBackupPath(), JSON.stringify(payload, null, 2), 'utf8')
  } catch (error) {
    console.warn('写入记账备份失败', error)
  }
}

function readRecords() {
  const cached = wx.getStorageSync(STORAGE_KEY)

  if (Array.isArray(cached) && cached.length > 0) {
    return cached
  }

  const backupRecords = readBackupSync()

  if (backupRecords.length > 0) {
    wx.setStorageSync(STORAGE_KEY, backupRecords)
  }

  return normalizeRecords(cached).length > 0 ? cached : backupRecords
}

function writeRecords(records) {
  const safeRecords = normalizeRecords(records)
  wx.setStorageSync(STORAGE_KEY, safeRecords)
  writeBackupSync(safeRecords)
  return safeRecords
}

function appendRecord(record) {
  const records = readRecords()
  records.push(record)
  return writeRecords(records)
}

function clearRecords() {
  return writeRecords([])
}

function importRecordsFromFile(filePath) {
  const fs = wx.getFileSystemManager()
  const content = fs.readFileSync(filePath, 'utf8')
  const parsed = JSON.parse(content)
  const records = normalizeRecords(Array.isArray(parsed) ? parsed : parsed.records)

  writeRecords(records)
  return records
}

module.exports = {
  getBackupPath,
  readRecords,
  writeRecords,
  appendRecord,
  clearRecords,
  importRecordsFromFile
}
