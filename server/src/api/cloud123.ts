import { Hono } from 'hono';
import { z } from 'zod';
import 'zod-openapi/extend';
import { describeRoute } from "hono-openapi";
import { validator as zValidator } from "hono-openapi/zod";
import { db } from "../db";
import { eq, inArray, and } from 'drizzle-orm';
import {  magnetLinksTable, rssSubscriptionsTable } from "../db/schema";
import { responseSchema } from "../utils/responseSchema";
import { jwtMiddleware } from '../middleware/jwt';
import { getAccessToken, getFileList, getUserInfo, refreshTokenIfNeeded} from "../utils/cloud123";
import { cloudTokenTable } from "../db/schema";
import {retryMagnetDownload} from "../utils/rss";
import {handleError} from '../utils/errorHandler';
import {strictRateLimit} from '../middleware/rateLimiter';
import {optionalSecurityHeadersMiddleware} from '../middleware/security';

const app = new Hono();

// 应用JWT中间件到所有123云盘路由，但排除回调接口
app.use('/*', async (c, next) => {
    // 回调接口不需要JWT验证，因为是外部系统调用
    if (c.req.path.endsWith('/offline/callback')) {
        await next();
        return;
    }
    // 其他接口需要JWT验证
    return jwtMiddleware(c, next);
});

// 文件列表查询参数schema
const fileListQuerySchema = z.object({
    parentFileId: z.string().regex(/^\d+$/, 'parentFileId必须是数字').transform(Number).default('0'),
    limit: z.string().regex(/^\d+$/, 'limit必须是数字').transform(Number).default('20'),
    searchData: z.string().optional().describe('搜索关键字'),
    trashed: z.string().transform(val => val === 'true').default('false').describe('是否查看回收站'),
    searchMode: z.string().regex(/^[01]$/, 'searchMode只能是0或1').transform(Number).default('0'),
    lastFileId: z.string().regex(/^\d+$/, 'lastFileId必须是数字').transform(Number).optional()
}).openapi({
    ref: 'FileListQuery',
    example: {
        parentFileId: '0',
        limit: '20',
        searchData: '测试文件',
        trashed: 'false',
        searchMode: '0'
    }
});

// 文件信息schema
const fileInfoSchema = z.object({
    fileId: z.number().describe('文件ID'),
    filename: z.string().describe('文件名'),
    type: z.number().describe('文件类型：0-文件，1-文件夹'),
    size: z.number().describe('文件大小'),
    etag: z.string().describe('文件MD5'),
    status: z.number().describe('文件审核状态'),
    parentFileId: z.number().describe('父文件夹ID'),
    category: z.number().describe('文件分类'),
    trashed: z.number().describe('是否在回收站：0-否，1-是')
}).openapi({
    ref: 'FileInfo',
    example: {
        fileId: 123456,
        filename: '示例文件.txt',
        type: 0,
        size: 1024,
        etag: 'abc123def456',
        status: 1,
        parentFileId: 0,
        category: 0,
        trashed: 0
    }
});

// 文件列表响应schema
const fileListResponseSchema = z.object({
    lastFileId: z.number().describe('最后一个文件ID，-1表示最后一页'),
    fileList: z.array(fileInfoSchema).describe('文件列表')
}).openapi({
    ref: 'FileListResponse',
    example: {
        lastFileId: 123456,
        fileList: [
            {
                fileId: 123456,
                filename: '示例文件.txt',
                type: 0,
                size: 1024,
                etag: 'abc123def456',
                status: 1,
                parentFileId: 0,
                category: 0,
                trashed: 0
            }
        ]
    }
});

// VIP信息schema
const vipInfoSchema = z.object({
    vipLevel: z.number().describe('VIP等级：1-VIP，2-SVIP，3-长期VIP'),
    vipLabel: z.string().describe('VIP级别名称'),
    startTime: z.string().describe('开始时间'),
    endTime: z.string().describe('结束时间')
}).openapi({
    ref: 'VipInfo',
    example: {
        vipLevel: 1,
        vipLabel: 'VIP',
        startTime: '2024-01-01 00:00:00',
        endTime: '2024-12-31 23:59:59'
    }
});

// 开发者信息schema
const developerInfoSchema = z.object({
    startTime: z.string().describe('开发者权益开始时间'),
    endTime: z.string().describe('开发者权益结束时间')
}).openapi({
    ref: 'DeveloperInfo',
    example: {
        startTime: '2024-01-01 00:00:00',
        endTime: '2024-12-31 23:59:59'
    }
});

