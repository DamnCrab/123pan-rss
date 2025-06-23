import { createMiddleware } from 'hono/factory'
import { verify } from 'hono/jwt'
import { JWT_SECRET } from '../api/user'

// JWT验证中间件
export const jwtMiddleware = createMiddleware(async (c, next) => {
  const authHeader = c.req.header('Authorization')
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return c.json({ error: '未提供有效的认证token' }, 401)
  }
  
  const token = authHeader.substring(7)
  
  try {
    const payload = await verify(token, JWT_SECRET)
    // 将用户信息存储到context中，供后续使用
    c.set('user', payload)
    await next()
  } catch (error) {
    return c.json({ error: 'token无效或已过期' }, 401)
  }
})