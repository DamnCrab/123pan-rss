import request from './request'

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

// 文件信息接口
export interface FileInfo {
  fileId: number
  filename: string
  type: number // 0-文件，1-文件夹
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
export const getCloud123Config = () => {
  return request.get<Cloud123Config>('/api/cloud123/config')
}

// 获取123云盘状态
export const getCloud123Status = () => {
  return request.get<Cloud123Status>('/api/cloud123/status')
}

// 配置123云盘客户端信息
export const configCloud123 = (data: ConfigCloud123Params) => {
  return request.post('/api/cloud123/config', data)
}

// 获取文件列表
export const getFileList = (params?: FileListQuery) => {
  return request.get<FileListResponse>('/api/cloud123/files', { params })
}

// 创建文件夹
export const createFolder = (data: CreateFolderParams) => {
  return request.post('/api/cloud123/folder', data)
}

// 删除文件
export const deleteFiles = (fileIds: number[]) => {
  return request.delete('/api/cloud123/files', { data: { fileIds } })
}

// 移动文件到回收站
export const trashFiles = (fileIds: number[]) => {
  return request.post('/api/cloud123/trash', { fileIds })
}

// 从回收站恢复文件
export const restoreFiles = (fileIds: number[]) => {
  return request.post('/api/cloud123/restore', { fileIds })
}