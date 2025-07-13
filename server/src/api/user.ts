import {Hono} from 'hono'
import {sign} from 'hono/jwt'
import {z} from 'zod'
import "zod-openapi/extend";
import {describeRoute} from "hono-openapi";
import {validator as zValidator} from "hono-openapi/zod";
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
            const hashedPassword = await hashPassword(env.admin_password || 'admin123');

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

// 修改管理员信息请求schema
const updateAdminSchema = z.object({
    newUsername: z.string().min(1).max(50).describe('新用户名'),
    newPassword: z.string().min(6).max(100).describe('新密码，至少6位字符'),
    currentPassword: z.string().min(1).describe('当前密码，用于验证身份')
}).openapi({
    ref: 'UpdateAdminRequest',
    example: {
        newUsername: 'admin',
        newPassword: 'newpassword123',
        currentPassword: 'admin123'
    }
})

// 修改密码请求schema
const changePasswordSchema = z.object({
    currentPassword: z.string().min(1).describe('当前密码'),
    newPassword: z.string().min(6).max(100).describe('新密码，至少6位字符')
}).openapi({
    ref: 'ChangePasswordRequest',
    example: {
        currentPassword: 'admin123',
        newPassword: 'newpassword123'
    }
})

// 登录接口
app.post('/login',
    describeRoute({
        tags: ['用户'],
        summary: '用户登录',
        description: '使用用户名和密码进行登录，成功后返回JWT token',
        responses: responseSchema()
    }),
    zValidator('json', loginSchema), async (c) => {
        const {username, password} = c.req.valid('json')
        const env = c.env as Cloudflare.Env

        // 初始化默认用户
        await initDefaultUser(env);

        try {
            const database = db(env);
            // 从数据库验证用户凭据
            const users = await database.select().from(usersTable)
                .where(eq(usersTable.username, username)).limit(1);

            const user = users[0];
            if (!user || !(await verifyPassword(password, user.password))) {
                return c.json({
                    success: false,
                    message: '用户名或密码错误'
                }, 401)
            }

            const token = await signUserJwt(user);

            // 将JWT存储到cookie中
            setCookie(c, 'auth_token', token, {
                httpOnly: true,
                secure: true,
                sameSite: 'Lax',
                maxAge: 60 * 60 * 24 * 30 // 30天有效期
            });

            return c.json({
                success: true,
                message: '登录成功',
                data: {
                    token,
                    user: {
                        id: user.id,
                        username: user.username
                    }
                }
            })
        } catch (error) {
            console.error('登录错误:', error);
            return c.json({
                success: false,
                message: '服务器内部错误',
                error: error instanceof Error ? error.message : '未知错误'
            }, 500)
        }
    })

// 登出接口
app.post('/logout',
    describeRoute({
        tags: ['用户'],
        summary: '用户登出',
        description: '清除用户的认证token，退出登录状态',
        responses: responseSchema()
    }), async (c) => {
        // 清除cookie中的JWT token
        setCookie(c, 'auth_token', '', {
            httpOnly: true,
            secure: false,
            sameSite: 'Lax',
            maxAge: 0 // 立即过期
        });

        return c.json({
            success: true,
            message: '登出成功'
        })
    })

// 获取当前用户信息接口
app.get('/profile',
    describeRoute({
        tags: ['用户'],
        summary: '获取当前用户信息',
        description: '获取当前登录用户的基本信息',
        security: [{bearerAuth: []}],
        responses: responseSchema(z.object({
            id: z.number(),
            username: z.string()
        }).openapi({
            ref: 'UserProfile',
            example: {
                id: 1,
                username: 'admin'
            }
        }))
    }),
    jwtMiddleware,
    async (c) => {
        const user = c.get('jwtPayload')

        try {
            const database = db(c.env);

            // 获取当前用户信息
            const currentUser = await database.select({
                id: usersTable.id,
                username: usersTable.username
            }).from(usersTable)
                .where(eq(usersTable.id, user.id)).limit(1);

            if (currentUser.length === 0) {
                return c.json({
                    success: false,
                    message: '用户不存在'
                }, 404);
            }

            return c.json({
                success: true,
                message: '获取用户信息成功',
                data: currentUser[0]
            });
        } catch (error) {
            console.error('获取用户信息错误:', error);
            return c.json({
                success: false,
                message: '服务器内部错误',
                error: error instanceof Error ? error.message : '未知错误'
            }, 500);
        }
    })

