import {createMiddleware} from 'hono/factory'
import {getCookie} from 'hono/cookie'
import {sign, verify} from 'hono/jwt'

export const JWT_SECRET = 'your-secret-key'
export const expirationTime = 60 * 60 * 24 // 24小时

// JWT验证中间件
export const jwtMiddleware = createMiddleware(async (c, next) => {
    // 优先从cookie获取token
    let token = getCookie(c, 'auth_token');

    if (!token) {
        return c.json({error: '未提供有效的认证token'}, 401)
    }

    try {
        const payload = await verify(token, JWT_SECRET)
        // 将用户信息存储到context中，供后续使用
        c.set('jwtPayload', payload)
        await next()
    } catch (error) {
        return c.json({error: 'token无效或已过期'}, 401)
    }
})

export const signUserJwt = async (user: { id: any; username: any }) => {
    const payload = {
        id: user.id,
        username: user.username,
        exp: Math.floor(Date.now() / 1000) + expirationTime // 24小时过期
    }
    return await sign(payload, JWT_SECRET)
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
