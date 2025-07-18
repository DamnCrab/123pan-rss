import { z } from 'zod'
import 'zod-openapi/extend'

// 通用API响应类型
export const apiResponseSchema = <T extends z.ZodTypeAny>(dataSchema?: T) => {
  return z.object({
    success: z.boolean().describe('操作是否成功'),
    message: z.string().describe('响应消息'),
    data: dataSchema ? dataSchema.optional() : z.any().optional().describe('响应数据')
  }).openapi({
    ref: dataSchema ? `ApiResponseWith${dataSchema._def.openapi?.ref || 'Data'}` : 'ApiResponse'
  })
}

// 分页响应类型
export const paginatedResponseSchema = <T extends z.ZodTypeAny>(itemSchema: T) => {
  return z.object({
    list: z.array(itemSchema).describe('数据列表'),
    total: z.number().describe('总数量'),
    page: z.number().describe('当前页码'),
    pageSize: z.number().describe('每页数量')
  }).openapi({
    ref: `PaginatedResponseOf${itemSchema._def.openapi?.ref || 'Item'}`
  })
}

// 分页查询参数
export const paginationQuerySchema = z.object({
  page: z.string().regex(/^\d+$/, '页码必须是数字').transform(Number).default('1').describe('页码，从1开始'),
  pageNum: z.string().regex(/^\d+$/, '页码必须是数字').transform(Number).optional().describe('页码（兼容性参数）'),
  pageSize: z.string().regex(/^\d+$/, '每页数量必须是数字').transform(Number).default('20').describe('每页数量，默认20'),
  limit: z.string().regex(/^\d+$/, '限制数量必须是数字').transform(Number).optional().describe('限制数量（兼容性参数）')
}).openapi({
  ref: 'PaginationQuery',
  example: {
    page: '1',
    pageSize: '20'
  }
})

// 搜索查询参数
export const searchQuerySchema = z.object({
  search: z.string().optional().describe('搜索关键字'),
  keyword: z.string().optional().describe('关键字（兼容性参数）')
}).openapi({
  ref: 'SearchQuery',
  example: {
    search: '关键字'
  }
})

// 日期范围查询参数
export const dateRangeQuerySchema = z.object({
  startDate: z.string().optional().describe('开始日期，格式：YYYY-MM-DD'),
  endDate: z.string().optional().describe('结束日期，格式：YYYY-MM-DD')
}).openapi({
  ref: 'DateRangeQuery',
  example: {
    startDate: '2024-01-01',
    endDate: '2024-12-31'
  }
})

// ID查询参数
export const idQuerySchema = z.object({
  id: z.string().regex(/^\d+$/, 'ID必须是有效的数字').describe('资源ID')
}).openapi({
  ref: 'IdQuery',
  example: {
    id: '1'
  }
})

// 批量操作参数
export const batchOperationSchema = z.object({
  ids: z.array(z.number()).min(1, '至少选择一个项目').describe('要操作的ID列表')
}).openapi({
  ref: 'BatchOperation',
  example: {
    ids: [1, 2, 3]
  }
})

// 操作结果响应
export const operationResultSchema = z.object({
  affected: z.number().describe('受影响的记录数'),
  success: z.boolean().describe('操作是否成功')
}).openapi({
  ref: 'OperationResult',
  example: {
    affected: 3,
    success: true
  }
})

// 状态切换响应
export const toggleResultSchema = z.object({
  id: z.number().describe('资源ID'),
  status: z.boolean().describe('新状态')
}).openapi({
  ref: 'ToggleResult',
  example: {
    id: 1,
    status: true
  }
})

// 用户信息schema
export const userInfoSchema = z.object({
  id: z.number().describe('用户ID'),
  username: z.string().describe('用户名'),
  email: z.string().email().optional().describe('邮箱'),
  avatar: z.string().optional().describe('头像URL')
}).openapi({
  ref: 'UserInfo',
  example: {
    id: 1,
    username: 'admin',
    email: 'admin@example.com'
  }
})

// 登录结果schema
export const loginResultSchema = z.object({
  token: z.string().describe('JWT令牌'),
  user: userInfoSchema.describe('用户信息')
}).openapi({
  ref: 'LoginResult',
  example: {
    token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
    user: {
      id: 1,
      username: 'admin'
    }
  }
})

// 时间单位枚举
export const timeUnitSchema = z.enum(['minutes', 'hours', 'days']).openapi({
  ref: 'TimeUnit',
  example: 'minutes'
})

// 状态枚举
export const statusSchema = z.enum(['active', 'inactive', 'pending', 'failed', 'completed']).openapi({
  ref: 'Status',
  example: 'active'
})

// 下载状态枚举
export const downloadStatusSchema = z.enum(['pending', 'downloading', 'completed', 'failed', 'paused']).openapi({
  ref: 'DownloadStatus',
  example: 'pending'
})

// 文件类型枚举
export const fileTypeSchema = z.enum(['file', 'folder']).openapi({
  ref: 'FileType',
  example: 'file'
})

// 统计数据schema
export const statsDataSchema = z.record(z.union([z.number(), z.string()])).openapi({
  ref: 'StatsData',
  example: {
    totalCount: 100,
    activeCount: 80,
    status: 'healthy'
  }
})

// 错误响应schema
export const errorResponseSchema = z.object({
  success: z.literal(false).describe('操作失败'),
  message: z.string().describe('错误消息'),
  error: z.string().optional().describe('详细错误信息'),
  code: z.number().optional().describe('错误代码')
}).openapi({
  ref: 'ErrorResponse',
  example: {
    success: false,
    message: '操作失败',
    error: '详细错误信息',
    code: 400
  }
})

// 文件上传响应schema
export const uploadResponseSchema = z.object({
  url: z.string().describe('文件URL'),
  filename: z.string().describe('文件名'),
  size: z.number().describe('文件大小')
}).openapi({
  ref: 'UploadResponse',
  example: {
    url: 'https://example.com/file.jpg',
    filename: 'file.jpg',
    size: 1024
  }
})