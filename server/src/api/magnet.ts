import 'zod-openapi/extend'
import {Hono} from 'hono'
import {describeRoute} from 'hono-openapi'
import {validator as zValidator} from 'hono-openapi/zod'
import {z} from 'zod'
import {db} from '../db'
import {eq, and} from 'drizzle-orm'
import {magnetLinksTable} from '../db/schema'
import {responseSchema} from '../utils/responseSchema'
import {updateAllRSS, updateSingleRSS, createMagnetDownload} from "../utils/rss";
import {getOfflineDownloadProgress} from "../utils/cloud123";
import {jwtMiddleware} from '../middleware/jwt';
import {handleError, createErrorResponse, ErrorType} from '../utils/errorHandler';
import {rssUpdateRateLimit} from '../middleware/rateLimiter';

const app = new Hono()

// 为所有路由添加JWT验证中间件
app.use('/*', jwtMiddleware)

// 磁力链接响应schema
const magnetLinkSchema = z.object({
    id: z.number().describe('磁力链接ID'),
    rssSubscriptionId: z.number().describe('RSS订阅ID'),
    title: z.string().describe('种子标题'),
    magnetLink: z.string().describe('磁力链接'),
    webLink: z.string().nullable().describe('网页链接'),
    author: z.string().nullable().describe('作者'),
    category: z.string().nullable().describe('分类'),
    pubDate: z.number().nullable().describe('发布时间 (时间戳)'),
    description: z.string().nullable().describe('描述信息'),
    size: z.string().nullable().describe('文件大小'),
    createdAt: z.number().describe('创建时间 (时间戳)'),
    // 离线下载相关字段
    downloadTaskId: z.string().nullable().describe('123云盘离线下载任务ID'),
    downloadStatus: z.string().describe('下载状态: pending, downloading, completed, failed'),
    downloadFileId: z.string().nullable().describe('下载完成后的文件ID'),
    downloadFailReason: z.string().nullable().describe('下载失败原因'),
    downloadCreatedAt: z.number().nullable().describe('创建下载任务时间'),
    downloadCompletedAt: z.number().nullable().describe('下载完成时间')
}).openapi({
    ref: 'MagnetLink',
    example: {
        id: 1,
        rssSubscriptionId: 1,
        title: '[动漫名称] 第01话',
        magnetLink: 'magnet:?xt=urn:btih:...',
        webLink: 'https://example.com/anime/episode-01',
        author: '字幕组名称',
        category: '动漫',
        pubDate: 1704067200000,
        description: '动漫描述',
        size: '500MB',
        createdAt: 1704067200000,
        downloadTaskId: 'task_123456',
        downloadStatus: 'completed',
        downloadFileId: 'file_789012',
        downloadFailReason: null,
        downloadCreatedAt: 1704067200000,
        downloadCompletedAt: 1704070800000
    }
})

// 磁力链接列表查询参数schema
const magnetListQuerySchema = z.object({
    rssId: z.string().optional().describe('RSS订阅ID，筛选特定RSS的磁力链接'),
    pageNum: z.string().optional().describe('页码，从1开始，默认1'),
    pageSize: z.string().optional().describe('每页数量，默认50')
}).openapi({
    ref: 'MagnetListQuery',
    example: {
        rssId: '1',
        pageNum: '1',
        pageSize: '50'
    }
})



// RSS更新触发参数schema
const triggerQuerySchema = z.object({
    id: z.string().optional().describe('RSS订阅ID，指定时只更新该订阅，不指定时更新所有激活订阅')
}).openapi({
    ref: 'TriggerQuery',
    example: {
        id: '1'
    }
})

// 手动触发RSS更新的API端点
app.post('/trigger',
    rssUpdateRateLimit, // 应用RSS更新速率限制
    describeRoute({
        tags: ['磁力链接管理'],
        summary: '手动触发RSS更新',
        description: '手动触发RSS订阅更新任务。可指定RSS订阅ID只更新单个订阅，或不指定ID更新所有激活的RSS订阅',
        parameters: [
            {
                name: 'id',
                in: 'query',
                required: false,
                description: 'RSS订阅ID，指定时只更新该订阅',
                schema: {
                    type: 'string',
                    example: '1'
                }
            }
        ],
        responses: responseSchema()
    }),
    zValidator('query', triggerQuerySchema), async (c) => {
        try {
            const { id } = c.req.valid('query')
            
            if (id) {
                // 更新单个RSS订阅
                const subscriptionId = parseInt(id)
                if (isNaN(subscriptionId)) {
                    return c.json({
                        success: false,
                        message: 'RSS订阅ID必须是有效的数字'
                    }, 200)
                }
                
                const result = await updateSingleRSS(c.env, subscriptionId, true) // 强制更新
                
                if (result.success) {
                    return c.json({
                        success: true,
                        message: result.skipped 
                            ? '订阅更新被跳过（未到刷新时间）' 
                            : `RSS订阅更新完成，新增${result.newItems}个磁力链接`,
                        data: {
                            subscriptionId,
                            newItems: result.newItems,
                            skipped: result.skipped
                        }
                    })
                } else {
                    return c.json({
                        success: false,
                        message: result.error || '更新RSS订阅失败'
                    }, 500)
                }
            } else {
                // 更新所有RSS订阅
                const result = await updateAllRSS(c.env, true) // 强制更新
                return c.json({
                    success: true,
                    message: `RSS更新任务已完成，成功: ${result.success}，失败: ${result.failed}，跳过: ${result.skipped}，新增: ${result.totalNewItems}个磁力链接`,
                    data: result
                })
            }
        } catch (error) {
            return handleError(error, c, 'RSS更新任务失败');
        }
    })