// 用户信息schema（脱敏处理）
const userInfoSchema = z.object({
    uid: z.number().describe('用户账号ID'),
    nickname: z.string().describe('昵称'),
    headImage: z.string().describe('头像URL'),
    passport: z.string().describe('手机号码（脱敏）'),
    mail: z.string().describe('邮箱（脱敏）'),
    spaceUsed: z.number().describe('已用空间（字节）'),
    spacePermanent: z.number().describe('永久空间（字节）'),
    spaceTemp: z.number().describe('临时空间（字节）'),
    spaceTempExpr: z.string().describe('临时空间到期日'),
    vip: z.boolean().describe('是否会员'),
    directTraffic: z.number().describe('剩余直链流量'),
    isHideUID: z.boolean().describe('直链链接是否隐藏UID'),
    httpsCount: z.number().describe('https数量'),
    vipInfo: vipInfoSchema.nullable().describe('VIP信息，非VIP为null'),
    developerInfo: developerInfoSchema.nullable().describe('开发者权益信息')
}).openapi({
    ref: 'UserInfo',
    example: {
        uid: 123456,
        nickname: '用户昵称',
        headImage: 'https://example.com/avatar.jpg',
        passport: '138****8888',
        mail: 'user****@example.com',
        spaceUsed: 1073741824,
        spacePermanent: 107374182400,
        spaceTemp: 0,
        spaceTempExpr: '2024-12-31 23:59:59',
        vip: true,
        directTraffic: 1000000000,
        isHideUID: false,
        httpsCount: 100,
        vipInfo: {
            vipLevel: 1,
            vipLabel: 'VIP',
            startTime: '2024-01-01 00:00:00',
            endTime: '2024-12-31 23:59:59'
        },
        developerInfo: null
    }
});






// 获取123云盘状态信息
app.get('/status',
    describeRoute({
        tags: ['123云盘'],
        summary: '获取123云盘状态信息',
        description: '获取123云盘的详细状态信息，包括配置状态、令牌有效性等',
        security: [{bearerAuth: []}],
        responses: responseSchema(z.object({
            configured: z.boolean().describe('是否已配置'),
            hasValidToken: z.boolean().describe('是否有有效的访问令牌'),
            tokenExpiredAt: z.number().nullable().describe('令牌过期时间戳'),
            clientId: z.string().nullable().describe('客户端ID'),
            tokenAge: z.number().describe('token使用天数'),
            refreshThreshold: z.number().describe('刷新阈值（天）'),
            nextRefreshDate: z.number().nullable().describe('下次刷新时间戳')
        }).openapi({
            ref: 'Cloud123Status',
            example: {
                configured: true,
                hasValidToken: true,
                tokenExpiredAt: 1703980800000,
                clientId: 'your_client_id',
                tokenAge: 30,
                refreshThreshold: 85,
                nextRefreshDate: 1703980800000
            }
        }))
    }),
    async (c) => {
        try {
            const env = c.env as Cloudflare.Env;
            const database = db(env);

            // 获取数据库中的配置
            let config = await database.select().from(cloudTokenTable).limit(1);
            
            // 如果数据库中没有配置，检查环境变量
            if (config.length === 0) {
                const hasEnvConfig = !!(env.pan123_client_id && env.pan123_client_secret);
                
                return c.json({
                    success: true,
                    message: '获取状态信息成功',
                    data: {
                        configured: hasEnvConfig,
                        hasValidToken: false,
                        tokenExpiredAt: null,
                        clientId: hasEnvConfig ? env.pan123_client_id : null,
                        tokenAge: 0,
                        refreshThreshold: 85,
                        nextRefreshDate: null
                    }
                });
            }

            const tokenConfig = config[0];
            const now = Date.now();
            const dayMs = 24 * 60 * 60 * 1000;
            const refreshThreshold = 85;
            
            // 基于85天刷新策略检查令牌是否有效
            let hasValidToken = false;
            let tokenAge = 0;
            let nextRefreshDate = null;
            
            if (tokenConfig.accessToken && tokenConfig.createdAt) {
                tokenAge = Math.floor((now - tokenConfig.createdAt) / dayMs);
                hasValidToken = tokenAge < refreshThreshold;
                if (hasValidToken) {
                    nextRefreshDate = tokenConfig.createdAt + (refreshThreshold * dayMs);
                }
            } else if (tokenConfig.accessToken && tokenConfig.expiredAt) {
                // 兼容旧逻辑：基于过期时间检查
                const oneHourMs = 60 * 60 * 1000;
                hasValidToken = (tokenConfig.expiredAt - now) > oneHourMs;
            }

            return c.json({
                success: true,
                message: '获取状态信息成功',
                data: {
                    configured: true,
                    hasValidToken,
                    tokenExpiredAt: tokenConfig.expiredAt,
                    clientId: tokenConfig.clientId,
                    tokenAge,
                    refreshThreshold,
                    nextRefreshDate
                }
            });
        } catch (error) {
            return handleError(error, c, '获取123云盘状态失败');
        }
    }
);

