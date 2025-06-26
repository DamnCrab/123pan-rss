import {z} from 'zod'
import 'zod-openapi/extend'
import {Hono} from 'hono'
import {describeRoute} from 'hono-openapi'
import {validator as zValidator} from 'hono-openapi/zod'
import {jwtMiddleware} from '../middleware/jwt'
import {db} from "../db";
import {eq, and, like, SQL} from 'drizzle-orm';
import {rssSubscriptionsTable} from "../db/schema";
import {responseSchema} from "../utils/responseSchema";

const app = new Hono()

// 应用JWT中间件到所有RSS路由
app.use('/*', jwtMiddleware)

// RSS订阅创建/更新的验证schema
const rssSchema = z.object({
    rssUrl: z.string().url('请输入有效的RSS链接'),
    folderPath: z.string().min(1, '文件夹路径不能为空'),
    folderName: z.string().min(1, '文件夹名称不能为空'),
    refreshInterval: z.number().min(1, '刷新间隔必须大于0'),
    refreshUnit: z.enum(['minutes', 'hours'], {
        errorMap: () => ({message: '刷新单位只能是minutes或hours'})
    }).default('minutes'),
    isActive: z.boolean().default(true)
}).openapi({
    ref: 'RssSubscriptionRequest',
    example: {
        rssUrl: 'https://example.com/rss.xml',
        folderPath: '/downloads/anime',
        folderName: '动漫下载',
        refreshInterval: 30,
        refreshUnit: 'minutes',
        isActive: true
    }
})

// RSS订阅响应schema
const rssSubscriptionSchema = z.object({
    id: z.number().describe('RSS订阅ID'),
    userId: z.number().describe('用户ID'),
    rssUrl: z.string().describe('RSS链接'),
    folderPath: z.string().describe('文件夹路径'),
    folderName: z.string().describe('文件夹名称'),
    refreshInterval: z.number().describe('刷新间隔，单位：分钟'),
    refreshUnit: z.enum(['minutes', 'hours']).describe('刷新单位，minutes或hours'),
    isActive: z.number().describe('订阅状态，1: 激活, 0: 停用'),
    lastRefresh: z.number().nullable().describe('最后刷新时间 (时间戳)'),
    createdAt: z.number().describe('创建时间 (时间戳)'),
    updatedAt: z.number().describe('更新时间 (时间戳)')
}).openapi({
    ref: 'RssSubscription',
    example: {
        id: 1,
        userId: 1,
        rssUrl: 'https://example.com/rss.xml',
        folderPath: '/downloads/anime',
        folderName: '动漫下载',
        refreshInterval: 30,
        refreshUnit: 'minutes',
        isActive: 1,
        lastRefresh: null,
        createdAt: 1704067200000,
        updatedAt: 1704067200000
    }
})

// 查询参数验证schema
const searchQuerySchema = z.object({
    search: z.string().optional().describe('按文件夹名称搜索')
}).openapi({
    ref: 'SearchQuery',
    example: {
        search: '动漫'
    }
})

const idQuerySchema = z.object({
    id: z.string().regex(/^\d+$/, 'ID必须是有效的数字').describe('RSS订阅ID')
}).openapi({
    ref: 'IdQuery',
    example: {
        id: '1'
    }
})


// 添加RSS订阅
app.post('/',
    describeRoute({
        tags: ['RSS订阅'],
        summary: '创建RSS订阅',
        description: '创建一个新的RSS订阅，包含RSS链接、文件夹路径、刷新频率等信息',
        responses: responseSchema(rssSubscriptionSchema)
    }),
    zValidator('json', rssSchema), async (c) => {
        try {
            const data = c.req.valid('json')
            const user = c.get('jwtPayload')
            const database = db(c.env)

            const now = Date.now()

            const [newSubscription] = await database.insert(rssSubscriptionsTable).values({
                userId: user.id,
                rssUrl: data.rssUrl!,
                folderPath: data.folderPath!,
                folderName: data.folderName!,
                refreshInterval: data.refreshInterval!,
                refreshUnit: data.refreshUnit || 'minutes',
                isActive: data.isActive !== undefined ? (data.isActive ? 1 : 0) : 1,
                lastRefresh: null,
                createdAt: now,
                updatedAt: now
            }).returning()

            return c.json({
                success: true,
                message: 'RSS订阅添加成功',
                data: newSubscription
            }, 201)
        } catch (error) {
            return c.json({
                success: false,
                message: '添加RSS订阅失败',
                error: error instanceof Error ? error.message : '未知错误'
            }, 500)
        }
    })

