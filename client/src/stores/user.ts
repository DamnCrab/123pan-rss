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
      // 不再保存token到localStorage，因为使用cookie认证
      devLog('Authentication status set')
    } else {
      // 清除可能存在的旧token
      localStorage.removeItem('token')
      devLog('Authentication status cleared')
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
    return !!token.value
  }

  // 初始化时通过API验证登录状态
  const initializeFromStorage = async () => {
    try {
      // 尝试通过API获取用户信息来验证登录状态
      const response = await fetch('/api/user/profile', {
        credentials: 'include'
      })
      
      if (response.ok) {
        const result = await response.json()
        if (result.success && result.data) {
          // 设置一个虚拟token表示已登录状态
          token.value = 'authenticated'
          userInfo.value = result.data
          devLog('User authenticated via cookie')
          return true
        }
      }
      
      // 如果API调用失败，清除本地状态
      token.value = null
      userInfo.value = null
      devLog('User not authenticated')
      return false
    } catch (error) {
      devLog('Auth check failed:', error)
      token.value = null
      userInfo.value = null
      return false
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