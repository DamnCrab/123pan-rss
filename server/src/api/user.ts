import {Hono} from 'hono'
import {sign} from 'hono/jwt'
import {z} from 'zod'
import "zod-openapi/extend";
import {describeRoute} from "hono-openapi";
import { validator as zValidator} from "hono-openapi/zod";
import {db} from "../db";
import {eq} from 'drizzle-orm';
import {setCookie} from 'hono/cookie';
import {hashPassword, JWT_SECRET, jwtMiddleware, signUserJwt, verifyPassword} from '../middleware/jwt';
import {usersTable} from "../db/schema";
import {responseSchema, successResponseSchema} from "../utils/responseSchema";

const app = new Hono()



// 初始化默认用户
async function initDefaultUser(env: any) {
    try {
        const database = db(env);
        // 检查是否已存在admin用户
        const existingAdmin = await database.select().from(usersTable)
            .where(eq(usersTable.username, 'admin')).limit(1);

        if (existingAdmin.length === 0) {
            // 对默认密码进行哈希处理
            const hashedPassword = await hashPassword('admin123');

            // 创建默认admin用户
            await database.insert(usersTable).values({
                username: 'admin',
                password: hashedPassword
            });
            console.log('默认admin用户已创建');
        }
    } catch (error) {
        console.error('初始化默认用户失败:', error);
    }
}

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

// 登录接口
app.post('/login',
    describeRoute({
        tags: ['User'],
        summary: '用户登录',
        description: '使用用户名和密码进行登录，成功后返回JWT token',
        responses: responseSchema()
    }),
    zValidator('json', loginSchema), async (c) => {
        const {username, password} = c.req.valid('json')

        // 初始化默认用户
        await initDefaultUser(c.env);

        try {
            const database = db(c.env);
            // 从数据库验证用户凭据
            const users = await database.select().from(usersTable)
                .where(eq(usersTable.username, username)).limit(1);

            const user = users[0];
            if (!user || !(await verifyPassword(password, user.password))) {
                return c.json({error: '用户名或密码错误'}, 401)
            }

            const token = await signUserJwt(user);

            // 将JWT存储到cookie中
            setCookie(c, 'auth_token', token, {
                httpOnly: true,
                secure: false, // 在生产环境中应设为true
                sameSite: 'Lax',
                maxAge: 60 * 60 * 24 // 24小时
            });

            return c.json({
                message: '登录成功',
                token,
                user: {
                    id: user.id,
                    username: user.username
                }
            })
        } catch (error) {
            console.error('登录错误:', error);
            return c.json({error: '服务器内部错误'}, 500)
        }
    })

// 登出接口
app.post('/logout', async (c) => {
    // 清除cookie中的JWT token
    setCookie(c, 'auth_token', '', {
        httpOnly: true,
        secure: false,
        sameSite: 'Lax',
        maxAge: 0 // 立即过期
    });

    return c.json({message: '登出成功'})
})

export default app