// 检查和刷新token状态
app.post('/token/refresh',
    describeRoute({
        tags: ['123云盘'],
        summary: '检查和刷新token状态',
        description: '手动检查token状态并根据85天刷新策略进行刷新',
        security: [{bearerAuth: []}],
        responses: responseSchema(z.object({
            tokenAge: z.number().describe('token使用天数'),
            refreshThreshold: z.number().describe('刷新阈值（天）'),
            needsRefresh: z.boolean().describe('是否需要刷新'),
            refreshed: z.boolean().describe('是否已刷新'),
            nextRefreshDate: z.string().nullable().describe('下次刷新时间')
        }).openapi({
            ref: 'TokenRefreshStatus',
            example: {
                tokenAge: 30,
                refreshThreshold: 85,
                needsRefresh: false,
                refreshed: false,
                nextRefreshDate: '2024-12-31T23:59:59.000Z'
            }
        }))
    }),
    async (c) => {
        try {
            const env = c.env as Cloudflare.Env;
            const database = db(env);

            const config = await database.select().from(cloudTokenTable).limit(1);
            if (config.length === 0) {
                return c.json({
                    success: false,
                    message: '未找到token配置'
                }, 200);
            }

            const tokenConfig = config[0];
            const now = Date.now();
            const dayMs = 24 * 60 * 60 * 1000;
            const refreshThreshold = 85;
            
            let tokenAge = 0;
            let needsRefresh = false;
            let nextRefreshDate = null;
            
            if (tokenConfig.createdAt) {
                tokenAge = Math.floor((now - tokenConfig.createdAt) / dayMs);
                needsRefresh = tokenAge >= refreshThreshold;
                if (!needsRefresh) {
                    nextRefreshDate = new Date(tokenConfig.createdAt + (refreshThreshold * dayMs)).toISOString();
                }
            }

            // 执行刷新检查
            await refreshTokenIfNeeded(env);
            
            // 检查是否已刷新（通过比较updatedAt时间）
            const updatedConfig = await database.select().from(cloudTokenTable).limit(1);
            const refreshed = updatedConfig.length > 0 && 
                updatedConfig[0].updatedAt > tokenConfig.updatedAt;

            if (refreshed) {
                // 重新计算刷新后的状态
                const newTokenConfig = updatedConfig[0];
                tokenAge = 0; // 新token，重置为0天
                needsRefresh = false;
                nextRefreshDate = new Date(newTokenConfig.createdAt + (refreshThreshold * dayMs)).toISOString();
            }

            return c.json({
                success: true,
                message: refreshed ? 'Token已刷新' : `Token状态检查完成，已使用${tokenAge}天`,
                data: {
                    tokenAge,
                    refreshThreshold,
                    needsRefresh,
                    refreshed,
                    nextRefreshDate
                }
            });
        } catch (error) {
            return handleError(error, c, '检查token状态失败');
        }
    }
);

// 获取用户信息
app.get('/user/info',
    optionalSecurityHeadersMiddleware, // 可选的安全头验证
    describeRoute({
        tags: ['123云盘'],
        summary: '获取用户信息',
        description: '获取当前123云盘用户的详细信息，包括空间使用情况、VIP状态等。敏感信息已脱敏处理',
        security: [{bearerAuth: []}],
        responses: responseSchema(userInfoSchema)
    }),
    async (c) => {
        try {
            const env = c.env as Cloudflare.Env;

            const userInfo = await getUserInfo(env);

            if (!userInfo) {
                return c.json({
                    success: false,
                    message: '获取用户信息失败，请检查123云盘配置'
                }, 200);
            }

            // 脱敏处理敏感信息
            const sanitizedUserInfo = {
                ...userInfo,
                // 手机号脱敏：保留前3位和后4位
                passport: userInfo.passport ? 
                    userInfo.passport.replace(/(\d{3})\d{4}(\d{4})/, '$1****$2') : '',
                // 邮箱脱敏：保留用户名前2位和域名
                mail: userInfo.mail ? 
                    userInfo.mail.replace(/(.{2}).*(@.*)/, '$1****$2') : ''
            };

            return c.json({
                success: true,
                message: '获取用户信息成功',
                data: sanitizedUserInfo
            });
        } catch (error) {
            return handleError(error, c, '获取用户信息失败');
        }
    }
);

