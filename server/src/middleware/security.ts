import { createMiddleware } from 'hono/factory'
import { validateSecurityHeaders } from '../utils/crypto'
import { createErrorResponse, ErrorType } from '../utils/errorHandler'

/**
 * 安全头验证中间件
 * 验证请求中的时间戳、nonce等安全头
 */
export const securityHeadersMiddleware = createMiddleware(async (c, next) => {
  // 获取请求头
  const headers: Record<string, string> = {}
  
  // 提取安全相关的请求头
  const requestTime = c.req.header('x-request-time')
  const nonce = c.req.header('x-request-nonce')
  const clientVersion = c.req.header('x-client-version')
  
  if (requestTime) headers['x-request-time'] = requestTime
  if (nonce) headers['x-request-nonce'] = nonce
  if (clientVersion) headers['x-client-version'] = clientVersion
  
  // 验证安全头
  if (!validateSecurityHeaders(headers)) {
    return c.json(
      createErrorResponse(
        ErrorType.VALIDATION_ERROR,
        '请求安全验证失败：缺少必要的安全头或时间戳过期'
      ),
      400
    )
  }
  
  await next()
})

/**
 * 可选的安全头验证中间件
 * 如果存在安全头则验证，不存在则跳过（用于向后兼容）
 */
export const optionalSecurityHeadersMiddleware = createMiddleware(async (c, next) => {
  // 获取请求头
  const requestTime = c.req.header('x-request-time')
  const nonce = c.req.header('x-request-nonce')
  const clientVersion = c.req.header('x-client-version')
  
  // 如果存在任何安全头，则进行完整验证
  if (requestTime || nonce || clientVersion) {
    const headers: Record<string, string> = {}
    
    if (requestTime) headers['x-request-time'] = requestTime
    if (nonce) headers['x-request-nonce'] = nonce
    if (clientVersion) headers['x-client-version'] = clientVersion
    
    // 验证安全头
    if (!validateSecurityHeaders(headers)) {
      return c.json(
        createErrorResponse(
          ErrorType.VALIDATION_ERROR,
          '请求安全验证失败：安全头格式错误或时间戳过期'
        ),
        400
      )
    }
  }
  
  await next()
})