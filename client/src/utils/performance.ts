import { appConfig, devLog } from '@/config'

// 性能监控类
export class PerformanceMonitor {
  private static timers = new Map<string, number>()
  
  /**
   * 开始计时
   */
  static startTimer(name: string): void {
    if (appConfig.isDevelopment) {
      this.timers.set(name, performance.now())
      devLog(`⏱️ Timer started: ${name}`)
    }
  }
  
  /**
   * 结束计时并输出结果
   */
  static endTimer(name: string): number {
    if (!appConfig.isDevelopment) return 0
    
    const startTime = this.timers.get(name)
    if (!startTime) {
      console.warn(`Timer "${name}" not found`)
      return 0
    }
    
    const duration = performance.now() - startTime
    this.timers.delete(name)
    
    devLog(`⏱️ Timer ended: ${name} - ${duration.toFixed(2)}ms`)
    return duration
  }
  
  /**
   * 监控API请求性能
   */
  static monitorApiCall<T>(
    name: string,
    apiCall: () => Promise<T>
  ): Promise<T> {
    if (!appConfig.isDevelopment) {
      return apiCall()
    }
    
    this.startTimer(`API: ${name}`)
    
    return apiCall()
      .then(result => {
        this.endTimer(`API: ${name}`)
        return result
      })
      .catch(error => {
        this.endTimer(`API: ${name}`)
        throw error
      })
  }
  
  /**
   * 监控组件渲染性能
   */
  static monitorComponent(componentName: string) {
    if (!appConfig.isDevelopment) {
      return { onMounted: () => {}, onUnmounted: () => {} }
    }
    
    const timerName = `Component: ${componentName}`
    
    return {
      onMounted: () => {
        this.startTimer(timerName)
      },
      onUnmounted: () => {
        this.endTimer(timerName)
      }
    }
  }
  
  /**
   * 获取页面性能指标
   */
  static getPageMetrics() {
    if (!appConfig.isDevelopment || !window.performance) {
      return null
    }
    
    const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming
    
    if (!navigation) return null
    
    const metrics = {
      // DNS查询时间
      dnsLookup: navigation.domainLookupEnd - navigation.domainLookupStart,
      // TCP连接时间
      tcpConnect: navigation.connectEnd - navigation.connectStart,
      // 请求响应时间
      request: navigation.responseEnd - navigation.requestStart,
      // DOM解析时间
      domParse: navigation.domContentLoadedEventEnd - navigation.domContentLoadedEventStart,
      // 页面加载完成时间
      pageLoad: navigation.loadEventEnd - navigation.loadEventStart,
      // 首次内容绘制
      firstContentfulPaint: 0,
      // 最大内容绘制
      largestContentfulPaint: 0
    }
    
    // 获取绘制指标
    const paintEntries = performance.getEntriesByType('paint')
    paintEntries.forEach(entry => {
      if (entry.name === 'first-contentful-paint') {
        metrics.firstContentfulPaint = entry.startTime
      }
    })
    
    // 获取LCP指标
    const lcpEntries = performance.getEntriesByType('largest-contentful-paint')
    if (lcpEntries.length > 0) {
      metrics.largestContentfulPaint = lcpEntries[lcpEntries.length - 1].startTime
    }
    
    devLog('📊 Page Performance Metrics:', metrics)
    return metrics
  }
  
  /**
   * 监控内存使用情况
   */
  static monitorMemory() {
    if (!appConfig.isDevelopment || !('memory' in performance)) {
      return null
    }
    
    const memory = (performance as any).memory
    const memoryInfo = {
      used: Math.round(memory.usedJSHeapSize / 1048576), // MB
      total: Math.round(memory.totalJSHeapSize / 1048576), // MB
      limit: Math.round(memory.jsHeapSizeLimit / 1048576) // MB
    }
    
    devLog('🧠 Memory Usage:', memoryInfo)
    return memoryInfo
  }
}

// 自动监控页面性能
if (appConfig.isDevelopment) {
  window.addEventListener('load', () => {
    setTimeout(() => {
      PerformanceMonitor.getPageMetrics()
      PerformanceMonitor.monitorMemory()
    }, 1000)
  })
}