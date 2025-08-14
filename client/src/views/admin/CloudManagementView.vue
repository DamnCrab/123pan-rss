<template>
  <div>
    <n-h1 class="mb-6">云盘管理</n-h1>

    <!-- 云盘用户信息 -->
    <n-card title="用户信息" class="mb-6">
      <n-space vertical>
        <!-- 用户信息展示 -->
        <template v-if="userInfo">
          
          <!-- 基本信息 -->
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div class="flex items-center space-x-3">
              <n-avatar 
                :size="40" 
                :src="userInfo.avatar" 
                :fallback-src="'/favicon.ico'"
                round
              />
              <div>
                <div class="font-medium">{{ userInfo.nickname }}</div>
                <div class="text-sm text-gray-500">UID: {{ userInfo.isHideUID ? '****' : userInfo.uid }}</div>
              </div>
            </div>
            <div class="space-y-2">
              <div class="flex justify-between items-center">
                <span class="text-sm text-gray-600">手机号:</span>
                <span class="text-sm">{{ userInfo.passport }}</span>
              </div>
              <div class="flex justify-between items-center">
                <span class="text-sm text-gray-600">邮箱:</span>
                <span class="text-sm">{{ userInfo.mail }}</span>
              </div>
            </div>
          </div>

          <!-- VIP信息 -->
          <div class="bg-gradient-to-r from-yellow-50 to-orange-50 p-4 rounded-lg mb-4">
            <div class="flex justify-between items-center mb-2">
              <span class="font-medium text-gray-700">会员状态</span>
              <n-tag :type="userInfo.vipInfo.isVip ? 'warning' : 'default'" size="small">
                {{ userInfo.vipInfo.isVip ? 'VIP用户' : '普通用户' }}
              </n-tag>
            </div>
            <div v-if="userInfo.vipInfo.isVip && userInfo.vipInfo.vipExpiredAt" class="space-y-1">
              <div class="flex justify-between items-center text-sm">
                <span class="text-gray-600">到期时间:</span>
                <span>{{ formatDate(userInfo.vipInfo.vipExpiredAt) }}</span>
              </div>
            </div>
          </div>

          <!-- 开发者信息 -->
          <div v-if="userInfo.developerInfo.isDeveloper" class="bg-blue-50 p-4 rounded-lg mb-4">
            <div class="flex justify-between items-center mb-2">
              <span class="font-medium text-gray-700">开发者权益</span>
              <n-tag type="info" size="small">开发者</n-tag>
            </div>
            <div class="flex justify-between items-center text-sm">
              <span class="text-gray-600">权益到期:</span>
              <span>{{ formatDate(userInfo.developerInfo.developerExpiredAt) }}</span>
            </div>
          </div>

          <!-- 其他信息 -->
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div class="flex justify-between items-center">
              <span class="text-sm text-gray-600">剩余直链流量:</span>
              <span class="text-sm">{{ formatSize(userInfo.directTraffic) }}</span>
            </div>
            <div class="flex justify-between items-center">
              <span class="text-sm text-gray-600">HTTPS数量:</span>
              <span class="text-sm">{{ userInfo.httpsCount }}</span>
            </div>
          </div>
        </template>
        
        <n-divider>存储信息</n-divider>
        <template v-if="userInfo">
          <!-- 永久空间 -->
          <div class="bg-green-50 p-4 rounded-lg mb-4">
            <div class="flex justify-between items-center mb-2">
              <span class="font-medium text-gray-700">永久存储空间</span>
              <span class="text-sm text-gray-600">{{ getStorageUsagePercent(userInfo.spaceInfo.usedSize, userInfo.spaceInfo.totalSize - userInfo.spaceInfo.tempSize) }}%</span>
            </div>
            <div class="w-full bg-gray-200 rounded-full h-2 mb-2">
              <div 
                class="bg-green-500 h-2 rounded-full transition-all duration-300" 
                :style="{ width: getStorageUsagePercent(userInfo.spaceInfo.usedSize, userInfo.spaceInfo.totalSize - userInfo.spaceInfo.tempSize) + '%' }"
              ></div>
            </div>
            <div class="flex justify-between items-center text-sm">
              <span class="text-gray-600">已使用:</span>
              <span>{{ formatSize(userInfo.spaceInfo.usedSize) }} / {{ formatSize(userInfo.spaceInfo.totalSize - userInfo.spaceInfo.tempSize) }}</span>
            </div>
          </div>

          <!-- 临时空间 -->
          <div v-if="userInfo.spaceInfo.tempSize > 0" class="bg-blue-50 p-4 rounded-lg mb-4">
            <div class="flex justify-between items-center mb-2">
              <span class="font-medium text-gray-700">临时存储空间</span>
              <n-tag type="info" size="small">临时</n-tag>
            </div>
            <div class="space-y-1">
              <div class="flex justify-between items-center text-sm">
                <span class="text-gray-600">临时空间:</span>
                <span>{{ formatSize(userInfo.spaceInfo.tempSize) }}</span>
              </div>
              <div class="flex justify-between items-center text-sm">
                <span class="text-gray-600">到期时间:</span>
                <span>{{ userInfo.spaceInfo.tempExpiredAt }}</span>
              </div>
            </div>
          </div>

          <!-- 总存储空间 -->
          <div class="bg-gray-50 p-4 rounded-lg mb-4">
            <div class="flex justify-between items-center mb-2">
              <span class="font-medium text-gray-700">总存储空间</span>
              <span class="text-sm text-gray-600">{{ getStorageUsagePercent(userInfo.spaceInfo.usedSize, userInfo.spaceInfo.totalSize) }}%</span>
            </div>
            <div class="w-full bg-gray-200 rounded-full h-2 mb-2">
              <div 
                class="bg-blue-500 h-2 rounded-full transition-all duration-300" 
                :style="{ width: getStorageUsagePercent(userInfo.spaceInfo.usedSize, userInfo.spaceInfo.totalSize) + '%' }"
              ></div>
            </div>
            <div class="flex justify-between items-center text-sm">
              <span class="text-gray-600">已使用:</span>
              <span>{{ formatSize(userInfo.spaceInfo.usedSize) }} / {{ formatSize(userInfo.spaceInfo.totalSize) }}</span>
            </div>
          </div>
        </template>
        <template v-else>
          <div class="flex justify-between items-center">
            <span>存储空间:</span>
            <span>{{ storageInfo.used }} / {{ storageInfo.total }}</span>
          </div>
        </template>
      </n-space>
    </n-card>



  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted, h } from 'vue'
