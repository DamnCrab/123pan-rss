/**
 * 密码强度验证工具
 * 用于验证密码的安全性
 */

export interface PasswordStrength {
  score: number // 0-4 分数
  level: 'weak' | 'fair' | 'good' | 'strong' | 'very-strong'
  feedback: string[]
  isValid: boolean
}

// 密码强度检查
export function checkPasswordStrength(password: string): PasswordStrength {
  const feedback: string[] = []
  let score = 0

  // 长度检查
  if (password.length >= 8) {
    score += 1
  } else {
    feedback.push('密码长度至少需要8位字符')
  }

  if (password.length >= 12) {
    score += 1
  }

  // 包含小写字母
  if (/[a-z]/.test(password)) {
    score += 1
  } else {
    feedback.push('密码应包含小写字母')
  }

  // 包含大写字母
  if (/[A-Z]/.test(password)) {
    score += 1
  } else {
    feedback.push('密码应包含大写字母')
  }

  // 包含数字
  if (/\d/.test(password)) {
    score += 1
  } else {
    feedback.push('密码应包含数字')
  }

  // 包含特殊字符
  if (/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
    score += 1
  } else {
    feedback.push('密码应包含特殊字符')
  }

  // 不包含常见弱密码模式
  const weakPatterns = [
    /123456/,
    /password/i,
    /admin/i,
    /qwerty/i,
    /(.)\1{2,}/, // 连续重复字符
    /012345/,
    /abcdef/i
  ]

  for (const pattern of weakPatterns) {
    if (pattern.test(password)) {
      score = Math.max(0, score - 1)
      feedback.push('密码包含常见的弱密码模式')
      break
    }
  }

  // 确定强度等级
  let level: PasswordStrength['level']
  if (score <= 1) {
    level = 'weak'
  } else if (score <= 2) {
    level = 'fair'
  } else if (score <= 3) {
    level = 'good'
  } else if (score <= 4) {
    level = 'strong'
  } else {
    level = 'very-strong'
  }

  // 添加正面反馈
  if (score >= 4) {
    feedback.unshift('密码强度很好！')
  } else if (score >= 3) {
    feedback.unshift('密码强度良好')
  }

  return {
    score: Math.min(score, 5),
    level,
    feedback,
    isValid: score >= 3 && password.length >= 8
  }
}

// 生成安全密码建议
export function generatePasswordSuggestion(): string {
  const lowercase = 'abcdefghijklmnopqrstuvwxyz'
  const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
  const numbers = '0123456789'
  const symbols = '!@#$%^&*()_+-=[]{}|;:,.<>?'
  
  const allChars = lowercase + uppercase + numbers + symbols
  let password = ''
  
  // 确保包含每种类型的字符
  password += lowercase[Math.floor(Math.random() * lowercase.length)]
  password += uppercase[Math.floor(Math.random() * uppercase.length)]
  password += numbers[Math.floor(Math.random() * numbers.length)]
  password += symbols[Math.floor(Math.random() * symbols.length)]
  
  // 填充到12位
  for (let i = 4; i < 12; i++) {
    password += allChars[Math.floor(Math.random() * allChars.length)]
  }
  
  // 打乱顺序
  return password.split('').sort(() => Math.random() - 0.5).join('')
}

// 检查密码是否在常见密码列表中
export function isCommonPassword(password: string): boolean {
  const commonPasswords = [
    'password', '123456', '123456789', 'qwerty', 'abc123',
    'password123', 'admin', 'letmein', 'welcome', 'monkey',
    '1234567890', 'dragon', 'master', 'hello', 'freedom',
    'whatever', 'qazwsx', 'trustno1', 'jordan23', 'harley',
    'robert', 'matthew', 'jordan', 'michelle', 'love'
  ]
  
  return commonPasswords.includes(password.toLowerCase())
}

// 密码相似度检查（用于检查新密码与旧密码的相似度）
export function calculatePasswordSimilarity(password1: string, password2: string): number {
  if (password1 === password2) return 1
  
  const len1 = password1.length
  const len2 = password2.length
  const maxLen = Math.max(len1, len2)
  
  if (maxLen === 0) return 1
  
  // 计算编辑距离
  const matrix = Array(len2 + 1).fill(null).map(() => Array(len1 + 1).fill(null))
  
  for (let i = 0; i <= len1; i++) {
    matrix[0][i] = i
  }
  
  for (let j = 0; j <= len2; j++) {
    matrix[j][0] = j
  }
  
  for (let j = 1; j <= len2; j++) {
    for (let i = 1; i <= len1; i++) {
      if (password1[i - 1] === password2[j - 1]) {
        matrix[j][i] = matrix[j - 1][i - 1]
      } else {
        matrix[j][i] = Math.min(
          matrix[j - 1][i - 1] + 1, // 替换
          matrix[j][i - 1] + 1,     // 插入
          matrix[j - 1][i] + 1      // 删除
        )
      }
    }
  }
  
  const editDistance = matrix[len2][len1]
  return 1 - (editDistance / maxLen)
}