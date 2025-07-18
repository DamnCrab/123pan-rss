// JWT相关错误代码常量
export const JWT_ERROR_CODES = {
  TOKEN_MISSING: 'TOKEN_MISSING',
  TOKEN_EXPIRED: 'TOKEN_EXPIRED',
  TOKEN_INVALID: 'TOKEN_INVALID'
} as const

// HTTP状态码常量
export const HTTP_STATUS = {
  OK: 200,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  INTERNAL_SERVER_ERROR: 500
} as const

// 错误消息常量
export const ERROR_MESSAGES = {
  LOGIN_EXPIRED: '登录已过期，请重新登录',
  UNAUTHORIZED: '未授权访问',
  FORBIDDEN: '禁止访问',
  NOT_FOUND: '请求的资源不存在',
  SERVER_ERROR: '服务器内部错误',
  NETWORK_ERROR: '网络错误，请检查网络连接',
  CONFIG_ERROR: '请求配置错误',
  REQUEST_FAILED: '请求失败'
} as const

// JWT错误代码类型
export type JwtErrorCode = keyof typeof JWT_ERROR_CODES

// HTTP状态码类型
export type HttpStatus = typeof HTTP_STATUS[keyof typeof HTTP_STATUS]