import {
  NCard,
  NSpace,
  NTag,
  NH1,
  NDivider,
  NAvatar,
  useMessage
} from 'naive-ui'
import { getCloud123UserInfo } from '@/api/cloud'
import type { Cloud123UserInfo } from '@/api/cloud'

const message = useMessage()

// 账户信息
const storageInfo = reactive({
  used: '0 GB',
  total: '0 GB'
})
const userInfo = ref<Cloud123UserInfo | null>(null)





// 工具函数
const formatSize = (bytes: number): string => {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

const formatDate = (timestamp: number | null): string => {
  if (!timestamp) return '永久'
  return new Date(timestamp * 1000).toLocaleString('zh-CN')
}

// API 调用函数
const fetchUserInfo = async () => {
  try {
    const result = await getCloud123UserInfo()
    if (result.success && result.data) {
      userInfo.value = result.data
    } else {
      console.warn('获取用户信息失败:', result.message)
    }
  } catch (error) {
    console.error('获取用户信息失败:', error)
  }
}

const fetchAccountInfo = async () => {
  try {
    const response = await fetch('/api/cloud123/account', {
      credentials: 'include'
    })
    const result = await response.json()
    if (result.success && result.data) {
      storageInfo.used = result.data.used || '0 GB'
      storageInfo.total = result.data.total || '0 GB'
    }
  } catch (error) {
    console.error('获取账户信息失败:', error)
  }
}



// 工具函数
const getStorageUsagePercent = (used: number, total: number): number => {
  if (total === 0) return 0
  return Math.round((used / total) * 100)
}

onMounted(() => {
  fetchAccountInfo()
  fetchUserInfo()
})
</script>
