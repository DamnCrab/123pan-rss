// 简单的测试工具
import { appConfig, devLog, devError } from '@/config'

// 测试结果类型
interface TestResult {
  name: string
  passed: boolean
  error?: string
  duration: number
}

// 测试套件
export class TestSuite {
  private tests: Array<{ name: string; test: () => Promise<boolean> | boolean }> = []
  private results: TestResult[] = []

  /**
   * 添加测试用例
   */
  add(name: string, test: () => Promise<boolean> | boolean) {
    this.tests.push({ name, test })
    return this
  }

  /**
   * 运行所有测试
   */
  async run(): Promise<TestResult[]> {
    if (!appConfig.isDevelopment) {
      devLog('Tests skipped in production mode')
      return []
    }

    devLog('🧪 Running test suite...')
    this.results = []

    for (const { name, test } of this.tests) {
      const startTime = performance.now()
      
      try {
        const result = await test()
        const duration = performance.now() - startTime
        
        this.results.push({
          name,
          passed: result,
          duration
        })
        
        devLog(`${result ? '✅' : '❌'} ${name} (${duration.toFixed(2)}ms)`)
      } catch (error) {
        const duration = performance.now() - startTime
        const errorMessage = error instanceof Error ? error.message : String(error)
        
        this.results.push({
          name,
          passed: false,
          error: errorMessage,
          duration
        })
        
        devError(`❌ ${name} failed: ${errorMessage} (${duration.toFixed(2)}ms)`)
      }
    }

    this.printSummary()
    return this.results
  }

  /**
   * 打印测试摘要
   */
  private printSummary() {
    const passed = this.results.filter(r => r.passed).length
    const failed = this.results.length - passed
    const totalDuration = this.results.reduce((sum, r) => sum + r.duration, 0)

    devLog(`📊 Test Summary: ${passed} passed, ${failed} failed (${totalDuration.toFixed(2)}ms total)`)
    
    if (failed > 0) {
      devError('Failed tests:', this.results.filter(r => !r.passed))
    }
  }

  /**
   * 获取测试结果
   */
  getResults(): TestResult[] {
    return [...this.results]
  }
}

// 断言工具
export class Assert {
  static isTrue(value: boolean, message = 'Expected true'): boolean {
    if (value !== true) {
      throw new Error(`${message}: got ${value}`)
    }
    return true
  }

  static isFalse(value: boolean, message = 'Expected false'): boolean {
    if (value !== false) {
      throw new Error(`${message}: got ${value}`)
    }
    return true
  }

  static equals<T>(actual: T, expected: T, message = 'Values should be equal'): boolean {
    if (actual !== expected) {
      throw new Error(`${message}: expected ${expected}, got ${actual}`)
    }
    return true
  }

  static notEquals<T>(actual: T, expected: T, message = 'Values should not be equal'): boolean {
    if (actual === expected) {
      throw new Error(`${message}: both values are ${actual}`)
    }
    return true
  }

  static isNull(value: unknown, message = 'Expected null'): boolean {
    if (value !== null) {
      throw new Error(`${message}: got ${value}`)
    }
    return true
  }

  static isNotNull(value: unknown, message = 'Expected not null'): boolean {
    if (value === null) {
      throw new Error(`${message}: got null`)
    }
    return true
  }

  static isDefined(value: unknown, message = 'Expected defined value'): boolean {
    if (value === undefined) {
      throw new Error(`${message}: got undefined`)
    }
    return true
  }

  static isUndefined(value: unknown, message = 'Expected undefined'): boolean {
    if (value !== undefined) {
      throw new Error(`${message}: got ${value}`)
    }
    return true
  }

  static throws(fn: () => void, message = 'Expected function to throw'): boolean {
    try {
      fn()
      throw new Error(`${message}: function did not throw`)
    } catch (error) {
      // 如果是我们抛出的错误，重新抛出
      if (error instanceof Error && error.message.includes(message)) {
        throw error
      }
      // 否则说明函数确实抛出了错误，测试通过
      return true
    }
  }

  static async throwsAsync(fn: () => Promise<void>, message = 'Expected async function to throw'): Promise<boolean> {
    try {
      await fn()
      throw new Error(`${message}: function did not throw`)
    } catch (error) {
      // 如果是我们抛出的错误，重新抛出
      if (error instanceof Error && error.message.includes(message)) {
        throw error
      }
      // 否则说明函数确实抛出了错误，测试通过
      return true
    }
  }
}

// 创建测试套件的便捷函数
export const createTestSuite = () => new TestSuite()