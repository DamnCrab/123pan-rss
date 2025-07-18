// 通用API响应类型定义
export interface ApiResponse<T = any> {
  success: boolean
  message: string
  data?: T
}

// 分页响应类型
export interface PaginatedResponse<T> {
  list: T[]
  total: number
  page: number
  pageSize: number
}

// 分页查询参数
export interface PaginationParams {
  page?: number
  pageSize?: number
  limit?: number
}

// 搜索参数
export interface SearchParams {
  search?: string
  keyword?: string
}

// 日期范围参数
export interface DateRangeParams {
  startDate?: string
  endDate?: string
}

// 通用ID参数
export interface IdParams {
  id: number | string
}

// 批量操作参数
export interface BatchParams {
  ids: number[]
}

// 文件上传响应
export interface UploadResponse {
  url: string
  filename: string
  size: number
}

// 操作结果响应
export interface OperationResult {
  affected: number
  success: boolean
}

// 状态切换响应
export interface ToggleResult {
  id: number
  status: boolean
}

// 错误响应
export interface ErrorResponse {
  success: false
  message: string
  error?: string
  code?: number
}

// 认证相关类型
export interface AuthToken {
  token: string
  expiresAt?: number
}

export interface UserInfo {
  id: number
  username: string
  email?: string
  avatar?: string
}

export interface LoginResult {
  token: string
  user: UserInfo
}

// 配置相关类型
export interface ConfigItem {
  key: string
  value: any
  description?: string
}

// 统计数据类型
export interface StatsData {
  [key: string]: number | string
}

// 时间戳类型
export type Timestamp = number

// 状态枚举
export enum Status {
  INACTIVE = 0,
  ACTIVE = 1,
  PENDING = 2,
  FAILED = 3,
  COMPLETED = 4
}

// 时间单位类型
export type TimeUnit = 'minutes' | 'hours' | 'days'

// 文件类型枚举
export enum FileType {
  FILE = 0,
  FOLDER = 1
}

// 下载状态枚举
export enum DownloadStatus {
  PENDING = 'pending',
  DOWNLOADING = 'downloading',
  COMPLETED = 'completed',
  FAILED = 'failed',
  PAUSED = 'paused'
}