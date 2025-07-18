import { createRouter, createWebHistory } from 'vue-router'
import { useUserStore } from '@/stores/user'
import { getUserProfile } from '@/api/user'
import { PerformanceMonitor } from '@/utils/performance'
import { devLog } from '@/config'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      redirect: '/admin'
    },
    {
    path: '/login',
    name: 'Login',
    component: () => import('@/views/LoginView.vue'),
    meta: { requiresAuth: false }
  },
    {
      path: '/admin',
      name: 'admin',
      component: () => import('@/layouts/AdminLayout.vue'),
      meta: { requiresAuth: true },
      children: [
        {
          path: '',
          redirect: '/admin/dashboard'
        },
        {
          path: 'dashboard',
          name: 'dashboard',
          component: () => import('@/views/admin/DashboardView.vue')
        },
        {
          path: 'rss',
          name: 'rss',
          component: () => import('@/views/admin/RssManagementView.vue')
        },
        {
          path: 'settings',
          name: 'settings',
          component: () => import('@/views/admin/UserSettingsView.vue')
        }
      ]
    }
  ]
})

// 检查用户认证状态
async function checkAuth(): Promise<boolean> {
  const userStore = useUserStore()
  
  // 如果store中有token，直接返回true
  if (userStore.token) {
    devLog('Auth check: Token exists in store')
    return true
  }
  
  // 尝试从localStorage恢复token
  userStore.initializeFromStorage()
  
  if (!userStore.token) {
    devLog('Auth check: No token found')
    return false
  }
  
  // 如果有token但没有用户信息，尝试获取用户信息
  if (!userStore.hasUserInfo) {
    try {
      PerformanceMonitor.startTimer('Auth Check')
      const userProfile = await getUserProfile()
      // 确保data存在且不为undefined
      if (userProfile.data) {
        userStore.setUserInfo(userProfile.data)
        PerformanceMonitor.endTimer('Auth Check')
        devLog('Auth check: User profile loaded')
        return true
      } else {
        devLog('Auth check: No user data in response')
        userStore.logout()
        return false
      }
    } catch (error) {
      devLog('Auth check: Failed to load user profile', error)
      // 如果获取用户信息失败，清除无效的token
      userStore.logout()
      return false
    }
  }
  
  return true
}

// 全局前置守卫
router.beforeEach(async (to, from, next) => {
  PerformanceMonitor.startTimer(`Route: ${to.name?.toString() || to.path}`)
  
  const requiresAuth = to.meta.requiresAuth !== false
  
  if (requiresAuth) {
    const isAuthenticated = await checkAuth()
    
    if (!isAuthenticated) {
      devLog('Route guard: Redirecting to login')
      next('/login')
      return
    }
  }
  
  // 如果已登录用户访问登录页，重定向到管理页面
  if (to.path === '/login') {
    const userStore = useUserStore()
    if (userStore.isLoggedIn) {
      devLog('Route guard: Redirecting logged in user to admin')
      next('/admin')
      return
    }
  }
  
  next()
})

// 全局后置守卫
router.afterEach((to) => {
  PerformanceMonitor.endTimer(`Route: ${to.name?.toString() || to.path}`)
})

export default router
