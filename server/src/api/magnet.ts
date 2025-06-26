import 'zod-openapi/extend'
import { Hono } from 'hono'
import { describeRoute } from 'hono-openapi'
import { validator as zValidator } from 'hono-openapi/zod'
import { z } from 'zod'
import { db } from '../db'
import { eq, and, gt } from 'drizzle-orm'
import { rssSubscriptionsTable, magnetLinksTable } from '../db/schema'
import { responseSchema } from '../utils/responseSchema'
import { XMLParser } from 'fast-xml-parser'

const app = new Hono()

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
    createdAt: z.number().describe('创建时间 (时间戳)')
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
        createdAt: 1704067200000
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

// RSS解析函数 - 使用fast-xml-parser
async function parseRSSFeed(rssUrl: string) {
    try {
        const response = await fetch(rssUrl)
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`)
        }

        const xmlText = await response.text()

        // 配置fast-xml-parser选项
        const parserOptions = {
            ignoreAttributes: false,
            isArray: (name: string, jpath: string) => {
                return jpath === 'rss.channel.item'
            }
        }

        // 创建XML解析器
        const parser = new XMLParser(parserOptions)
        const jsonObj = parser.parse(xmlText)

        // 简单的XML解析，提取RSS项目
        const items: Array<{
            title: string
            magnetLink: string
            webLink?: string
            author?: string
            category?: string
            pubDate?: number
            description?: string
            size?: string
        }> = []

        // 获取RSS项目
        const rssItems = jsonObj?.rss?.channel?.item || []
        const itemsArray = Array.isArray(rssItems) ? rssItems : [rssItems]

        // 处理每个RSS项目
        for (const item of itemsArray) {
            if (!item) continue

            // 提取标题 - 处理CDATA或普通文本
            const title = item.title?.['#cdata'] || item.title?.['#text'] || item.title || ''

            // 提取链接
            const link = item.link?.['#cdata'] || item.link?.['#text'] || item.link || ''

            // 提取发布日期并转换为时间戳
            const rawPubDate = item.pubDate?.['#cdata'] || item.pubDate?.['#text'] || item.pubDate || ''
            let pubDate: number | undefined
            if (rawPubDate) {
                try {
                    const date = new Date(rawPubDate)
                    if (!isNaN(date.getTime())) {
                        pubDate = date.getTime()
                    } else {
                        console.warn(`无效的日期格式: ${rawPubDate}`)
                    }
                } catch (error) {
                    console.warn(`日期解析失败: ${rawPubDate}`, error)
                }
            }

            // 提取描述
            const description = item.description?.['#cdata'] || item.description?.['#text'] || item.description || ''

            // 提取文件大小（从enclosure属性）
            const enclosureLength = item.enclosure?.['@_length'] || ''

            const magnet = item.enclosure?.['@_url'] || ''

            const author = item.author?.['#cdata'] || item.author?.['#text'] || item.author || ''

            const category = item.category?.['#cdata'] || item.category?.['#text'] || item.category || ''

            // 检查是否为磁力链接
            if (magnet && magnet.startsWith('magnet:') && title) {
                items.push({
                    title: title.trim(),
                    webLink: link.trim(),
                    author: author.trim(),
                    category: category.trim(),
                    magnetLink: magnet.trim(),
                    pubDate: pubDate || undefined,
                    description: description ? description.trim() : undefined,
                    size: enclosureLength || undefined
                })
            }
        }

        return items
    } catch (error) {
        console.error(`解析RSS失败: ${rssUrl}`, error)
        return []
    }
}

// 检查RSS是否需要更新
function shouldUpdateRSS(lastRefresh: number | null, refreshInterval: number, refreshUnit: string): boolean {
    if (!lastRefresh) return true

    const now = Date.now()
    const diffMinutes = (now - lastRefresh) / (1000 * 60)

    const intervalInMinutes = refreshUnit === 'hours' ? refreshInterval * 60 : refreshInterval

    return diffMinutes >= intervalInMinutes
}

// 定时任务处理函数
export async function processRSSFeeds(env: any) {
    const database = db(env)

    try {
        // 获取所有激活的RSS订阅
        const activeSubscriptions = await database
            .select()
            .from(rssSubscriptionsTable)
            .where(eq(rssSubscriptionsTable.isActive, 1))

        console.log(`找到 ${activeSubscriptions.length} 个激活的RSS订阅`)

        for (const subscription of activeSubscriptions) {
            // 检查是否需要更新
            if (!shouldUpdateRSS(subscription.lastRefresh, subscription.refreshInterval, subscription.refreshUnit)) {
                console.log(`RSS订阅 ${subscription.id} 还未到更新时间`)
                continue
            }

            console.log(`开始处理RSS订阅: ${subscription.rssUrl}`)

            // 解析RSS
            const rssItems = await parseRSSFeed(subscription.rssUrl)

            if (rssItems.length === 0) {
                console.log(`RSS订阅 ${subscription.id} 没有找到磁力链接`)
                continue
            }

            // 获取已存在的磁力链接，避免重复
            const existingMagnets = await database
                .select({ magnetLink: magnetLinksTable.magnetLink })
                .from(magnetLinksTable)
                .where(eq(magnetLinksTable.rssSubscriptionId, subscription.id))

            const existingMagnetSet = new Set(existingMagnets.map(m => m.magnetLink))

            // 过滤出新的磁力链接
            const newItems = rssItems.filter(item => !existingMagnetSet.has(item.magnetLink))

            if (newItems.length === 0) {
                console.log(`RSS订阅 ${subscription.id} 没有新的磁力链接`)
            } else {
                // 批量插入新的磁力链接
                const now = Date.now()
                const insertData = newItems.map(item => ({
                    rssSubscriptionId: subscription.id,
                    title: item.title,
                    magnetLink: item.magnetLink,
                    webLink: item.webLink,
                    author: item.author,
                    category: item.category,
                    pubDate: item.pubDate,
                    description: item.description,
                    size: item.size,
                    createdAt: now
                }))

                await database.insert(magnetLinksTable).values(insertData)
                console.log(`RSS订阅 ${subscription.id} 新增 ${newItems.length} 个磁力链接`)
            }

            // 更新最后刷新时间
            await database
                .update(rssSubscriptionsTable)
                .set({
                    lastRefresh: Date.now(),
                    updatedAt: Date.now()
                })
                .where(eq(rssSubscriptionsTable.id, subscription.id))
        }

        console.log('RSS定时任务处理完成')
    } catch (error) {
        console.error('RSS定时任务处理失败:', error)
        throw error
    }
}

// 手动触发RSS更新的API端点
app.post('/trigger',
    describeRoute({
        tags: ['磁力链接管理'],
        summary: '手动触发RSS更新',
        description: '手动触发RSS订阅更新任务，检查所有激活的RSS订阅并获取新的磁力链接',
        responses: responseSchema()
    }), async (c) => {
        try {
            await processRSSFeeds(c.env)
            return c.json({
                success: true,
                message: 'RSS更新任务已完成'
            })
        } catch (error) {
            return c.json({
                success: false,
                message: 'RSS更新任务失败',
                error: error instanceof Error ? error.message : '未知错误'
            }, 500)
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
            const { rssId, pageNum: pageNumStr, pageSize: pageSizeStr } = c.req.valid('query')
            const pageNum = parseInt(pageNumStr || '1')
            const pageSize = parseInt(pageSizeStr || '50')

            // 验证分页参数
            if (pageSize < 1 || pageSize > 100) {
                return c.json({
                    success: false,
                    message: 'pageSize参数必须在1-100之间'
                }, 400)
            }

            if (pageNum < 1) {
                return c.json({
                    success: false,
                    message: 'pageNum参数必须大于0'
                }, 400)
            }

            // 计算limit和offset
            const limit = pageSize
            const offset = (pageNum - 1) * pageSize

            // 构建基础查询
            let baseQuery = database
                .select({
                    id: magnetLinksTable.id,
                    title: magnetLinksTable.title,
                    magnetLink: magnetLinksTable.magnetLink,
                    pubDate: magnetLinksTable.pubDate,
                    description: magnetLinksTable.description,
                    size: magnetLinksTable.size,
                    createdAt: magnetLinksTable.createdAt,
                    rssSubscriptionId: magnetLinksTable.rssSubscriptionId
                })
                .from(magnetLinksTable)

            // 添加条件筛选
            if (rssId) {
                const rssIdNum = parseInt(rssId)
                if (isNaN(rssIdNum)) {
                    return c.json({
                        success: false,
                        message: 'rssId参数必须是有效的数字'
                    }, 400)
                }
                baseQuery = baseQuery.where(eq(magnetLinksTable.rssSubscriptionId, rssIdNum))
            }

            // 执行查询
            const magnetLinks = await baseQuery
                .limit(limit)
                .offset(offset)
                .orderBy(magnetLinksTable.createdAt)

            return c.json({
                success: true,
                message: '获取磁力链接列表成功',
                data: magnetLinks
            })
        } catch (error) {
            return c.json({
                success: false,
                message: '获取磁力链接列表失败',
                error: error instanceof Error ? error.message : '未知错误'
            }, 500)
        }
    })

export default app