// 获取磁力链接列表
app.get('/list',
    describeRoute({
        tags: ['磁力链接管理'],
        summary: '获取磁力链接列表',
        description: '获取磁力链接列表，支持按RSS订阅筛选和分页查询',
        parameters: [
            {
                name: 'rssId',
                in: 'query',
                required: false,
                description: 'RSS订阅ID，筛选特定RSS的磁力链接',
                schema: {
                    type: 'string',
                    example: '1'
                }
            },
            {
                name: 'pageNum',
                in: 'query',
                required: false,
                description: '页码，从1开始，默认1',
                schema: {
                    type: 'string',
                    example: '1'
                }
            },
            {
                name: 'pageSize',
                in: 'query',
                required: false,
                description: '每页数量，默认50',
                schema: {
                    type: 'string',
                    example: '50'
                }
            }
        ],
        responses: responseSchema(z.array(magnetLinkSchema))
    }),
    zValidator('query', magnetListQuerySchema), async (c) => {
        try {
            const database = db(c.env)
            const {rssId, pageNum: pageNumStr, pageSize: pageSizeStr} = c.req.valid('query')
            const pageNum = parseInt(pageNumStr || '1')
            const pageSize = parseInt(pageSizeStr || '50')

            // 验证分页参数
            if (pageSize < 1 || pageSize > 100) {
                return c.json({
                    success: false,
                    message: 'pageSize参数必须在1-100之间'
                }, 200)
            }

            if (pageNum < 1) {
                return c.json({
                    success: false,
                    message: 'pageNum参数必须大于0'
                }, 200)
            }

            // 计算limit和offset
            const limit = pageSize
            const offset = (pageNum - 1) * pageSize

            // 构建基础查询
            // 构建where条件数组
            const whereConditions = [];

            // 添加条件筛选
            if (rssId) {
                const rssIdNum = parseInt(rssId)
                if (isNaN(rssIdNum)) {
                    return c.json({
                        success: false,
                        message: 'rssId参数必须是有效的数字'
                    }, 200)
                }
                whereConditions.push(eq(magnetLinksTable.rssSubscriptionId, rssIdNum));
            }

            const baseQuery = database
                .select({
                    id: magnetLinksTable.id,
                    title: magnetLinksTable.title,
                    magnetLink: magnetLinksTable.magnetLink,
                    webLink: magnetLinksTable.webLink,
                    author: magnetLinksTable.author,
                    category: magnetLinksTable.category,
                    pubDate: magnetLinksTable.pubDate,
                    description: magnetLinksTable.description,
                    size: magnetLinksTable.size,
                    createdAt: magnetLinksTable.createdAt,
                    rssSubscriptionId: magnetLinksTable.rssSubscriptionId,
                    // 离线下载相关字段
                    downloadTaskId: magnetLinksTable.downloadTaskId,
                    downloadStatus: magnetLinksTable.downloadStatus,
                    downloadFileId: magnetLinksTable.downloadFileId,
                    downloadFailReason: magnetLinksTable.downloadFailReason,
                    downloadCreatedAt: magnetLinksTable.downloadCreatedAt,
                    downloadCompletedAt: magnetLinksTable.downloadCompletedAt
                })
                .from(magnetLinksTable)
                .where(whereConditions.length > 0 ? and(...whereConditions) : undefined)

            // 执行查询
            const magnetLinks = await baseQuery
                .limit(limit)
                .offset(offset)
                .orderBy(magnetLinksTable.createdAt)

            // 对正在下载中的磁链更新状态
            const updatedMagnetLinks = await Promise.all(
                magnetLinks.map(async (magnetLink) => {
                    if (magnetLink.downloadStatus === 'downloading' && magnetLink.downloadTaskId) {
                        try {
                            const progress = await getOfflineDownloadProgress(c.env, magnetLink.downloadTaskId);
                            console.log(progress)
                            if (progress) {
                                let newStatus = magnetLink.downloadStatus;
                                let downloadFileId = magnetLink.downloadFileId;
                                let downloadFailReason = magnetLink.downloadFailReason;
                                let downloadCompletedAt = magnetLink.downloadCompletedAt;

                                // 根据123云盘API返回的状态更新本地状态
                                // 0进行中、1下载失败、2下载成功、3重试中
                                if (progress.status === 2) {
                                    // 下载成功
                                    newStatus = 'completed';
                                    downloadFileId = progress.fileID || null;
                                    downloadCompletedAt = Date.now();
                                } else if (progress.status === 1) {
                                    // 下载失败
                                    newStatus = 'failed';
                                    downloadFailReason = progress.failReason || '下载失败';
                                } else if (progress.status === 3) {
                                    // 重试中，保持downloading状态
                                    newStatus = 'downloading';
                                }
                                // status === 0 表示仍在进行中，保持原状态

                                // 如果状态发生变化，更新数据库
                                if (newStatus !== magnetLink.downloadStatus || 
                                    downloadFileId !== magnetLink.downloadFileId ||
                                    downloadFailReason !== magnetLink.downloadFailReason ||
                                    downloadCompletedAt !== magnetLink.downloadCompletedAt) {
                                    
                                    await database
                                        .update(magnetLinksTable)
                                        .set({
                                            downloadStatus: newStatus,
                                            downloadFileId: downloadFileId,
                                            downloadFailReason: downloadFailReason,
                                            downloadCompletedAt: downloadCompletedAt
                                        })
                                        .where(eq(magnetLinksTable.id, magnetLink.id));
                                    
                                    // 返回更新后的数据
                                    return {
                                        ...magnetLink,
                                        downloadStatus: newStatus,
                                        downloadFileId: downloadFileId,
                                        downloadFailReason: downloadFailReason,
                                        downloadCompletedAt: downloadCompletedAt
                                    };
                                }
                            }
                        } catch (error) {
                            console.error(`更新磁链${magnetLink.id}下载状态失败:`, error);
                        }
                    }
                    return magnetLink;
                })
            );

            return c.json({
                success: true,
                message: '获取磁力链接列表成功',
                data: updatedMagnetLinks
            })
        } catch (error) {
            return handleError(error, c, '获取磁力链接列表失败');
        }
    })

