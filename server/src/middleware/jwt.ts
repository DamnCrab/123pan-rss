import {createMiddleware} from 'hono/factory'
import {getCookie} from 'hono/cookie'
import {sign, verify} from 'hono/jwt'
import {createErrorResponse, ErrorType} from '../utils/errorHandler'

export const expirationTime = 60 * 60 * 24 * 30 // 30天（一个月）

// 获取JWT密钥的函数
const getJwtSecret = (env: any) => {
    const Env = env as Cloudflare.Env
    const secret = Env.JWT_SECRET;
    if (!secret) {
        throw new Error('JWT_SECRET environment variable is required');
    }
    return secret;
}

// JWT验证中间件
export const jwtMiddleware = createMiddleware(async (c, next) => {
    // 优先从Authorization header获取token
    let token = c.req.header('Authorization')?.replace('Bearer ', '');
    
    // 如果header中没有token，则从cookie获取
    if (!token) {
        token = getCookie(c, 'auth_token');
    }

    if (!token) {
        return c.json({
            success: false,
            message: '未提供有效的认证token',
            code: 'TOKEN_MISSING'
        }, 401)
    }

    try {
        const jwtSecret = getJwtSecret(c.env)
        const payload = await verify(token, jwtSecret)
        
        // 检查token是否过期
        if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
            return c.json({
                success: false,
                message: 'token已过期，请重新登录',
                code: 'TOKEN_EXPIRED'
            }, 401)
        }
        
        // 将用户信息存储到context中，供后续使用
        c.set('jwtPayload', payload)
        await next()
    } catch (error) {
        // 使用统一的错误处理
        return c.json({
            success: false,
            message: 'token无效或已过期，请重新登录',
            code: 'TOKEN_INVALID'
        }, 401)
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

// 生成随机盐值
const generateSalt = async (length: number = 16): Promise<string> => {
    const array = new Uint8Array(length);
    crypto.getRandomValues(array);
    return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
}

// 使用PBKDF2进行密码哈希
export const hashPassword = async (password: string): Promise<string> => {
    const salt = await generateSalt();
    const encoder = new TextEncoder();
    const passwordData = encoder.encode(password + salt);
    
    // 使用PBKDF2进行多轮哈希
    const key = await crypto.subtle.importKey(
        'raw',
        encoder.encode(password),
        { name: 'PBKDF2' },
        false,
        ['deriveBits']
    );
    
    const hashBuffer = await crypto.subtle.deriveBits(
        {
            name: 'PBKDF2',
            salt: encoder.encode(salt),
            iterations: 100000, // 10万次迭代
            hash: 'SHA-256'
        },
        key,
        256 // 256位输出
    );
    
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    
    // 返回盐值和哈希值的组合
    return `${salt}:${hash}`;
}

// 验证密码函数
export const verifyPassword = async (password: string, hashedPassword: string): Promise<boolean> => {
    try {
        const [salt, hash] = hashedPassword.split(':');
        if (!salt || !hash) {
            // 兼容旧的SHA-256哈希格式
            const encoder = new TextEncoder();
            const data = encoder.encode(password);
            const hashBuffer = await crypto.subtle.digest('SHA-256', data);
            const hashArray = Array.from(new Uint8Array(hashBuffer));
            const oldHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
            return oldHash === hashedPassword;
        }
        
        const encoder = new TextEncoder();
        
        const key = await crypto.subtle.importKey(
            'raw',
            encoder.encode(password),
            { name: 'PBKDF2' },
            false,
            ['deriveBits']
        );
        
        const hashBuffer = await crypto.subtle.deriveBits(
            {
                name: 'PBKDF2',
                salt: encoder.encode(salt),
                iterations: 100000,
                hash: 'SHA-256'
            },
            key,
            256
        );
        
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        const computedHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
        
        return computedHash === hash;
    } catch (error) {
        console.error('密码验证错误:', error);
        return false;
    }
}
