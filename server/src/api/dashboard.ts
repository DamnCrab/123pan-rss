import 'zod-openapi/extend'
import {Hono} from 'hono'
import {describeRoute} from 'hono-openapi'
import {z} from 'zod'
import {db} from '../db'
import {eq, count, and} from 'drizzle-orm'
import {rssSubscriptionsTable, magnetLinksTable} from '../db/schema'
import {responseSchema} from '../utils/responseSchema'
import {statsDataSchema} from '../utils/openApiSchemas'
import {jwtMiddleware} from '../middleware/jwt'
import {handleError, createErrorResponse, ErrorType} from '../utils/errorHandler'

const app = new Hono()

// 应用JWT中间件
app.use('/*', jwtMiddleware)

// Dashboard统计数据响应schema
const dashboardStatsSchema = z.object({
    rssCount: z.number().describe('RSS订阅总数'),
    downloadCount: z.number().describe('下载任务总数'),
    pendingCount: z.number().describe('待处理任务数'),
    failedCount: z.number().describe('失败任务数'),
    completedCount: z.number().describe('已完成任务数'),
    downloadingCount: z.number().describe('下载中任务数')
}).openapi({
    ref: 'DashboardStats',
    example: {
        rssCount: 5,
        downloadCount: 23,
        pendingCount: 3,
        failedCount: 1,
        completedCount: 18,
        downloadingCount: 1
    }
})

// 获取Dashboard统计数据
app.get('/stats',
    describeRoute({
        tags: ['Dashboard'],
        summary: '获取Dashboard统计数据',
        description: '获取RSS订阅数量、下载任务统计等汇总信息',
        responses: responseSchema(dashboardStatsSchema)
    }), async (c) => {
        try {
            const database = db(c.env)
            const jwtPayload = c.get('jwtPayload') as { id: number; username: string }
            const userId = jwtPayload.id

            // 获取RSS订阅总数
            const [rssCountResult] = await database
                .select({ count: count() })
                .from(rssSubscriptionsTable)
                .where(eq(rssSubscriptionsTable.userId, userId))

            // 获取下载任务总数
            const [downloadCountResult] = await database
                .select({ count: count() })
                .from(magnetLinksTable)
                .innerJoin(rssSubscriptionsTable, eq(magnetLinksTable.rssSubscriptionId, rssSubscriptionsTable.id))
                .where(eq(rssSubscriptionsTable.userId, userId))

            // 获取待处理任务数
            const [pendingCountResult] = await database
                .select({ count: count() })
                .from(magnetLinksTable)
                .innerJoin(rssSubscriptionsTable, eq(magnetLinksTable.rssSubscriptionId, rssSubscriptionsTable.id))
                .where(and(
                    eq(rssSubscriptionsTable.userId, userId),
                    eq(magnetLinksTable.downloadStatus, 'pending')
                ))

            // 获取失败任务数
            const [failedCountResult] = await database
                .select({ count: count() })
                .from(magnetLinksTable)
                .innerJoin(rssSubscriptionsTable, eq(magnetLinksTable.rssSubscriptionId, rssSubscriptionsTable.id))
                .where(and(
                    eq(rssSubscriptionsTable.userId, userId),
                    eq(magnetLinksTable.downloadStatus, 'failed')
                ))

            // 获取已完成任务数
            const [completedCountResult] = await database
                .select({ count: count() })
                .from(magnetLinksTable)
                .innerJoin(rssSubscriptionsTable, eq(magnetLinksTable.rssSubscriptionId, rssSubscriptionsTable.id))
                .where(and(
                    eq(rssSubscriptionsTable.userId, userId),
                    eq(magnetLinksTable.downloadStatus, 'completed')
                ))

            // 获取下载中任务数
            const [downloadingCountResult] = await database
                .select({ count: count() })
                .from(magnetLinksTable)
                .innerJoin(rssSubscriptionsTable, eq(magnetLinksTable.rssSubscriptionId, rssSubscriptionsTable.id))
                .where(and(
                    eq(rssSubscriptionsTable.userId, userId),
                    eq(magnetLinksTable.downloadStatus, 'downloading')
                ))

            const stats = {
                rssCount: rssCountResult.count,
                downloadCount: downloadCountResult.count,
                pendingCount: pendingCountResult.count,
                failedCount: failedCountResult.count,
                completedCount: completedCountResult.count,
                downloadingCount: downloadingCountResult.count
            }

            return c.json({
                success: true,
                message: '获取Dashboard统计数据成功',
                data: stats
            })
        } catch (error) {
            return handleError(error, c, '获取Dashboard统计数据失败');
        }
    })

export default app