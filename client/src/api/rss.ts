import request from './request'

// RSS订阅接口
export interface RSSSubscription {
  id: number
  userId: number
  rssUrl: string
  fatherFolderId: string
  fatherFolderName: string
  cloudFolderName: string
  refreshInterval: number
  refreshUnit: 'minutes' | 'hours'
  isActive: number
  lastRefresh: number | null
  createdAt: number
  updatedAt: number
}

export interface CreateRSSSubscriptionParams {
  rssUrl: string
  fatherFolderId: string
  fatherFolderName: string
  cloudFolderName: string
  refreshInterval: number
  refreshUnit: 'minutes' | 'hours'
  isActive?: boolean
}

export interface UpdateRSSSubscriptionParams {
  id: number
  rssUrl?: string
  fatherFolderId?: string
  fatherFolderName?: string
  cloudFolderName?: string
  refreshInterval?: number
  refreshUnit?: 'minutes' | 'hours'
  isActive?: boolean
}

// 获取RSS订阅列表
export const getRSSSubscriptions = (params?: { page?: number; limit?: number; search?: string }) => {
  return request.get('/api/rss', { params })
}

// 创建RSS订阅
export const createRSSSubscription = (data: CreateRSSSubscriptionParams) => {
  return request.post('/api/rss', data)
}

// 更新RSS订阅
export const updateRSSSubscription = (data: UpdateRSSSubscriptionParams) => {
  const { id, ...updateData } = data
  return request.put('/api/rss/update', updateData, { params: { id: id.toString() } })
}

// 删除RSS订阅
export const deleteRSSSubscription = (id: number) => {
  return request.delete('/api/rss/remove', { params: { id: id.toString() } })
}

// 切换RSS订阅状态
export const toggleRSSSubscription = (id: number) => {
  return request.patch('/api/rss/toggle', {}, { params: { id: id.toString() } })
}

// 刷新RSS订阅
export const refreshRSSSubscription = (id: number) => {
  return request.post(`/api/rss/${id}/refresh`)
}

// RSS条目接口
export interface RSSItem {
  id: number
  title: string
  link: string
  description?: string
  pubDate: string
  sourceId: number
  sourceName: string
  createdAt: string
}

// 获取RSS条目列表
export const getRSSItems = (params?: {
  page?: number
  pageSize?: number
  sourceId?: number
  keyword?: string
  startDate?: string
  endDate?: string
}) => {
  return request.get<{
    list: RSSItem[]
    total: number
    page: number
    pageSize: number
  }>('/api/rss/items', { params })
}