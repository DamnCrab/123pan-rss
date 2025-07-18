import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { devLog } from '@/config'
import { isUserInfo, safeGetFromStorage, safeSetToStorage } from '@/utils/guards'

// 用户信息类型定义
export interface UserInfo {
  id: number
  username: string
  email?: string
  avatar?: string
  role?: string
  createdAt?: string
  updatedAt?: string
}

// 用户状态类型定义
interface UserState {
  token: string | null
  userInfo: UserInfo | null
}

export const useUserStore = defineStore('user', () => {
  // 状态
  const token = ref<string | null>(null)
  const userInfo = ref<UserInfo | null>(null)

  // 计算属性
  const isLoggedIn = computed(() => !!token.value)
  const hasUserInfo = computed(() => !!userInfo.value)

  // 操作方法
  const setToken = (newToken: string | null) => {
    token.value = newToken
    if (newToken) {
      safeSetToStorage('token', newToken)
      devLog('Token set:', newToken.substring(0, 20) + '...')
    } else {
      localStorage.removeItem('token')
      devLog('Token removed')
    }
  }

  const setUserInfo = (info: UserInfo | null) => {
    // 验证用户信息的类型安全性
    if (info && !isUserInfo(info)) {
      devLog('Invalid user info provided:', info)
      return
    }
    
    userInfo.value = info
    if (info) {
      safeSetToStorage('userInfo', info)
    } else {
      localStorage.removeItem('userInfo')
    }
    devLog('User info updated:', info)
  }

  const logout = () => {
    token.value = null
    userInfo.value = null
    localStorage.removeItem('token')
    localStorage.removeItem('userInfo')
    devLog('User logged out')
  }

  const hasToken = () => {
    return !!token.value || !!localStorage.getItem('token')
  }

  // 初始化时从localStorage恢复数据
  const initializeFromStorage = () => {
    // 恢复token
    const storedToken = localStorage.getItem('token')
    if (storedToken) {
      token.value = storedToken
      devLog('Token restored from localStorage')
    }
    
    // 恢复用户信息
    const storedUserInfo = safeGetFromStorage('userInfo', isUserInfo)
    if (storedUserInfo) {
      userInfo.value = storedUserInfo
      devLog('User info restored from localStorage')
    }
  }

  // 获取当前状态快照
  const getState = (): UserState => ({
    token: token.value,
    userInfo: userInfo.value
  })

  // 清除所有存储的数据
  const clearStorage = () => {
    const keysToRemove = ['token', 'userInfo']
    keysToRemove.forEach(key => {
      try {
        localStorage.removeItem(key)
      } catch (error) {
        devLog(`Failed to remove ${key} from localStorage:`, error)
      }
    })
  }

  return {
    // 状态
    token,
    userInfo,
    
    // 计算属性
    isLoggedIn,
    hasUserInfo,
    
    // 方法
    setToken,
    setUserInfo,
    logout,
    hasToken,
    initializeFromStorage,
    getState,
    clearStorage
  }
})