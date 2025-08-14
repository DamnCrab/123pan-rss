// 应用初始化
import { useUserStore } from '@/stores/user'
import { CodeQualityChecker } from '@/utils/quality'
import { createTestSuite, Assert } from '@/utils/testing'
import { appConfig, devLog } from '@/config'

// 应用初始化类
export class AppInitializer {
  private static initialized = false

  /**
   * 初始化应用
   */
  static async initialize(): Promise<void> {
    if (this.initialized) {
      devLog('App already initialized')
      return
    }

    devLog('🚀 Initializing application...')

    try {
      // 1. 运行质量检查
      await this.runQualityChecks()

      // 2. 初始化用户状态
      await this.initializeUserState()

      // 3. 运行开发环境测试
      if (appConfig.isDevelopment) {
        await this.runDevelopmentTests()
      }

      this.initialized = true
      devLog('✅ Application initialized successfully')
    } catch (error) {
      console.error('❌ Application initialization failed:', error)
      throw error
    }
  }

  /**
   * 运行质量检查
   */
  private static async runQualityChecks(): Promise<void> {
    devLog('Running quality checks...')
    CodeQualityChecker.runAllChecks()
  }

  /**
   * 初始化用户状态
   */
  private static async initializeUserState(): Promise<void> {
    devLog('Initializing user state...')
    const userStore = useUserStore()
    await userStore.initializeFromStorage()
  }

  /**
   * 运行开发环境测试
   */
  private static async runDevelopmentTests(): Promise<void> {
    devLog('Running development tests...')
    
    const testSuite = createTestSuite()
      .add('User store initialization', () => {
        const userStore = useUserStore()
        return Assert.isDefined(userStore)
      })
      .add('Config validation', () => {
        return Assert.isDefined(appConfig.apiBaseUrl) && 
               Assert.isTrue(appConfig.timeout > 0)
      })
      .add('localStorage availability', () => {
        try {
          const testKey = '__test__'
          localStorage.setItem(testKey, 'test')
          const value = localStorage.getItem(testKey)
          localStorage.removeItem(testKey)
          return Assert.equals(value, 'test')
        } catch {
          return false
        }
      })

    await testSuite.run()
  }

  /**
   * 检查初始化状态
   */
  static isInitialized(): boolean {
    return this.initialized
  }

  /**
   * 重置初始化状态（仅用于测试）
   */
  static reset(): void {
    if (appConfig.isDevelopment) {
      this.initialized = false
      devLog('App initialization reset')
    }
  }
}

// 错误恢复机制
export class ErrorRecovery {
  /**
   * 尝试恢复应用状态
   */
  static async recover(): Promise<boolean> {
    devLog('🔄 Attempting to recover application state...')

    try {
      // 清除可能损坏的数据
      const userStore = useUserStore()
      userStore.clearStorage()

      // 重新初始化
      AppInitializer.reset()
      await AppInitializer.initialize()

      devLog('✅ Application state recovered successfully')
      return true
    } catch (error) {
      console.error('❌ Failed to recover application state:', error)
      return false
    }
  }

  /**
   * 安全重启应用
   */
  static async safeRestart(): Promise<void> {
    devLog('🔄 Performing safe application restart...')
    
    try {
      // 清除所有状态
      const userStore = useUserStore()
      userStore.clearStorage()
      
      // 重新加载页面
      window.location.reload()
    } catch (error) {
      console.error('❌ Safe restart failed:', error)
      // 强制重新加载
      window.location.href = window.location.href
    }
  }
}