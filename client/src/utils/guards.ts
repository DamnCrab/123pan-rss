// 类型守卫工具
import type { UserInfo } from '@/stores/user'
import type { ApiResponse } from '@/api/types'

// 基础类型守卫
export const isString = (value: unknown): value is string => {
  return typeof value === 'string'
}

export const isNumber = (value: unknown): value is number => {
  return typeof value === 'number' && !isNaN(value)
}

export const isBoolean = (value: unknown): value is boolean => {
  return typeof value === 'boolean'
}

export const isObject = (value: unknown): value is Record<string, unknown> => {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

export const isArray = (value: unknown): value is unknown[] => {
  return Array.isArray(value)
}

// 业务类型守卫
export const isUserInfo = (value: unknown): value is UserInfo => {
  if (!isObject(value)) return false
  
  return (
    isNumber(value.id) &&
    isString(value.username) &&
    (value.email === undefined || isString(value.email)) &&
    (value.avatar === undefined || isString(value.avatar)) &&
    (value.role === undefined || isString(value.role)) &&
    (value.createdAt === undefined || isString(value.createdAt)) &&
    (value.updatedAt === undefined || isString(value.updatedAt))
  )
}

export const isApiResponse = <T>(
  value: unknown,
  dataValidator?: (data: unknown) => data is T
): value is ApiResponse<T> => {
  if (!isObject(value)) return false
  
  const hasRequiredFields = (
    isBoolean(value.success) &&
    isString(value.message)
  )
  
  if (!hasRequiredFields) return false
  
  // 如果提供了数据验证器，验证data字段
  if (dataValidator && value.data !== undefined) {
    return dataValidator(value.data)
  }
  
  return true
}

// 安全的类型转换
export const safeParseJSON = <T>(
  jsonString: string,
  validator?: (value: unknown) => value is T
): T | null => {
  try {
    const parsed = JSON.parse(jsonString)
    
    if (validator && !validator(parsed)) {
      console.warn('Parsed JSON does not match expected type')
      return null
    }
    
    return parsed
  } catch (error) {
    console.error('Failed to parse JSON:', error)
    return null
  }
}

// 安全的localStorage操作
export const safeGetFromStorage = <T>(
  key: string,
  validator?: (value: unknown) => value is T
): T | null => {
  try {
    const item = localStorage.getItem(key)
    if (!item) return null
    
    return safeParseJSON(item, validator)
  } catch (error) {
    console.error(`Failed to get item from localStorage: ${key}`, error)
    return null
  }
}

export const safeSetToStorage = (key: string, value: unknown): boolean => {
  try {
    localStorage.setItem(key, JSON.stringify(value))
    return true
  } catch (error) {
    console.error(`Failed to set item to localStorage: ${key}`, error)
    return false
  }
}

// 网络状态检查
export const isOnline = (): boolean => {
  return navigator.onLine
}

// URL验证
export const isValidUrl = (url: string): boolean => {
  try {
    new URL(url)
    return true
  } catch {
    return false
  }
}

// 邮箱验证
export const isValidEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return emailRegex.test(email)
}