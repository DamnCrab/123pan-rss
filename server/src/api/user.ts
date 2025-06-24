import {Hono} from 'hono'
import {sign, verify} from 'hono/jwt'
import {z} from 'zod'
import "zod-openapi/extend";
import {describeRoute} from "hono-openapi";
import {resolver, validator as zValidator} from "hono-openapi/zod";
import * as schema from '../db/schema';
import {db} from "../db";

const app = new Hono()

// JWT密钥 - 在生产环境中应该使用环境变量
const JWT_SECRET = 'your-secret-key'

// 登录请求验证schema
const loginSchema = z.object({
    username: z.string().min(1),
    password: z.string().min(1)
}).openapi({
    ref: 'LoginRequest',
    example: {
        username: 'admin',
        password: 'admin123'
    }
})

const responseSchema = z.object({
    code: z.number(),
    message: z.string(),
}).openapi({
    ref: 'Response',
})

// 模拟用户数据 - 在实际项目中应该连接数据库
const users = [
    {id: 1, username: 'admin', password: 'admin123'},
    {id: 2, username: 'user', password: 'user123'}
]

// 登录接口
app.post('/login',
    describeRoute({
        tags: ['User'],
        summary: '用户登录',
        description: '使用用户名和密码进行登录，成功后返回JWT token',
        responses: {
            200: {
                description: '登录成功',
                content: {
                    'application/json': {
                        schema: resolver(responseSchema)
                    }
                }
            }
        }
    }),
    zValidator('json', loginSchema), async (c) => {
        const {username, password} = c.req.valid('json')

        // 验证用户凭据
        const user = users.find(u => u.username === username && u.password === password)

        if (!user) {
            return c.json({error: '用户名或密码错误'}, 401)
        }

        // 生成JWT token
        const payload = {
            id: user.id,
            username: user.username,
            exp: Math.floor(Date.now() / 1000) + (60 * 60 * 24) // 24小时过期
        }

        const token = await sign(payload, JWT_SECRET)

        return c.json({
            message: '登录成功',
            token,
            user: {
                id: user.id,
                username: user.username
            }
        })
    })

// 登出接口
app.post('/logout', async (c) => {
    // 在客户端删除token即可实现登出
    // 这里可以添加token黑名单逻辑
    return c.json({message: '登出成功'})
})

// 获取当前用户信息接口（需要JWT验证）
app.get('/profile', async (c) => {
    const authHeader = c.req.header('Authorization')

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return c.json({error: '未提供有效的认证token'}, 401)
    }

    const token = authHeader.substring(7)

    try {
        const payload = await verify(token, JWT_SECRET)
        return c.json({
            user: {
                id: payload.id,
                username: payload.username
            }
        })
    } catch (error) {
        return c.json({error: 'token无效或已过期'}, 401)
    }
})

// hello world 路由
app.get('/hello', async (c) => {
    try {
        const users = await db(c.env).select().from(schema.usersTable)
        return c.json({message: 'Hello World', users})
    } catch (e) {
        console.log(e)
    }
})


export default app
export {JWT_SECRET}
