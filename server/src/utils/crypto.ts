/**
 * 后端解密工具
 * 用于解密前端发送的加密数据
 */

// 解码密码（与前端对应）
export function decodePassword(encodedPassword: string): string {
  try {
    // 如果密码看起来不像编码格式，直接返回
    if (!encodedPassword.includes('.')) {
      return encodedPassword;
    }
    
    const parts = encodedPassword.split('.')
    if (parts.length !== 3) {
      return encodedPassword; // 可能是未编码的密码
    }
    
    const [timestamp, encoded, salt] = parts
    
    // 验证时间戳（可选，防止重放攻击）
    try {
      const requestTime = parseInt(timestamp, 36)
      const now = Date.now()
      const fiveMinutes = 5 * 60 * 1000
      
      if (now - requestTime > fiveMinutes) {
        console.warn('密码请求时间戳过期，但继续处理');
        // 继续处理，不拒绝请求
      }
    } catch (timestampError) {
      console.warn('时间戳解析失败:', timestampError);
    }
    
    // Base64解码
    let decoded: string;
    try {
      decoded = decodeURIComponent(escape(atob(encoded)));
    } catch (base64Error) {
      console.error('Base64解码失败:', base64Error);
      return encodedPassword; // 降级处理
    }
    
    // 移除盐值
    try {
      const reversedSalt = salt.split('').reverse().join('')
      const originalPassword = decoded.substring(salt.length, decoded.length - reversedSalt.length)
      
      return originalPassword
    } catch (saltError) {
      console.error('盐值处理失败:', saltError);
      return encodedPassword; // 降级处理
    }
  } catch (error) {
    console.error('密码解码失败:', error)
    return encodedPassword // 降级处理
  }
}

// 验证请求签名
export function verifyRequestSignature(signature: string, data: any): boolean {
  try {
    const decoded = atob(signature)
    const [timestamp, nonce, dataLength] = decoded.split('.')
    
    // 验证时间戳
    const requestTime = parseInt(timestamp)
    const now = Date.now()
    const fiveMinutes = 5 * 60 * 1000
    
    if (now - requestTime > fiveMinutes) {
      return false
    }
    
    // 验证数据长度
    const actualLength = JSON.stringify(data).length
    if (parseInt(dataLength) !== actualLength) {
      return false
    }
    
    return true
  } catch {
    return false
  }
}

// 验证安全头
export function validateSecurityHeaders(headers: Record<string, string>): boolean {
  const requestTime = headers['x-request-time']
  const nonce = headers['x-request-nonce']
  const clientVersion = headers['x-client-version']
  
  if (!requestTime || !nonce || !clientVersion) {
    return false
  }
  
  // 验证时间戳
  const timestamp = parseInt(requestTime)
  const now = Date.now()
  const fiveMinutes = 5 * 60 * 1000
  
  if (now - timestamp > fiveMinutes) {
    return false
  }
  
  // 验证nonce长度
  if (nonce.length !== 16) {
    return false
  }
  
  return true
}

// 生成安全的随机字符串
export function generateSecureRandom(length: number): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
  let result = ''
  const array = new Uint8Array(length)
  crypto.getRandomValues(array)
  
  for (let i = 0; i < length; i++) {
    result += chars[array[i] % chars.length]
  }
  
  return result
}