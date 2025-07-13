import { createRouter, createWebHistory } from 'vue-router'
import { getUserProfile } from '@/api'

// 检查用户是否已登录
const checkAuth = async (): Promise<boolean> => {
  const token = localStorage.getItem('token')
  if (!token) {
    return false
  }

  try {
    const result = await getUserProfile()
    return result.success
  } catch {
    // 如果获取用户信息失败，清除无效token
    localStorage.removeItem('token')
    return false
  }
}

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      redirect: '/login'
    },
    {
      path: '/login',
      name: 'login',
      component: () => import('../views/LoginView.vue'),
    },
    {
      path: '/admin',
      component: () => import('../layouts/AdminLayout.vue'),
      meta: { requiresAuth: true },
      children: [
        {
          path: '',
          redirect: '/admin/dashboard'
        },
        {
          path: 'dashboard',
          name: 'admin-dashboard',
          component: () => import('../views/admin/DashboardView.vue')
        },
        {
          path: 'rss',
          name: 'admin-rss',
          component: () => import('../views/admin/RssManagementView.vue')
        },
        {
          path: 'cloud',
          name: 'admin-cloud',
          component: () => import('../views/admin/CloudManagementView.vue')
        },
        {
          path: 'settings',
          name: 'admin-settings',
          component: () => import('../views/admin/UserSettingsView.vue')
        }
      ]
    },
  ],
})

// 路由守卫
router.beforeEach(async (to, from, next) => {
  const requiresAuth = to.matched.some(record => record.meta.requiresAuth)

  if (requiresAuth) {
    const isAuthenticated = await checkAuth()
    if (!isAuthenticated) {
      next('/login')
      return
    }
  }

  // 如果已登录用户访问登录页，重定向到管理页面
  if (to.name === 'login') {
    const isAuthenticated = await checkAuth()
    if (isAuthenticated) {
      next('/admin')
      return
    }
  }

  next()
})

export default router
