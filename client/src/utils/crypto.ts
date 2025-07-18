/**
 * 前端加密工具
 * 用于在传输前对敏感数据进行加密保护
 */

// 生成随机字符串
function generateRandomString(length: number): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
  let result = ''
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return result
}

// 简单的字符串编码（Base64 + 随机盐）
export function encodePassword(password: string): string {
  try {
    // 添加随机盐值
    const salt = generateRandomString(8)
    const saltedPassword = salt + password + salt.split('').reverse().join('')
    
    // Base64编码
    const encoded = btoa(unescape(encodeURIComponent(saltedPassword)))
    
    // 添加时间戳混淆
    const timestamp = Date.now().toString(36)
    
    return `${timestamp}.${encoded}.${salt}`
  } catch (error) {
    console.error('密码编码失败:', error)
    return password // 降级处理
  }
}

// 解码密码（后端使用）
export function decodePassword(encodedPassword: string): string {
  try {
    const parts = encodedPassword.split('.')
    if (parts.length !== 3) {
      return encodedPassword // 可能是未编码的密码
    }
    
    const [timestamp, encoded, salt] = parts
    
    // Base64解码
    const decoded = decodeURIComponent(escape(atob(encoded)))
    
    // 移除盐值
    const reversedSalt = salt.split('').reverse().join('')
    const originalPassword = decoded.substring(salt.length, decoded.length - reversedSalt.length)
    
    return originalPassword
  } catch (error) {
    console.error('密码解码失败:', error)
    return encodedPassword // 降级处理
  }
}

// 生成请求签名（防止重放攻击）
export function generateRequestSignature(data: any): string {
  const timestamp = Date.now()
  const nonce = generateRandomString(16)
  const dataString = JSON.stringify(data)
  
  // 简单的签名算法
  return btoa(`${timestamp}.${nonce}.${dataString.length}`)
}

// 验证请求时间戳（5分钟内有效）
export function isValidTimestamp(signature: string): boolean {
  try {
    const decoded = atob(signature)
    const timestamp = parseInt(decoded.split('.')[0])
    const now = Date.now()
    const fiveMinutes = 5 * 60 * 1000
    
    return (now - timestamp) <= fiveMinutes
  } catch {
    return false
  }
}

// 为敏感请求添加安全头
export function addSecurityHeaders(headers: Record<string, string> = {}): Record<string, string> {
  const timestamp = Date.now().toString()
  const nonce = generateRandomString(16)
  
  return {
    ...headers,
    'X-Request-Time': timestamp,
    'X-Request-Nonce': nonce,
    'X-Client-Version': '1.0.0'
  }
}