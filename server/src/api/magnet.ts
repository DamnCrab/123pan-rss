import { Hono } from 'hono'
import { db } from '../db'
import { eq, and, gt } from 'drizzle-orm'
import { rssSubscriptionsTable, magnetLinksTable } from '../db/schema'

const app = new Hono()

// RSS解析函数
async function parseRSSFeed(rssUrl: string) {
    try {
        const response = await fetch(rssUrl)
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`)
        }
        
        const xmlText = await response.text()
        
        // 简单的XML解析，提取RSS项目
        const items: Array<{
            title: string
            magnetLink: string
            pubDate?: string
            description?: string
            size?: string
        }> = []
        
        // 使用正则表达式解析RSS XML
        const itemRegex = /<item[^>]*>([\s\S]*?)<\/item>/gi
        const titleRegex = /<title><!\[CDATA\[([^\]]+)\]\]><\/title>|<title>([^<]+)<\/title>/i
        const linkRegex = /<link>([^<]+)<\/link>/i
        const pubDateRegex = /<pubDate>([^<]+)<\/pubDate>/i
        const descriptionRegex = /<description><!\[CDATA\[([^\]]+)\]\]><\/description>|<description>([^<]+)<\/description>/i
        const enclosureRegex = /<enclosure[^>]*length="([^"]+)"/i
        
        let match
        while ((match = itemRegex.exec(xmlText)) !== null) {
            const itemContent = match[1]
            
            const titleMatch = titleRegex.exec(itemContent)
            const linkMatch = linkRegex.exec(itemContent)
            const pubDateMatch = pubDateRegex.exec(itemContent)
            const descriptionMatch = descriptionRegex.exec(itemContent)
            const enclosureMatch = enclosureRegex.exec(itemContent)
            
            const title = titleMatch ? (titleMatch[1] || titleMatch[2] || '').trim() : ''
            const link = linkMatch ? linkMatch[1].trim() : ''
            
            // 检查是否为磁力链接
            if (link.startsWith('magnet:') && title) {
                items.push({
                    title,
                    magnetLink: link,
                    pubDate: pubDateMatch ? pubDateMatch[1].trim() : undefined,
                    description: descriptionMatch ? (descriptionMatch[1] || descriptionMatch[2] || '').trim() : undefined,
                    size: enclosureMatch ? enclosureMatch[1] : undefined
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
function shouldUpdateRSS(lastRefresh: string | null, refreshInterval: number, refreshUnit: string): boolean {
    if (!lastRefresh) return true
    
    const lastRefreshTime = new Date(lastRefresh)
    const now = new Date()
    const diffMinutes = (now.getTime() - lastRefreshTime.getTime()) / (1000 * 60)
    
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
                const now = new Date().toISOString()
                const insertData = newItems.map(item => ({
                    rssSubscriptionId: subscription.id,
                    title: item.title,
                    magnetLink: item.magnetLink,
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
                    lastRefresh: new Date().toISOString(),
                    updatedAt: new Date().toISOString()
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
app.post('/trigger', async (c) => {
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
app.get('/list', async (c) => {
    try {
        const database = db(c.env)
        const rssId = c.req.query('rssId')
        const limit = parseInt(c.req.query('limit') || '50')
        const offset = parseInt(c.req.query('offset') || '0')
        
        let query = database
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
        
        if (rssId) {
            query = query.where(eq(magnetLinksTable.rssSubscriptionId, parseInt(rssId)))
        }
        
        const magnetLinks = await query
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