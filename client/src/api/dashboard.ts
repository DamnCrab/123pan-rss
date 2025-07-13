import request from './request'
import type { ApiResponse, StatsData } from './types'

// Dashboard统计数据接口
export interface DashboardStats extends StatsData {
  rssCount: number
  downloadCount: number
  pendingCount: number
  failedCount: number
  completedCount: number
  downloadingCount: number
}

// 获取Dashboard统计数据
export const getDashboardStats = (): Promise<ApiResponse<DashboardStats>> => {
  return request.get('/api/dashboard/stats')
}