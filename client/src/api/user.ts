import request from './request'

// 用户登录
export interface LoginParams {
  username: string
  password: string
}

export interface LoginResponse {
  success: boolean
  message: string
  data: {
    token: string
    user: {
      id: number
      username: string
    }
  }
}

export const login = (data: LoginParams) => {
  return request.post<LoginResponse>('/api/user/login', data)
}

// 获取用户信息
export interface UserProfile {
  success: boolean
  message: string
  data: {
    id: number
    username: string
  }
}

export const getUserProfile = () => {
  return request.get<UserProfile>('/api/user/profile')
}

// 用户登出
export const logout = () => {
  return request.post('/api/user/logout')
}

// 修改密码
export interface ChangePasswordParams {
  oldPassword: string
  newPassword: string
}

export const changePassword = (data: ChangePasswordParams) => {
  return request.post('/api/user/change-password', data)
}