// 获取RSS订阅列表
app.get('/',
    describeRoute({
        tags: ['RSS订阅'],
        summary: '获取RSS订阅列表',
        description: '获取当前用户的所有RSS订阅列表，支持按名称搜索',
        security: [{bearerAuth: []}],
        responses: responseSchema(z.array(rssSubscriptionSchema))
    }),
    zValidator('query', searchQuerySchema), async (c) => {
        try {
            const user = c.get('jwtPayload')
            const database = db(c.env)
            const { search } = c.req.valid('query')

            // 构建查询条件
            let whereCondition: SQL | undefined = eq(rssSubscriptionsTable.userId, user.id)

            // 如果有搜索参数，添加模糊搜索条件
            if (search) {
                whereCondition = and(
                    eq(rssSubscriptionsTable.userId, user.id),
                    like(rssSubscriptionsTable.folderName, `%${search}%`)
                )
            }

            const subscriptions = await database
                .select()
                .from(rssSubscriptionsTable)
                .where(whereCondition)

            return c.json({
                success: true,
                message: search ? `搜索到${subscriptions.length}个相关订阅` : '获取RSS订阅列表成功',
                data: subscriptions
            })
        } catch (error) {
            return c.json({
                success: false,
                message: '获取RSS订阅列表失败',
                error: error instanceof Error ? error.message : '未知错误'
            }, 500)
        }
    })

// 获取单个RSS订阅
app.get('/detail',
    describeRoute({
        tags: ['RSS订阅'],
        summary: '获取单个RSS订阅',
        description: '根据ID获取指定的RSS订阅详情',
        responses: responseSchema(rssSubscriptionSchema)
    }),
    zValidator('query', idQuerySchema), async (c) => {
        try {
            const { id: idStr } = c.req.valid('query')
            const id = parseInt(idStr)
            const user = c.get('jwtPayload')
            const database = db(c.env)

            const [subscription] = await database
                .select()
                .from(rssSubscriptionsTable)
                .where(
                    and(
                        eq(rssSubscriptionsTable.id, id),
                        eq(rssSubscriptionsTable.userId, user.id)
                    )
                )

            if (!subscription) {
                return c.json({
                    success: false,
                    message: 'RSS订阅不存在'
                }, 404)
            }

            return c.json({
                success: true,
                message: '获取RSS订阅成功',
                data: subscription
            })
        } catch (error) {
            return c.json({
                success: false,
                message: '获取RSS订阅失败',
                error: error instanceof Error ? error.message : '未知错误'
            }, 500)
        }
    })

// 更新RSS订阅
app.put('/update',
    describeRoute({
        tags: ['RSS订阅'],
        summary: '更新RSS订阅',
        description: '根据ID更新指定的RSS订阅信息',
        security: [{bearerAuth: []}],
        responses: responseSchema(rssSubscriptionSchema)
    }),
    zValidator('query', idQuerySchema),
    zValidator('json', rssSchema.partial()), async (c) => {
        try {
            const { id: idStr } = c.req.valid('query')
            const id = parseInt(idStr)
            const data = c.req.valid('json')
            const user = c.get('jwtPayload')
            const database = db(c.env)

            // 检查订阅是否存在且属于当前用户
            const [existingSubscription] = await database
                .select()
                .from(rssSubscriptionsTable)
                .where(
                    and(
                        eq(rssSubscriptionsTable.id, id),
                        eq(rssSubscriptionsTable.userId, user.id)
                    )
                )

            if (!existingSubscription) {
                return c.json({
                    success: false,
                    message: 'RSS订阅不存在'
                }, 404)
            }

            const updateData: any = {
                ...data,
                updatedAt: Date.now()
            }

            if (data.isActive !== undefined) {
                updateData.isActive = data.isActive ? 1 : 0
            }

            const [updatedSubscription] = await database
                .update(rssSubscriptionsTable)
                .set(updateData)
                .where(
                    and(
                        eq(rssSubscriptionsTable.id, id),
                        eq(rssSubscriptionsTable.userId, user.id)
                    )
                )
                .returning()

            return c.json({
                success: true,
                message: 'RSS订阅更新成功',
                data: updatedSubscription
            })
        } catch (error) {
            return c.json({
                success: false,
                message: '更新RSS订阅失败',
                error: error instanceof Error ? error.message : '未知错误'
            }, 500)
        }
    })

