import request from './request'
import type { ApiResponse, LoginResult, UserInfo } from './types'

// 用户登录
export interface LoginParams {
  username: string
  password: string
}

export const login = (data: LoginParams): Promise<ApiResponse<LoginResult>> => {
  return request.post('/api/user/login', data)
}

// 获取用户信息
export const getUserProfile = (): Promise<ApiResponse<UserInfo>> => {
  return request.get('/api/user/profile')
}

// 用户登出
export const logout = (): Promise<ApiResponse> => {
  return request.post('/api/user/logout')
}

// 修改密码
export interface ChangePasswordParams {
  oldPassword: string
  newPassword: string
}

export const changePassword = (data: ChangePasswordParams): Promise<ApiResponse> => {
  return request.put('/api/user/password', data)
}