// 获取文件列表
app.get('/files',
    describeRoute({
        tags: ['123云盘'],
        summary: '获取文件列表',
        description: '逐级查询123云盘文件列表，支持搜索和分页',
        security: [{bearerAuth: []}],
        responses: responseSchema(fileListResponseSchema)
    }),
    zValidator('query', fileListQuerySchema),
    async (c) => {
        try {
            const params = c.req.valid('query');
            const env = c.env as Cloudflare.Env;

            const fileList = await getFileList(env, params);

            const fileCount = fileList.fileList?.length || 0;
            const isLastPage = fileList.lastFileId === -1;

            return c.json({
                success: true,
                message: `获取文件列表成功，共${fileCount}个文件${isLastPage ? '（已到最后一页）' : ''}`,
                data: fileList
            });
        } catch (error) {
            return handleError(error, c, '获取文件列表失败');
        }
    }
);

// 批量重试请求schema
const retryRequestSchema = z.object({
    magnetIds: z.array(z.number()).optional().describe('要重试的磁力链接ID列表'),
    rssSubscriptionIds: z.array(z.number()).optional().describe('要重试的RSS订阅ID列表，将重试该订阅下所有失败的任务')
}).openapi({
    ref: 'RetryRequest',
    example: {
        magnetIds: [1, 2, 3],
        rssSubscriptionIds: [1, 2]
    }
});

// 重试结果详情schema
const retryDetailSchema = z.object({
    id: z.number().describe('磁力链接ID'),
    title: z.string().describe('磁力链接标题'),
    success: z.boolean().describe('是否重试成功'),
    error: z.string().optional().describe('错误信息')
}).openapi({
    ref: 'RetryDetail',
    example: {
        id: 1,
        title: '示例磁力链接',
        success: true
    }
});

// 重试结果响应schema
const retryResponseSchema = z.object({
    total: z.number().describe('总共重试的任务数'),
    success: z.number().describe('成功创建的任务数'),
    failed: z.number().describe('创建失败的任务数'),
    details: z.array(retryDetailSchema).describe('重试详情列表')
}).openapi({
    ref: 'RetryResponse',
    example: {
        total: 3,
        success: 2,
        failed: 1,
        details: [
            {
                id: 1,
                title: '示例磁力链接1',
                success: true
            },
            {
                id: 2,
                title: '示例磁力链接2',
                success: false,
                error: '创建下载任务失败'
            }
        ]
    }
});

