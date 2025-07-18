import type { AxiosResponse } from 'axios'

// 通用API响应类型
export interface ApiResponse<T = any> {
  code: number
  message: string
  data: T
  success: boolean
}

// API响应处理工具
export class ApiResponseHandler {
  /**
   * 检查响应是否成功
   */
  static isSuccess<T>(response: AxiosResponse<ApiResponse<T>>): boolean {
    return response.data.success === true && response.data.code === 200
  }

  /**
   * 获取响应数据
   */
  static getData<T>(response: AxiosResponse<ApiResponse<T>>): T {
    if (!this.isSuccess(response)) {
      throw new Error(response.data.message || '请求失败')
    }
    return response.data.data
  }

  /**
   * 获取错误信息
   */
  static getErrorMessage<T>(response: AxiosResponse<ApiResponse<T>>): string {
    return response.data.message || '未知错误'
  }

  /**
   * 安全地处理API响应
   */
  static async handleResponse<T>(
    responsePromise: Promise<AxiosResponse<ApiResponse<T>>>
  ): Promise<{ success: boolean; data?: T; error?: string }> {
    try {
      const response = await responsePromise
      
      if (this.isSuccess(response)) {
        return {
          success: true,
          data: this.getData(response)
        }
      } else {
        return {
          success: false,
          error: this.getErrorMessage(response)
        }
      }
    } catch (error: any) {
      return {
        success: false,
        error: error.message || '网络请求失败'
      }
    }
  }
}

// 创建类型安全的API调用包装器
export function createApiWrapper<T>(
  apiCall: () => Promise<AxiosResponse<ApiResponse<T>>>
) {
  return () => ApiResponseHandler.handleResponse(apiCall())
}