import request from './request'

// 磁力链接接口
export interface MagnetLink {
  id: number
  rssSubscriptionId: number
  title: string
  magnetLink: string
  webLink: string | null
  author: string | null
  category: string | null
  pubDate: number | null
  description: string | null
  size: string | null
  createdAt: number
  // 离线下载相关字段
  downloadTaskId: string | null
  downloadStatus: 'pending' | 'downloading' | 'completed' | 'failed'
  downloadFileId: string | null
  downloadFailReason: string | null
  downloadCreatedAt: number | null
  downloadCompletedAt: number | null
}

// 磁力链接列表查询参数
export interface MagnetListQuery {
  rssId?: string
  pageNum?: string
  pageSize?: string
}

// 批量重试参数
export interface BatchRetryParams {
  magnetIds: number[]
}

// 获取磁力链接列表
export const getMagnetLinks = (params?: MagnetListQuery) => {
  return request.get('/api/magnet', { params })
}

// 手动刷新RSS订阅
export const refreshRSSSubscription = (rssId: number) => {
  return request.post(`/api/magnet/refresh/${rssId}`)
}

// 批量重试下载任务
export const batchRetryDownload = (data: BatchRetryParams) => {
  return request.post('/api/cloud123/batch-retry', data)
}

// 删除磁力链接
export const deleteMagnetLink = (id: number) => {
  return request.delete(`/api/magnet/${id}`)
}

// 创建离线下载任务
export const createOfflineDownload = (magnetId: number) => {
  return request.post(`/api/magnet/${magnetId}/download`)
}

// 获取下载任务列表
export const getDownloadTasks = (params?: { page?: number; limit?: number; status?: string; keyword?: string }) => {
  return request.get('/api/cloud123/downloads', { params })
}

// 删除下载任务
export const deleteDownloadTask = (id: number) => {
  return request.delete(`/api/cloud123/downloads/${id}`)
}