// 批量重试下载失败的任务
app.post('/offline/retry',
    strictRateLimit, // 应用严格速率限制
    describeRoute({
        tags: ['123云盘'],
        summary: '批量重试下载失败的任务',
        description: '重新创建下载失败的离线下载任务。如果magnetIds和rssSubscriptionIds都不提供，则重试所有失败的任务',
        security: [{bearerAuth: []}],
        responses: responseSchema(retryResponseSchema)
    }),
    zValidator('json', retryRequestSchema),
    async (c) => {
        try {
            const { magnetIds, rssSubscriptionIds } = c.req.valid('json');
            const env = c.env as Cloudflare.Env;
            const database = db(env);

            // 构建查询条件
            // 构建where条件数组
            const whereConditions = [eq(magnetLinksTable.downloadStatus, 'failed')];

            // 如果提供了特定的磁力链接ID列表，则只重试这些任务
            if (magnetIds && Array.isArray(magnetIds) && magnetIds.length > 0) {
                whereConditions.push(inArray(magnetLinksTable.id, magnetIds));
            }
            // 如果提供了RSS订阅ID列表，则重试这些订阅下的所有失败任务
            else if (rssSubscriptionIds && Array.isArray(rssSubscriptionIds) && rssSubscriptionIds.length > 0) {
                whereConditions.push(inArray(magnetLinksTable.rssSubscriptionId, rssSubscriptionIds));
            }


            // 需要JOIN查询获取RSS订阅信息以获取cloudFolderId
            // 构建where条件数组
            const joinWhereConditions = [eq(magnetLinksTable.downloadStatus, 'failed')];

            // 根据条件添加额外的where子句
            if (magnetIds && Array.isArray(magnetIds) && magnetIds.length > 0) {
                joinWhereConditions.push(inArray(magnetLinksTable.id, magnetIds));
            } else if (rssSubscriptionIds && Array.isArray(rssSubscriptionIds) && rssSubscriptionIds.length > 0) {
                joinWhereConditions.push(inArray(magnetLinksTable.rssSubscriptionId, rssSubscriptionIds));
            }

            const failedTasksQuery = database
                .select({
                    magnet: magnetLinksTable,
                    rss: rssSubscriptionsTable
                })
                .from(magnetLinksTable)
                .innerJoin(rssSubscriptionsTable, eq(magnetLinksTable.rssSubscriptionId, rssSubscriptionsTable.id))
                .where(and(...joinWhereConditions));

            const failedTasksWithRss = await failedTasksQuery;

            const failedTasks = failedTasksWithRss.map(item => item.magnet);
            const rssMap = new Map(failedTasksWithRss.map(item => [item.magnet.id, item.rss]));

            if (failedTasks.length === 0) {
                return c.json({
                    success: true,
                    message: '没有找到需要重试的失败任务',
                    data: {
                        total: 0,
                        success: 0,
                        failed: 0,
                        details: []
                    }
                });
            }

            const results = {
                total: failedTasks.length,
                success: 0,
                failed: 0,
                details: [] as Array<{
                    id: number;
                    title: string;
                    success: boolean;
                    error?: string;
                }>
            };

            const now = Date.now();

            // 批量重试每个失败的任务
            for (const task of failedTasks) {
                try {
                    const retryResult = await retryMagnetDownload(env, task.id);
                    
                    if (retryResult.success) {
                        results.success++;
                        results.details.push({
                            id: task.id,
                            title: task.title,
                            success: true
                        });
                    } else {
                        results.failed++;
                        results.details.push({
                            id: task.id,
                            title: task.title,
                            success: false,
                            error: retryResult.error || '重试失败'
                        });
                    }
                } catch (error) {
                    results.failed++;
                    results.details.push({
                        id: task.id,
                        title: task.title,
                        success: false,
                        error: '重试失败'
                    });

                    console.error(`重试任务 ${task.id} 失败:`, error);
                }
            }

            return c.json({
                success: true,
                message: `批量重试完成，成功: ${results.success}，失败: ${results.failed}`,
                data: results
            });
        } catch (error) {
            return handleError(error, c, '批量重试下载失败');
        }
    }
);

// 离线下载回调请求schema
const callbackRequestSchema = z.object({
    url: z.string().describe('磁力链接URL'),
    status: z.number().describe('下载状态，0表示成功，1表示失败'),
    failReason: z.string().optional().describe('失败原因'),
    fileID: z.string().optional().describe('下载成功后的文件ID')
}).openapi({
    ref: 'CallbackRequest',
    example: {
        url: 'magnet:?xt=urn:btih:example',
        status: 0,
        fileID: '123456'
    }
});

// 离线下载回调接口 暂时废弃 官方接口不支持
app.post('/offline/callback',
    describeRoute({
        tags: ['123云盘'],
        summary: '离线下载回调接口',
        description: '123云盘离线下载完成后的回调接口，用于更新下载状态',
        responses: responseSchema(z.object({
            success: z.boolean(),
            message: z.string()
        }).openapi({
            ref: 'CallbackResponse',
            example: {
                success: true,
                message: '回调处理成功'
            }
        }))
    }),
    zValidator('json', callbackRequestSchema),
    async (c) => {
        try {
            const { url, status, failReason, fileID } = c.req.valid('json');

            console.log('收到离线下载回调:', { url, status, failReason, fileID });

            const database = db(c.env);

            // 根据磁力链接查找对应的记录
            const magnetRecord = await database
                .select()
                .from(magnetLinksTable)
                .where(eq(magnetLinksTable.magnetLink, url))
                .limit(1);

            if (magnetRecord.length === 0) {
                console.log('未找到对应的磁力链接记录:', url);
                return c.json({ success: true, message: '未找到对应记录' });
            }

            const record = magnetRecord[0];
            const now = Date.now();

            // 更新下载状态
            const updateData: any = {
                downloadStatus: status === 0 ? 'completed' : 'failed',
                downloadCompletedAt: now
            };

            if (status === 0 && fileID) {
                updateData.downloadFileId = fileID;
            }

            if (status === 1 && failReason) {
                updateData.downloadFailReason = failReason;
            }

            await database
                .update(magnetLinksTable)
                .set(updateData)
                .where(eq(magnetLinksTable.id, record.id));

            console.log(`更新磁力链接 ${record.id} 下载状态为: ${updateData.downloadStatus}`);

            return c.json({ success: true, message: '回调处理成功' });
        } catch (error) {
            return handleError(error, c, '处理离线下载回调失败');
        }
    }
);

export default app;
