// 代码质量检查工具
import { appConfig, devLog, devError } from '@/config'

// 代码质量检查器
export class CodeQualityChecker {
  /**
   * 检查API响应的完整性
   */
  static validateApiResponse<T>(response: any, expectedFields: string[]): response is T {
    if (!response || typeof response !== 'object') {
      devError('Invalid API response: not an object', response)
      return false
    }

    const missingFields = expectedFields.filter(field => !(field in response))
    if (missingFields.length > 0) {
      devError('Missing required fields in API response:', missingFields)
      return false
    }

    return true
  }

  /**
   * 检查组件props的完整性
   */
  static validateProps(props: Record<string, any>, required: string[]): boolean {
    const missing = required.filter(key => props[key] === undefined || props[key] === null)
    if (missing.length > 0) {
      devError('Missing required props:', missing)
      return false
    }
    return true
  }

  /**
   * 检查环境变量配置
   */
  static validateEnvironment(): boolean {
    const requiredEnvVars = [
      'VITE_API_BASE_URL'
    ]

    const missing = requiredEnvVars.filter(varName => !import.meta.env[varName])
    
    if (missing.length > 0) {
      devError('Missing required environment variables:', missing)
      return false
    }

    devLog('Environment validation passed')
    return true
  }

  /**
   * 检查localStorage可用性
   */
  static validateStorage(): boolean {
    try {
      const testKey = '__storage_test__'
      localStorage.setItem(testKey, 'test')
      localStorage.removeItem(testKey)
      return true
    } catch (error) {
      devError('localStorage is not available:', error)
      return false
    }
  }

  /**
   * 运行所有质量检查
   */
  static runAllChecks(): boolean {
    if (!appConfig.isDevelopment) return true

    devLog('🔍 Running code quality checks...')
    
    const checks = [
      { name: 'Environment', check: () => this.validateEnvironment() },
      { name: 'Storage', check: () => this.validateStorage() }
    ]

    let allPassed = true
    
    for (const { name, check } of checks) {
      try {
        const passed = check()
        devLog(`✅ ${name} check: ${passed ? 'PASSED' : 'FAILED'}`)
        if (!passed) allPassed = false
      } catch (error) {
        devError(`❌ ${name} check failed with error:`, error)
        allPassed = false
      }
    }

    devLog(`🎯 Overall quality check: ${allPassed ? 'PASSED' : 'FAILED'}`)
    return allPassed
  }
}

// 自动运行质量检查
if (appConfig.isDevelopment) {
  // 延迟运行，确保应用初始化完成
  setTimeout(() => {
    CodeQualityChecker.runAllChecks()
  }, 1000)
}