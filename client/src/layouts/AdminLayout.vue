<template>
  <n-layout class="min-h-screen">
    <!-- 顶部导航栏 -->
    <n-layout-header class="h-16 flex items-center justify-between px-6 border-b">
      <n-h2 class="!mb-0">管理后台</n-h2>
      <n-dropdown trigger="hover" :options="userMenuOptions" @select="handleUserMenuSelect">
        <n-button text>
          <template #icon>
            <n-icon><PersonOutline /></n-icon>
          </template>
          {{ userInfo?.username || '管理员' }}
        </n-button>
      </n-dropdown>
    </n-layout-header>

    <n-layout has-sider class="flex-1">
      <!-- 侧边栏 -->
      <n-layout-sider
        bordered
        collapse-mode="width"
        :collapsed-width="64"
        :width="240"
        show-trigger
      >
        <n-menu
          :value="activeMenu"
          :options="menuOptions"
          @update:value="handleMenuSelect"
          class="mt-4"
        />
      </n-layout-sider>

      <!-- 主内容区域 -->
      <n-layout-content class="p-6">
        <router-view />
      </n-layout-content>
    </n-layout>
  </n-layout>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, h } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import {
  NLayout,
  NLayoutHeader,
  NLayoutSider,
  NLayoutContent,
  NMenu,
  NButton,
  NDropdown,
  NIcon,
  NH2,
  useMessage
} from 'naive-ui'
import {
  PersonOutline,
  LogoRss,
  CloudDownloadOutline,
  SettingsOutline,
  LogOutOutline,
  KeyOutline,
  StatsChartOutline
} from '@vicons/ionicons5'

const router = useRouter()
const route = useRoute()
const message = useMessage()

const userInfo = ref<{ username: string } | null>(null)

// 根据当前路由计算活跃菜单
const activeMenu = computed(() => {
  const path = route.path
  if (path.includes('/admin/dashboard')) return 'dashboard'
  if (path.includes('/admin/rss')) return 'rss'
  if (path.includes('/admin/cloud')) return 'cloud'
  if (path.includes('/admin/settings')) return 'settings'
  return 'dashboard'
})

const menuOptions = [
  {
    label: '仪表板',
    key: 'dashboard',
    icon: () => h(NIcon, null, { default: () => h(StatsChartOutline) })
  },
  {
    label: 'RSS管理',
    key: 'rss',
    icon: () => h(NIcon, null, { default: () => h(LogoRss) })
  },
  {
    label: '云盘管理',
    key: 'cloud',
    icon: () => h(NIcon, null, { default: () => h(CloudDownloadOutline) })
  },
  {
    label: '用户设置',
    key: 'settings',
    icon: () => h(NIcon, null, { default: () => h(SettingsOutline) })
  }
]

const userMenuOptions = [
  {
    label: '修改密码',
    key: 'change-password',
    icon: () => h(NIcon, null, { default: () => h(KeyOutline) })
  },
  {
    label: '退出登录',
    key: 'logout',
    icon: () => h(NIcon, null, { default: () => h(LogOutOutline) })
  }
]

const handleMenuSelect = (key: string) => {
  switch (key) {
    case 'dashboard':
      router.push('/admin/dashboard')
      break
    case 'rss':
      router.push('/admin/rss')
      break
    case 'cloud':
      router.push('/admin/cloud')
      break
    case 'settings':
      router.push('/admin/settings')
      break
  }
}

const handleUserMenuSelect = async (key: string) => {
  if (key === 'logout') {
    try {
      await fetch('/api/user/logout', {
        method: 'POST',
        credentials: 'include'
      })
      message.success('退出登录成功')
      router.push('/login')
    } catch (error) {
      console.error('退出登录失败:', error)
      message.error('退出登录失败')
    }
  }
}

const fetchUserInfo = async () => {
  try {
    const response = await fetch('/api/user/profile', {
      credentials: 'include'
    })
    if (response.ok) {
      const result = await response.json()
      if (result.success) {
        userInfo.value = result.data
      } else {
        router.push('/login')
      }
    } else {
      router.push('/login')
    }
  } catch (error) {
    console.error('获取用户信息失败:', error)
    router.push('/login')
  }
}

onMounted(() => {
  fetchUserInfo()
})
</script>
