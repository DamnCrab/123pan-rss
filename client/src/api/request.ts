import axios from 'axios'
import type { AxiosInstance, AxiosRequestConfig, AxiosResponse, InternalAxiosRequestConfig } from 'axios'
import { useMessage } from 'naive-ui'
import { addSecurityHeaders } from '@/utils/crypto'
import { useUserStore } from '@/stores/user'
import { JWT_ERROR_CODES, HTTP_STATUS, ERROR_MESSAGES } from '@/constants/api'
import { appConfig, devError } from '@/config'

// 创建axios实例
const request: AxiosInstance = axios.create({
  baseURL: appConfig.apiBaseUrl,
  timeout: appConfig.timeout,
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true, // 允许携带cookie
})

// 请求拦截器
request.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    // 从用户store获取token
    const userStore = useUserStore()
    const token = userStore.token
    
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
    
    // 添加安全头
    addSecurityHeaders(config.headers)
    
    return config
  },
  (error) => {
    return Promise.reject(error)
  }
)

// 响应拦截器
request.interceptors.response.use(
  (response: AxiosResponse) => {
    // 返回响应数据而不是完整的response对象
    return response.data
  },
  (error) => {
    const message = useMessage()
    const userStore = useUserStore()
    
    // 开发环境下记录错误详情
    devError('API Request Error:', error)
    
    if (error.response) {
      const { status, data } = error.response
      
      switch (status) {
        case HTTP_STATUS.UNAUTHORIZED:
          // 检查是否是JWT相关错误
          const jwtErrorCodes = Object.values(JWT_ERROR_CODES)
          if (data?.code && jwtErrorCodes.includes(data.code)) {
            // JWT失效，自动退出登录
            userStore.logout()
            message.error(ERROR_MESSAGES.LOGIN_EXPIRED)
            
            // 跳转到登录页面
            if (window.location.pathname !== '/login') {
              window.location.href = '/login'
            }
          } else {
            message.error(ERROR_MESSAGES.UNAUTHORIZED)
          }
          break
        case HTTP_STATUS.FORBIDDEN:
          message.error(ERROR_MESSAGES.FORBIDDEN)
          break
        case HTTP_STATUS.NOT_FOUND:
          message.error(ERROR_MESSAGES.NOT_FOUND)
          break
        case HTTP_STATUS.INTERNAL_SERVER_ERROR:
          message.error(ERROR_MESSAGES.SERVER_ERROR)
          break
        default:
          message.error(data?.message || ERROR_MESSAGES.REQUEST_FAILED)
      }
    } else if (error.request) {
      message.error(ERROR_MESSAGES.NETWORK_ERROR)
    } else {
      message.error(ERROR_MESSAGES.CONFIG_ERROR)
    }
    
    return Promise.reject(error)
  }
)

export default request