// 删除RSS订阅
app.delete('/remove',
    describeRoute({
        tags: ['RSS订阅'],
        summary: '删除RSS订阅',
        description: '根据ID删除指定的RSS订阅',
        security: [{bearerAuth: []}],
        responses: responseSchema()
    }),
    zValidator('query', idQuerySchema), async (c) => {
        try {
            const { id: idStr } = c.req.valid('query')
            const id = parseInt(idStr)
            const user = c.get('jwtPayload')
            const database = db(c.env)

            // 检查订阅是否存在且属于当前用户
            const [existingSubscription] = await database
                .select()
                .from(rssSubscriptionsTable)
                .where(
                    and(
                        eq(rssSubscriptionsTable.id, id),
                        eq(rssSubscriptionsTable.userId, user.id)
                    )
                )

            if (!existingSubscription) {
                return c.json({
                    success: false,
                    message: 'RSS订阅不存在'
                }, 404)
            }

            await database
                .delete(rssSubscriptionsTable)
                .where(
                    and(
                        eq(rssSubscriptionsTable.id, id),
                        eq(rssSubscriptionsTable.userId, user.id)
                    )
                )

            return c.json({
                success: true,
                message: 'RSS订阅删除成功'
            })
        } catch (error) {
            return c.json({
                success: false,
                message: '删除RSS订阅失败',
                error: error instanceof Error ? error.message : '未知错误'
            }, 500)
        }
    })

// 切换RSS订阅激活状态
app.patch('/toggle',
    describeRoute({
        tags: ['RSS订阅'],
        summary: '切换RSS订阅激活状态',
        description: '切换指定RSS订阅的激活/停用状态',
        security: [{bearerAuth: []}],
        responses: responseSchema(rssSubscriptionSchema)
    }),
    zValidator('query', idQuerySchema), async (c) => {
        try {
            const { id: idStr } = c.req.valid('query')
            const id = parseInt(idStr)
            const user = c.get('jwtPayload')
            const database = db(c.env)

            // 获取当前状态
            const [currentSubscription] = await database
                .select()
                .from(rssSubscriptionsTable)
                .where(
                    and(
                        eq(rssSubscriptionsTable.id, id),
                        eq(rssSubscriptionsTable.userId, user.id)
                    )
                )

            if (!currentSubscription) {
                return c.json({
                    success: false,
                    message: 'RSS订阅不存在'
                }, 404)
            }

            // 切换状态
            const newStatus = currentSubscription.isActive === 1 ? 0 : 1

            const [updatedSubscription] = await database
                .update(rssSubscriptionsTable)
                .set({
                    isActive: newStatus,
                    updatedAt: Date.now()
                })
                .where(
                    and(
                        eq(rssSubscriptionsTable.id, id),
                        eq(rssSubscriptionsTable.userId, user.id)
                    )
                )
                .returning()

            return c.json({
                success: true,
                message: `RSS订阅已${newStatus === 1 ? '激活' : '停用'}`,
                data: updatedSubscription
            })
        } catch (error) {
            return c.json({
                success: false,
                message: '切换RSS订阅状态失败',
                error: error instanceof Error ? error.message : '未知错误'
            }, 500)
        }
    })


export default app
