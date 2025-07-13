import {XMLParser} from 'fast-xml-parser'
import {db} from "../db";
import {magnetLinksTable, rssSubscriptionsTable} from '../db/schema';
import {eq, and} from "drizzle-orm";
import {createOfflineDownload, getOfflineDownloadProgress} from "./cloud123";

// RSS相关的类型定义
export interface RSSItem {
    title: string
    magnetLink: string
    webLink?: string
    author?: string
    category?: string
    pubDate?: number
    description?: string
    size?: string
}

export interface RSSUpdateResult {
    success: boolean
    subscriptionId: number
    newItems?: number
    skipped?: boolean
    error?: string
}

// ==================== 工具函数 ====================

// RSS解析函数 - 使用fast-xml-parser
export async function parseRSSFeed(rssUrl: string): Promise<RSSItem[]> {
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
        const items: RSSItem[] = []

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
export function shouldUpdateRSS(lastRefresh: number | null, refreshInterval: number, refreshUnit: string): boolean {
    if (!lastRefresh) return true

    const now = Date.now()
    const diffMinutes = (now - lastRefresh) / (1000 * 60)

    const intervalInMinutes = refreshUnit === 'hours' ? refreshInterval * 60 : refreshInterval

    return diffMinutes >= intervalInMinutes
}

// 数据验证和清理函数
function validateAndCleanRSSItems(items: RSSItem[]): RSSItem[] {
    return items.filter(item =>
        item.title && item.title.trim() &&
        item.magnetLink && item.magnetLink.trim()
    ).map(item => ({
        ...item,
        title: item.title.trim(),
        magnetLink: item.magnetLink.trim(),
        webLink: item.webLink || undefined,
        author: item.author || undefined,
        category: item.category || undefined,
        description: item.description || undefined,
        size: item.size || undefined
    }))
}

// ==================== 核心功能函数 ====================

/**
 * 更新单个RSS订阅
 * @param env Cloudflare环境变量
 * @param subscriptionId RSS订阅ID
 * @param forced 是否强制更新（忽略时间间隔）
 * @returns 更新结果
 */
export async function updateSingleRSS(env: any, subscriptionId: number, forced: boolean = false): Promise<RSSUpdateResult> {
    const database = db(env)

    try {
        // 获取RSS订阅信息
        const subscription = await database
            .select()
            .from(rssSubscriptionsTable)
            .where(eq(rssSubscriptionsTable.id, subscriptionId))
            .limit(1)

        if (subscription.length === 0) {
            return {
                success: false,
                subscriptionId,
                error: 'RSS订阅不存在'
            }
        }

        const rssData = subscription[0]

        // 检查是否需要更新
        if (!shouldUpdateRSS(rssData.lastRefresh, rssData.refreshInterval, rssData.refreshUnit) && !forced) {
            console.log(`RSS订阅 ${subscriptionId} 还未到更新时间`)
            return {
                success: true,
                subscriptionId,
                skipped: true
            }
        }

        console.log(`开始更新RSS订阅: ${rssData.rssUrl}`)

        // 解析RSS
        const rssItems = await parseRSSFeed(rssData.rssUrl)

        if (rssItems.length === 0) {
            console.log(`RSS订阅 ${subscriptionId} 没有找到磁力链接`)
            return {
                success: true,
                subscriptionId,
                newItems: 0
            }
        }

        // 获取已存在的磁力链接，避免重复
        const existingMagnets = await database
            .select({magnetLink: magnetLinksTable.magnetLink})
            .from(magnetLinksTable)
            .where(eq(magnetLinksTable.rssSubscriptionId, subscriptionId))

        const existingMagnetSet = new Set(existingMagnets.map(m => m.magnetLink))

        // 过滤出新的磁力链接并验证清理
        const newItems = validateAndCleanRSSItems(
            rssItems.filter(item => !existingMagnetSet.has(item.magnetLink))
        )

        if (newItems.length === 0) {
            console.log(`RSS订阅 ${subscriptionId} 没有新的磁力链接`)
        } else {
            // 批量插入新的磁力链接
            const now = Date.now()
            const insertData = newItems.map(item => ({
                rssSubscriptionId: subscriptionId,
                title: item.title,
                magnetLink: item.magnetLink,
                webLink: item.webLink || null,
                author: item.author || null,
                category: item.category || null,
                pubDate: item.pubDate || null,
                description: item.description || null,
                size: item.size || null,
                createdAt: now
            }))

            // 将数据分批插入，每批最多3条记录
            const batchSize = 3;
            for (let i = 0; i < insertData.length; i += batchSize) {
                const batch = insertData.slice(i, i + batchSize);
                await database.insert(magnetLinksTable).values(batch);
                console.log(`RSS订阅 ${subscriptionId} 批量插入: ${i + 1}-${Math.min(i + batchSize, insertData.length)}/${insertData.length}`);
            }

            console.log(`RSS订阅 ${subscriptionId} 新增 ${insertData.length} 个磁力链接`)
        }

        // 更新最后刷新时间
        await database
            .update(rssSubscriptionsTable)
            .set({
                lastRefresh: Date.now(),
                updatedAt: Date.now()
            })
            .where(eq(rssSubscriptionsTable.id, subscriptionId))

        return {
            success: true,
            subscriptionId,
            newItems: newItems.length
        }
    } catch (error) {
        console.error(`更新RSS订阅 ${subscriptionId} 失败:`, error)
        return {
            success: false,
            subscriptionId,
            error: error instanceof Error ? error.message : '未知错误'
        }
    }
}

/**
 * 更新所有RSS订阅
 * @param env Cloudflare环境变量
 * @param forced 是否强制更新（忽略时间间隔）
 * @param concurrencyLimit 并发限制数量
 * @returns 更新结果统计
 */
export async function updateAllRSS(env: any, forced: boolean = false, concurrencyLimit: number = 5): Promise<{
    total: number
    success: number
    failed: number
    skipped: number
    totalNewItems: number
    results: RSSUpdateResult[]
}> {
    const database = db(env)

    try {
        // 获取所有激活的RSS订阅
        const activeSubscriptions = await database
            .select()
            .from(rssSubscriptionsTable)
            .where(eq(rssSubscriptionsTable.isActive, 1))

        console.log(`找到 ${activeSubscriptions.length} 个激活的RSS订阅`)

        if (activeSubscriptions.length === 0) {
            return {
                total: 0,
                success: 0,
                failed: 0,
                skipped: 0,
                totalNewItems: 0,
                results: []
            }
        }

        // 并发处理所有RSS订阅
        const allResults: RSSUpdateResult[] = []

        for (let i = 0; i < activeSubscriptions.length; i += concurrencyLimit) {
            const batch = activeSubscriptions.slice(i, i + concurrencyLimit)
            console.log(`处理第 ${Math.floor(i / concurrencyLimit) + 1} 批RSS订阅 (${batch.length} 个)`)

            const batchPromises = batch.map(subscription =>
                updateSingleRSS(env, subscription.id, forced)
            )

            const batchResults = await Promise.allSettled(batchPromises)

            batchResults.forEach(result => {
                if (result.status === 'fulfilled') {
                    allResults.push(result.value)
                } else {
                    console.error('RSS订阅处理异常:', result.reason)
                    allResults.push({
                        success: false,
                        subscriptionId: -1,
                        error: result.reason?.message || '未知错误'
                    })
                }
            })
        }

        // 统计结果
        const stats = allResults.reduce((acc, result) => {
            if (result.success) {
                if (result.skipped) {
                    acc.skipped++
                } else {
                    acc.success++
                    acc.totalNewItems += result.newItems || 0
                }
            } else {
                acc.failed++
            }
            return acc
        }, {
            total: activeSubscriptions.length,
            success: 0,
            failed: 0,
            skipped: 0,
            totalNewItems: 0
        })

        console.log(`RSS批量更新完成: 总计 ${stats.total} 个, 成功 ${stats.success} 个, 跳过 ${stats.skipped} 个, 失败 ${stats.failed} 个, 新增 ${stats.totalNewItems} 个磁力链接`)

        return {
            ...stats,
            results: allResults
        }
    } catch (error) {
        console.error('批量更新RSS失败:', error)
        throw error
    }
}

/**
 * 创建一个磁力链接的下载任务
 * @param env Cloudflare环境变量
 * @param magnetLinkId 磁力链接ID
 * @returns 下载创建结果
 */
export async function createMagnetDownload(env: any, magnetLinkId: number): Promise<{ success: boolean; magnetLinkId: number; error: string; taskId: any }> {
    const database = db(env)

    try {
        // 获取磁力链接信息和对应的RSS订阅信息
        const result = await database
            .select({
                magnetLink: magnetLinksTable,
                rssSubscription: rssSubscriptionsTable
            })
            .from(magnetLinksTable)
            .innerJoin(rssSubscriptionsTable, eq(magnetLinksTable.rssSubscriptionId, rssSubscriptionsTable.id))
            .where(eq(magnetLinksTable.id, magnetLinkId))
            .limit(1)

        if (result.length === 0) {
            return {
                success: false,
                magnetLinkId,
                error: '磁力链接不存在',
                taskId: null
            }
        }

        const { magnetLink: link, rssSubscription } = result[0]

        // 检查是否已经有下载任务
        if (link.downloadTaskId) {
            return {
                success: false,
                magnetLinkId,
                error: '该磁力链接已有下载任务',
                taskId: link.downloadTaskId
            }
        }

        // 从RSS订阅表中获取cloudFolderId
        const cloudFolderId = rssSubscription.cloudFolderId
        if (!cloudFolderId) {
            return {
                success: false,
                magnetLinkId,
                error: 'RSS订阅未配置云盘文件夹ID',
                taskId: null
            }
        }

        const task = await createOfflineDownload(env, {
            url: link.magnetLink,
            dirID: parseInt(cloudFolderId),
        })
        if (task){
            const taskId = task.taskID
            
            // 更新数据库，保存taskId和下载状态
            await database
                .update(magnetLinksTable)
                .set({
                    downloadTaskId: taskId,
                    downloadStatus: 'downloading',
                    downloadCreatedAt: Date.now(),
                })
                .where(eq(magnetLinksTable.id, magnetLinkId))
            
            console.log(`磁力链接 ${magnetLinkId} 下载任务创建成功，taskId: ${taskId}`)
            
            return {
                success: true,
                magnetLinkId,
                error: '',
                taskId
            }
        } else {
            return {
                success: false,
                magnetLinkId,
                error: '创建下载任务失败，未返回taskId',
                taskId: null
            }
        }


    } catch (error) {
        console.error(`创建磁力链接 ${magnetLinkId} 下载任务异常:`, error)

        // 更新状态为失败
        try {
            await database
                .update(magnetLinksTable)
                .set({
                    downloadStatus: 'failed',
                    downloadFailReason: error instanceof Error ? error.message : '未知错误',
                    downloadCreatedAt: Date.now(),
                })
                .where(eq(magnetLinksTable.id, magnetLinkId))
        } catch (updateError) {
            console.error('更新下载状态失败:', updateError)
        }

        return {
            success: false,
            magnetLinkId,
            error: error instanceof Error ? error.message : '未知错误',
            taskId: null
        }
    }
}

/**
 * 重试一个磁力链接的下载
 * @param env Cloudflare环境变量
 * @param magnetLinkId 磁力链接ID
 * @returns 重试结果
 */
export async function retryMagnetDownload(env: any, magnetLinkId: number): Promise<{ 
    success: boolean; 
    magnetLinkId: number; 
    error: string;
    currentStatus?: string;
    previousStatus?: string;
    newStatus?: string;
    taskId?: any;
}> {
    const database = db(env)

    try {
        // 获取磁力链接信息
        const magnetLink = await database
            .select()
            .from(magnetLinksTable)
            .where(eq(magnetLinksTable.id, magnetLinkId))
            .limit(1)

        if (magnetLink.length === 0) {
            return {
                success: false,
                magnetLinkId,
                error: '磁力链接不存在'
            }
        }

        const link = magnetLink[0]

        // 检查当前状态是否允许重试
        if (link.downloadStatus === 'downloading') {
            return {
                success: false,
                magnetLinkId,
                error: '下载任务正在进行中，无需重试',
                currentStatus: 'downloading'
            }
        }

        if (link.downloadStatus === 'completed') {
            return {
                success: false,
                magnetLinkId,
                error: '下载任务已完成，无需重试',
                currentStatus: 'completed'
            }
        }

        // 重置下载状态并重新创建任务
        await database
            .update(magnetLinksTable)
            .set({
                downloadTaskId: null,
                downloadStatus: 'pending',
                downloadFailReason: null,
                downloadCreatedAt: null,
                downloadCompletedAt: null,
                downloadFileId: null
            })
            .where(eq(magnetLinksTable.id, magnetLinkId))

        console.log(`磁力链接 ${magnetLinkId} 状态已重置，准备重新创建下载任务`)

        // 调用创建下载函数
        const createResult = await createMagnetDownload(env, magnetLinkId)

        return {
            success: createResult.success,
            magnetLinkId,
            previousStatus: link.downloadStatus || undefined,
            newStatus: createResult.success ? 'downloading' : 'failed',
            taskId: createResult.taskId,
            error: createResult.error
        }
    } catch (error) {
        console.error(`重试磁力链接 ${magnetLinkId} 下载异常:`, error)

        return {
            success: false,
            magnetLinkId,
            error: error instanceof Error ? error.message : '未知错误'
        }
    }
}

/**
 * 批量下载未下载的磁力链接
 * @param env Cloudflare环境变量
 * @param concurrencyLimit 并发限制，默认为3
 * @param rssId 可选的RSS ID，如果提供则只下载该RSS的磁力链接，否则下载所有RSS的磁力链接
 * @returns 批量下载结果
 */
export async function downloadAllPendingMagnets(env: any, concurrencyLimit: number = 3, rssId?: number): Promise<{
    total: number
    success: number
    failed: number
    skipped: number
    results: Array<{ magnetLinkId: number; success: boolean; error?: string; taskId?: any }>
}> {
    const database = db(env)
    
    try {
        // 构建查询条件
        let whereConditions = [eq(magnetLinksTable.downloadStatus, 'pending')]
        
        // 如果提供了rssId，则添加RSS过滤条件
        if (rssId !== undefined) {
            whereConditions.push(eq(magnetLinksTable.rssSubscriptionId, rssId))
        }
        
        // 获取符合条件的磁力链接
        const pendingMagnets = await database
            .select()
            .from(magnetLinksTable)
            .where(and(...whereConditions))
        
        console.log(`找到 ${pendingMagnets.length} 个待下载的磁力链接`)
        
        if (pendingMagnets.length === 0) {
            return {
                total: 0,
                success: 0,
                failed: 0,
                skipped: 0,
                results: []
            }
        }
        
        const results: Array<{ magnetLinkId: number; success: boolean; error?: string; taskId?: any }> = []
        let successCount = 0
        let failedCount = 0
        let skippedCount = 0
        
        // 分批处理，避免并发过多
        for (let i = 0; i < pendingMagnets.length; i += concurrencyLimit) {
            const batch = pendingMagnets.slice(i, i + concurrencyLimit)
            
            const batchPromises = batch.map(async (magnet) => {
                try {
                    const result = await createMagnetDownload(env, magnet.id)
                    
                    if (result.success) {
                        successCount++
                        console.log(`磁力链接 ${magnet.id} 下载任务创建成功`)
                    } else {
                        failedCount++
                        console.log(`磁力链接 ${magnet.id} 下载任务创建失败: ${result.error}`)
                    }
                    
                    return {
                        magnetLinkId: magnet.id,
                        success: result.success,
                        error: result.error,
                        taskId: result.taskId
                    }
                } catch (error) {
                    failedCount++
                    const errorMessage = error instanceof Error ? error.message : '未知错误'
                    console.error(`磁力链接 ${magnet.id} 下载任务创建异常:`, error)
                    
                    return {
                        magnetLinkId: magnet.id,
                        success: false,
                        error: errorMessage
                    }
                }
            })
            
            const batchResults = await Promise.all(batchPromises)
            results.push(...batchResults)
            
            // 批次间稍作延迟，避免对API造成过大压力
            if (i + concurrencyLimit < pendingMagnets.length) {
                await new Promise(resolve => setTimeout(resolve, 1000))
            }
        }
        
        console.log(`批量下载完成: 总计 ${pendingMagnets.length}, 成功 ${successCount}, 失败 ${failedCount}, 跳过 ${skippedCount}`)
        
        return {
            total: pendingMagnets.length,
            success: successCount,
            failed: failedCount,
            skipped: skippedCount,
            results
        }
        
    } catch (error) {
        console.error('批量下载磁力链接异常:', error)
        throw error
    }
}

