import {createMiddleware} from 'hono/factory'
import {getCookie} from 'hono/cookie'
import {sign, verify} from 'hono/jwt'
import {createErrorResponse, ErrorType} from '../utils/errorHandler'

export const expirationTime = 60 * 60 * 24 // 24小时

// 获取JWT密钥的函数
const getJwtSecret = (env: any) => {
    const secret = env.JWT_SECRET;
    if (!secret) {
        throw new Error('JWT_SECRET environment variable is required');
    }
    if (secret.length < 32) {
        throw new Error('JWT_SECRET must be at least 32 characters long');
    }
    return secret;
}

// JWT验证中间件
export const jwtMiddleware = createMiddleware(async (c, next) => {
    // 优先从cookie获取token
    let token = getCookie(c, 'auth_token');

    if (!token) {
        return c.json({
            success: false,
            message: '未提供有效的认证token'
        }, 401)
    }

    try {
        const jwtSecret = getJwtSecret(c.env)
        const payload = await verify(token, jwtSecret)
        // 将用户信息存储到context中，供后续使用
        c.set('jwtPayload', payload)
        await next()
    } catch (error) {
        // 使用统一的错误处理
        const errorResponse = createErrorResponse(error, 'token无效或已过期');
        return c.json(errorResponse, 401)
    }
})

export const signUserJwt = async (user: { id: any; username: any }, env: any) => {
    const payload = {
        id: user.id,
        username: user.username,
        exp: Math.floor(Date.now() / 1000) + expirationTime // 24小时过期
    }
    const jwtSecret = getJwtSecret(env)
    return await sign(payload, jwtSecret)
}

// 密码哈希函数
export const hashPassword = async (password: string) => {
    const encoder = new TextEncoder();
    const data = encoder.encode(password);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// 验证密码函数
export const verifyPassword = async (password: string, hashedPassword: string) => {
    const hashedInput = await hashPassword(password);
    return hashedInput === hashedPassword;
}
