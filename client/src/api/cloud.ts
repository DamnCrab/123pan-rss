import request from './request'
import type { ApiResponse, FileType, BatchParams } from './types'

// 123云盘配置接口
export interface Cloud123Config {
  accessToken: string
  configured: boolean
}

// 123云盘状态接口
export interface Cloud123Status {
  configured: boolean
  hasValidToken: boolean
  tokenExpiredAt: number | null
  clientId: string | null
}

// VIP信息接口
export interface VipInfo {
  isVip: boolean
  vipLevel: number | null
  vipLabel: string | null
  vipExpiredAt: number | null
}

// 开发者信息接口
export interface DeveloperInfo {
  isDeveloper: boolean
  developerExpiredAt: number | null
}

// 空间信息接口
export interface SpaceInfo {
  usedSize: number
  totalSize: number
  tempSize: number
  tempExpiredAt: string
}

// 用户信息接口
export interface Cloud123UserInfo {
  uid: number
  nickname: string
  passport: string // 已脱敏的手机号
  mail: string // 已脱敏的邮箱
  avatar: string
  spaceInfo: SpaceInfo
  vipInfo: VipInfo
  developerInfo: DeveloperInfo
  directTraffic: number
  isHideUID: boolean
  httpsCount: number
  createTime: number
  updateTime: number
}

// 文件信息接口
export interface FileInfo {
  fileId: number
  filename: string
  type: FileType // 0-文件，1-文件夹
  size: number
  etag: string
  status: number
  parentFileId: number
  category: number
  trashed: number // 0-否，1-是
}

// 文件列表响应接口
export interface FileListResponse {
  lastFileId: number // -1表示最后一页
  fileList: FileInfo[]
}

// 文件列表查询参数
export interface FileListQuery {
  parentFileId?: number
  limit?: number
  searchData?: string
  trashed?: boolean
  searchMode?: number
  lastFileId?: number
}

// 配置123云盘客户端信息参数
export interface ConfigCloud123Params {
  clientId: string
  clientSecret: string
}

// 创建文件夹参数
export interface CreateFolderParams {
  parentFileId: number
  name: string
}

// 获取123云盘配置
export const getCloud123Config = (): Promise<ApiResponse<Cloud123Config>> => {
  return request.get('/api/cloud123/config')
}

// 获取123云盘状态
export const getCloud123Status = (): Promise<ApiResponse<Cloud123Status>> => {
  return request.get('/api/cloud123/status')
}

// 获取123云盘用户信息
export const getCloud123UserInfo = (): Promise<ApiResponse<Cloud123UserInfo>> => {
  return request.get('/api/cloud123/user/info')
}

// 配置123云盘客户端信息
export const configCloud123 = (data: ConfigCloud123Params): Promise<ApiResponse> => {
  return request.post('/api/cloud123/config', data)
}

// 获取文件列表
export const getFileList = (params?: FileListQuery): Promise<ApiResponse<FileListResponse>> => {
  return request.get('/api/cloud123/files', { params })
}

// 创建文件夹
export const createFolder = (data: CreateFolderParams): Promise<ApiResponse<FileInfo>> => {
  return request.post('/api/cloud123/folder', data)
}

// 删除文件
export const deleteFiles = (fileIds: number[]): Promise<ApiResponse> => {
  return request.delete('/api/cloud123/files', { data: { fileIds } })
}

// 移动文件到回收站
export const trashFiles = (fileIds: number[]): Promise<ApiResponse> => {
  return request.post('/api/cloud123/trash', { fileIds })
}

// 从回收站恢复文件
export const restoreFiles = (fileIds: number[]): Promise<ApiResponse> => {
  return request.post('/api/cloud123/restore', { fileIds })
}