// 手动创建磁力链接下载任务
app.post('/download/:id',
    describeRoute({
        tags: ['磁力链接管理'],
        summary: '创建磁力链接下载任务',
        description: '为指定的磁力链接创建123云盘离线下载任务',
        parameters: [
            {
                name: 'id',
                in: 'path',
                required: true,
                description: '磁力链接ID',
                schema: {
                    type: 'string',
                    example: '1'
                }
            }
        ],
        responses: responseSchema(z.object({
            success: z.boolean(),
            message: z.string(),
            taskId: z.string().optional().describe('下载任务ID')
        }).openapi({
            ref: 'CreateDownloadResponse',
            example: {
                success: true,
                message: '下载任务创建成功',
                taskId: 'task_123456'
            }
        }))
    }), async (c) => {
        try {
            const id = parseInt(c.req.param('id'))
            if (isNaN(id)) {
                return c.json({
                    success: false,
                    message: '磁力链接ID必须是有效的数字'
                }, 200)
            }

            const database = db(c.env)
            
            // 检查磁力链接是否存在
            const [magnetLink] = await database
                .select()
                .from(magnetLinksTable)
                .where(eq(magnetLinksTable.id, id))
                .limit(1)

            if (!magnetLink) {
                return c.json({
                    success: false,
                    message: '磁力链接不存在'
                }, 404)
            }

            // 检查是否已经有下载任务
            if (magnetLink.downloadStatus === 'downloading' || magnetLink.downloadStatus === 'completed') {
                return c.json({
                    success: false,
                    message: `磁力链接已经${magnetLink.downloadStatus === 'downloading' ? '正在下载' : '下载完成'}，无需重复创建任务`
                }, 200)
            }

            // 调用创建下载任务的方法
            const result = await createMagnetDownload(c.env, id)

            if (result.success) {
                return c.json({
                    success: true,
                    message: '下载任务创建成功',
                    data: {
                        taskId: result.taskId
                    }
                })
            } else {
                return c.json({
                    success: false,
                    message: result.error || '创建下载任务失败'
                }, 500)
            }
        } catch (error) {
            return handleError(error, c, '创建下载任务失败');
        }
    })

export default app
