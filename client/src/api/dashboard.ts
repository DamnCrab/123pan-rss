import request from './request'

// Dashboard统计数据接口
export interface DashboardStats {
  rssCount: number
  downloadCount: number
  pendingCount: number
  failedCount: number
  completedCount: number
  downloadingCount: number
}

// 获取Dashboard统计数据
export const getDashboardStats = () => {
  return request.get<DashboardStats>('/api/dashboard/stats')
}