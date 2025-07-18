// 环境配置管理
interface AppConfig {
  apiBaseUrl: string
  timeout: number
  isDevelopment: boolean
  isProduction: boolean
}

// 获取环境配置
export const getAppConfig = (): AppConfig => {
  const isDevelopment = import.meta.env.DEV
  const isProduction = import.meta.env.PROD
  
  return {
    apiBaseUrl: import.meta.env.VITE_API_BASE_URL || 'http://localhost:8787',
    timeout: Number(import.meta.env.VITE_REQUEST_TIMEOUT) || 40000,
    isDevelopment,
    isProduction
  }
}

// 导出配置实例
export const appConfig = getAppConfig()

// 开发环境日志工具
export const devLog = (...args: any[]) => {
  if (appConfig.isDevelopment) {
    console.log('[DEV]', ...args)
  }
}

// 开发环境错误日志
export const devError = (...args: any[]) => {
  if (appConfig.isDevelopment) {
    console.error('[DEV ERROR]', ...args)
  }
}