// 修改管理员账号和密码接口
app.put('/admin/profile',
    describeRoute({
        tags: ['用户'],
        summary: '修改管理员账号和密码',
        description: '修改管理员的用户名和密码，需要提供当前密码进行验证',
        security: [{bearerAuth: []}],
        responses: responseSchema()
    }),
    jwtMiddleware,
    zValidator('json', updateAdminSchema),
    async (c) => {
        const {newUsername, newPassword, currentPassword} = c.req.valid('json');
        const user = c.get('jwtPayload')

        try {
            const database = db(c.env);

            // 获取当前用户信息
            const currentUser = await database.select().from(usersTable)
                .where(eq(usersTable.id, user.id)).limit(1);

            if (currentUser.length === 0) {
                return c.json({
                    success: false,
                    message: '用户不存在'
                }, 404);
            }

            // 验证当前密码
            const isCurrentPasswordValid = await verifyPassword(currentPassword, currentUser[0].password);
            if (!isCurrentPasswordValid) {
                return c.json({
                    success: false,
                    message: '当前密码错误'
                }, 401);
            }

            // 检查新用户名是否已存在（如果用户名有变化）
            if (newUsername !== currentUser[0].username) {
                const existingUser = await database.select().from(usersTable)
                    .where(eq(usersTable.username, newUsername)).limit(1);

                if (existingUser.length > 0) {
                    return c.json({
                        success: false,
                        message: '用户名已存在'
                    }, 400);
                }
            }

            // 对新密码进行哈希处理
            const hashedNewPassword = await hashPassword(newPassword);

            // 更新用户信息
            await database.update(usersTable)
                .set({
                    username: newUsername,
                    password: hashedNewPassword
                })
                .where(eq(usersTable.id, user.id));

            return c.json({
                success: true,
                message: '管理员信息修改成功',
                data: {
                    username: newUsername
                }
            });
        } catch (error) {
            console.error('修改管理员信息错误:', error);
            return c.json({
                success: false,
                message: '服务器内部错误',
                error: error instanceof Error ? error.message : '未知错误'
            }, 500);
        }
    })

// 修改密码接口
app.put('/password',
    describeRoute({
        tags: ['用户'],
        summary: '修改密码',
        description: '修改当前用户的密码，需要提供当前密码进行验证',
        security: [{bearerAuth: []}],
        responses: responseSchema()
    }),
    jwtMiddleware,
    zValidator('json', changePasswordSchema),
    async (c) => {
        const {currentPassword, newPassword} = c.req.valid('json');
        const user = c.get('jwtPayload')

        try {
            const database = db(c.env);

            // 获取当前用户信息
            const currentUser = await database.select().from(usersTable)
                .where(eq(usersTable.id, user.id)).limit(1);

            if (currentUser.length === 0) {
                return c.json({
                    success: false,
                    message: '用户不存在'
                }, 404);
            }

            // 验证当前密码
            const isCurrentPasswordValid = await verifyPassword(currentPassword, currentUser[0].password);
            if (!isCurrentPasswordValid) {
                return c.json({
                    success: false,
                    message: '当前密码错误'
                }, 401);
            }

            // 对新密码进行哈希处理
            const hashedNewPassword = await hashPassword(newPassword);

            // 更新密码
            await database.update(usersTable)
                .set({
                    password: hashedNewPassword
                })
                .where(eq(usersTable.id, user.id));

            return c.json({
                success: true,
                message: '密码修改成功'
            });
        } catch (error) {
            console.error('修改密码错误:', error);
            return c.json({
                success: false,
                message: '服务器内部错误',
                error: error instanceof Error ? error.message : '未知错误'
            }, 500);
        }
    })

export default app
