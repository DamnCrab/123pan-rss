import { Hono } from 'hono';
import { z } from 'zod';
import 'zod-openapi/extend';
import { describeRoute } from "hono-openapi";
import { validator as zValidator } from "hono-openapi/zod";
import { db } from "../db";
import { eq, inArray } from 'drizzle-orm';
import { cloudTokenTable, magnetLinksTable } from "../db/schema";
import { responseSchema } from "../utils/responseSchema";
import { jwtMiddleware } from '../middleware/jwt';

const app = new Hono();

// 应用JWT中间件到所有123云盘路由
app.use('/*', jwtMiddleware);

// 配置响应schema
const configResponseSchema = z.object({
    accessToken: z.string().describe('access_token前缀（已脱敏）'),
    configured: z.boolean().describe('是否已配置')
}).openapi({
    ref: 'Cloud123ConfigResponse',
    example: {
        accessToken: 'eyJhbGciOi...',
        configured: true
    }
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

// 状态响应schema
const statusResponseSchema = z.object({
    configured: z.boolean().describe('是否已配置'),
    hasValidToken: z.boolean().describe('是否有有效token'),
    tokenExpiredAt: z.number().nullable().describe('token过期时间戳'),
    clientId: z.string().nullable().describe('客户端ID（已脱敏）')
}).openapi({
    ref: 'Cloud123StatusResponse',
    example: {
        configured: true,
        hasValidToken: true,
        tokenExpiredAt: 1703123456789,
        clientId: '123456...'
    }
});

interface pan123Response {
    code: number;
    message: string;
    data?: any;
    "x-traceID":string
}

// 获取access_token
export async function getAccessToken(env: any, clientId?: string, clientSecret?: string): Promise<string | null> {
    const database = db(env);

    try {
        // 如果提供了新的clientId和clientSecret，更新配置
        if (clientId && clientSecret) {
            const now = Date.now();
            const existing = await database.select().from(cloudTokenTable).limit(1);

            if (existing.length > 0) {
                await database.update(cloudTokenTable)
                    .set({
                        clientId,
                        clientSecret,
                        updatedAt: now
                    })
                    .where(eq(cloudTokenTable.id, existing[0].id));
            } else {
                await database.insert(cloudTokenTable).values({
                    clientId,
                    clientSecret,
                    createdAt: now,
                    updatedAt: now
                });
            }
        }

        // 获取当前配置
        const config = await database.select().from(cloudTokenTable).limit(1);
        if (config.length === 0) {
            throw new Error('未配置123云盘客户端信息');
        }

        const tokenConfig = config[0];

        // 检查token是否存在且未过期（提前1小时刷新）
        const now = Date.now();
        const oneHourMs = 60 * 60 * 1000;

        if (tokenConfig.accessToken && tokenConfig.expiredAt &&
            (tokenConfig.expiredAt - now) > oneHourMs) {
            return tokenConfig.accessToken;
        }

        // 请求新的access_token
        const response = await fetch('https://open-api.123pan.com/api/v1/access_token', {
            method: 'POST',
            headers: {
                'Platform': 'open_platform',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                clientID: tokenConfig.clientId,
                clientSecret: tokenConfig.clientSecret
            })
        });

        if (!response.ok) {
            throw new Error(`获取access_token失败: ${response.status}`);
        }

        const data = await response.json() as pan123Response;

        if (data.code !== 0) {
            throw new Error(`获取access_token失败: ${data.message}`);
        }

        const accessToken = data.data.accessToken;
        const expiredAt = now + (data.data.expiredIn * 1000); // 转换为毫秒时间戳

        // 更新数据库中的token
        await database.update(cloudTokenTable)
            .set({
                accessToken,
                expiredAt,
                updatedAt: now
            })
            .where(eq(cloudTokenTable.id, tokenConfig.id));

        return accessToken;

    } catch (error) {
        console.error('获取access_token失败:', error);
        return null;
    }
}

// 刷新token的定时任务函数
export async function refreshTokenIfNeeded(env: any): Promise<void> {
    const database = db(env);

    try {
        const config = await database.select().from(cloudTokenTable).limit(1);
        if (config.length === 0) {
            return;
        }

        const tokenConfig = config[0];
        const now = Date.now();
        const oneHourMs = 60 * 60 * 1000;

        // 如果token将在1小时内过期，刷新它
        if (tokenConfig.expiredAt && (tokenConfig.expiredAt - now) <= oneHourMs) {
            console.log('Token即将过期，开始刷新...');
            await getAccessToken(env);
            console.log('Token刷新完成');
        }
    } catch (error) {
        console.error('刷新token失败:', error);
    }
}

// 获取文件列表
export async function getFileList(env: any, params: {
    parentFileId?: number;
    limit?: number;
    searchData?: string;
    trashed?: boolean;
    searchMode?: number;
    lastFileId?: number;
}) {
    const accessToken = await getAccessToken(env);
    if (!accessToken) {
        throw new Error('无法获取access_token');
    }

    const queryParams = new URLSearchParams();
    queryParams.append('parentFileId', (params.parentFileId || 0).toString());
    queryParams.append('limit', (params.limit || 20).toString());

    if (params.searchData) {
        queryParams.append('searchData', params.searchData);
    }
    if (params.trashed !== undefined) {
        queryParams.append('trashed', params.trashed.toString());
    } else {
        queryParams.append('trashed', 'false'); // 默认不查看回收站
    }
    if (params.searchMode !== undefined) {
        queryParams.append('searchMode', params.searchMode.toString());
    }
    if (params.lastFileId !== undefined) {
        queryParams.append('lastFileId', params.lastFileId.toString());
    }

    const response = await fetch(`https://open-api.123pan.com/api/v2/file/list?${queryParams.toString()}`, {
        method: 'GET',
        headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Platform': 'open_platform'
        }
    });

    if (!response.ok) {
        throw new Error(`获取文件列表失败: ${response.status}`);
    }

    const data = await response.json() as pan123Response;

    if (data.code !== 0) {
        throw new Error(`获取文件列表失败: ${data.message}`);
    }

    return data.data;
}

// 配置123云盘客户端信息
app.post('/config',
    describeRoute({
        tags: ['123云盘'],
        summary: '配置123云盘客户端信息',
        description: '配置clientId和clientSecret，并获取access_token',
        security: [{bearerAuth: []}],
        responses: responseSchema(configResponseSchema)
    }),
    async (c) => {
        try {
            const env = c.env as Cloudflare.Env;

            const accessToken = await getAccessToken(env, env.pan123_client_id, env.pan123_client_secret);

            if (!accessToken) {
                return c.json({
                    success: false,
                    message: '配置失败，无法获取access_token',
                    error: '请检查clientId和clientSecret是否正确'
                }, 400);
            }

            return c.json({
                success: true,
                message: '123云盘配置成功',
                data: {
                    // accessToken: accessToken.substring(0, 10) + '...', // 只显示前10位
                    accessToken : accessToken,
                    configured: true
                }
            });
        } catch (error) {
            return c.json({
                success: false,
                message: '配置123云盘失败',
                error: error instanceof Error ? error.message : '未知错误'
            }, 500);
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
            const env = c.env;

            const fileList = await getFileList(env, params);

            const fileCount = fileList.fileList?.length || 0;
            const isLastPage = fileList.lastFileId === -1;

            return c.json({
                success: true,
                message: `获取文件列表成功，共${fileCount}个文件${isLastPage ? '（已到最后一页）' : ''}`,
                data: fileList
            });
        } catch (error) {
            return c.json({
                success: false,
                message: '获取文件列表失败',
                error: error instanceof Error ? error.message : '未知错误'
            }, 500);
        }
    }
);

// 获取当前配置状态
app.get('/status',
    describeRoute({
        tags: ['123云盘'],
        summary: '获取配置状态',
        description: '获取当前123云盘配置和token状态',
        security: [{bearerAuth: []}],
        responses: responseSchema(statusResponseSchema)
    }),
    async (c) => {
        try {
            const env = c.env;
            const database = db(env);

            const config = await database.select().from(cloudTokenTable).limit(1);

            if (config.length === 0) {
                return c.json({
                    success: true,
                    message: '123云盘未配置',
                    data: {
                        configured: false,
                        hasValidToken: false,
                        tokenExpiredAt: null,
                        clientId: null
                    }
                });
            }

            const tokenConfig = config[0];
            const now = Date.now();
            const isTokenValid = tokenConfig.accessToken && tokenConfig.expiredAt && tokenConfig.expiredAt > now;

            return c.json({
                success: true,
                message: `123云盘已配置，token${isTokenValid ? '有效' : '已过期或无效'}`,
                data: {
                    configured: true,
                    hasValidToken: isTokenValid,
                    tokenExpiredAt: tokenConfig.expiredAt,
                    clientId: tokenConfig.clientId ? tokenConfig.clientId.substring(0, 6) + '...' : null
                }
            });
        } catch (error) {
            return c.json({
                success: false,
                message: '获取123云盘状态失败',
                error: error instanceof Error ? error.message : '未知错误'
            }, 500);
        }
    }
);

// 创建离线下载任务（新版API - 两步流程）
export async function createOfflineDownload(env: any, params: {
    url: string;
    fileName?: string;
    dirID?: number;
    callBackUrl?: string;
}): Promise<{ taskID: string } | null> {
    const accessToken = await getAccessToken(env);
    if (!accessToken) {
        throw new Error('无法获取access_token');
    }

    try {
        // 第一步：解析磁链
        const resolveResponse = await fetch('https://www.123pan.com/api/v2/offline_download/task/resolve', {
            method: 'POST',
            headers: {
                'Platform': 'open_platform',
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${accessToken}`
            },
            body: JSON.stringify({
                urls: params.url
            })
        });

        if (!resolveResponse.ok) {
            throw new Error(`解析磁链失败: ${resolveResponse.status}`);
        }

        const resolveData = await resolveResponse.json() as pan123Response

        if (resolveData.code !== 0) {
            throw new Error(`解析磁链失败: ${resolveData.message}`);
        }

        const resourceList = resolveData.data.list;

        if (!resourceList || resourceList.length === 0) {
            throw new Error('磁链解析结果为空');
        }

        const resource = resourceList[0];
        if (resource.result !== 0) {
            throw new Error(`磁链解析失败: ${resource.err_msg || '未知错误'}`);
        }

        // 获取资源ID和所有文件ID
        const resourceId = resource.id;
        const selectFileIds = resource.files.map((file: any) => file.id);

        // 第二步：提交下载任务
        const submitResponse = await fetch('https://www.123pan.com/api/v2/offline_download/task/submit', {
            method: 'POST',
            headers: {
                'Platform': 'open_platform',
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${accessToken}`
            },
            body: JSON.stringify({
                resource_list: [{
                    resource_id: resourceId,
                    select_file_id: selectFileIds
                }],
                upload_dir: params.dirID || 0 // 默认根目录
            })
        });

        if (!submitResponse.ok) {
            throw new Error(`提交下载任务失败: ${submitResponse.status}`);
        }

        const submitData = await submitResponse.json() as pan123Response;

        if (submitData.code !== 0) {
            throw new Error(`提交下载任务失败: ${submitData.message}`);
        }

        // 返回任务ID（使用资源ID作为任务ID）
        return { taskID: resourceId.toString() };
    } catch (error) {
        console.error('创建离线下载任务失败:', error);
        return null;
    }
}

// 获取离线下载进度
export async function getOfflineDownloadProgress(env: any, taskID: string): Promise<{
    status: number;
    progress: number;
    fileID?: string;
    failReason?: string;
} | null> {
    const accessToken = await getAccessToken(env);
    if (!accessToken) {
        throw new Error('无法获取access_token');
    }

    try {
        const response = await fetch(`https://open-api.123pan.com/api/v1/offline/download/process?taskID=${taskID}`, {
            method: 'GET',
            headers: {
                'Platform': 'open_platform',
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${accessToken}`
            }
        });

        if (!response.ok) {
            throw new Error(`获取离线下载进度失败: ${response.status}`);
        }

        const data = await response.json() as pan123Response;

        if (data.code !== 0) {
            throw new Error(`获取离线下载进度失败: ${data.message}`);
        }

        return {
            status: data.data.status, // 0: 成功, 1: 失败, 2: 下载中
            progress: data.data.progress || 0,
            fileID: data.data.fileID,
            failReason: data.data.failReason
        };
    } catch (error) {
        console.error('获取离线下载进度失败:', error);
        return null;
    }
}

// 批量重试下载失败的任务
app.post('/offline/retry',
    describeRoute({
        summary: '批量重试下载失败的任务',
        description: '重新创建下载失败的离线下载任务',
        tags: ['123云盘'],
        requestBody: {
            content: {
                'application/json': {
                    schema: {
                        type: 'object',
                        properties: {
                            magnetIds: {
                                type: 'array',
                                items: { type: 'number' },
                                description: '要重试的磁力链接ID列表，如果不提供则重试所有失败的任务'
                            }
                        }
                    }
                }
            }
        },
        responses: {
            200: {
                description: '重试结果',
                content: {
                    'application/json': {
                        schema: {
                            type: 'object',
                            properties: {
                                success: { type: 'boolean' },
                                message: { type: 'string' },
                                data: {
                                    type: 'object',
                                    properties: {
                                        total: { type: 'number', description: '总共重试的任务数' },
                                        success: { type: 'number', description: '成功创建的任务数' },
                                        failed: { type: 'number', description: '创建失败的任务数' },
                                        details: {
                                            type: 'array',
                                            items: {
                                                type: 'object',
                                                properties: {
                                                    id: { type: 'number' },
                                                    title: { type: 'string' },
                                                    success: { type: 'boolean' },
                                                    error: { type: 'string' }
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }),
    async (c) => {
        try {
            const body = await c.req.json().catch(() => ({}));
            const { magnetIds } = body;

            const database = db(c.env);

            // 构建查询条件
            let query = database
                .select()
                .from(magnetLinksTable)
                .where(eq(magnetLinksTable.downloadStatus, 'failed'));

            // 如果提供了特定的ID列表，则只重试这些任务
            if (magnetIds && Array.isArray(magnetIds) && magnetIds.length > 0) {
                query = query.where(inArray(magnetLinksTable.id, magnetIds));
            }

            const failedTasks = await query;

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
                    // 重置下载状态为pending
                    await database
                        .update(magnetLinksTable)
                        .set({
                            downloadStatus: 'pending',
                            downloadTaskId: null,
                            downloadFileId: null,
                            downloadFailReason: null,
                            downloadCreatedAt: now,
                            downloadCompletedAt: null
                        })
                        .where(eq(magnetLinksTable.id, task.id));

                    // 创建新的离线下载任务
                    const result = await createOfflineDownload(c.env, {
                        url: task.magnetLink,
                        fileName: task.title,
                        callBackUrl: `${c.req.url.split('/api')[0]}/api/offline/callback`
                    });

                    if (result && result.taskID) {
                        // 更新任务ID和状态
                        await database
                            .update(magnetLinksTable)
                            .set({
                                downloadTaskId: result.taskID,
                                downloadStatus: 'downloading'
                            })
                            .where(eq(magnetLinksTable.id, task.id));

                        results.success++;
                        results.details.push({
                            id: task.id,
                            title: task.title,
                            success: true
                        });
                    } else {
                        // 创建失败，恢复失败状态
                        await database
                            .update(magnetLinksTable)
                            .set({
                                downloadStatus: 'failed',
                                downloadFailReason: '重试时创建离线下载任务失败'
                            })
                            .where(eq(magnetLinksTable.id, task.id));

                        results.failed++;
                        results.details.push({
                            id: task.id,
                            title: task.title,
                            success: false,
                            error: '创建离线下载任务失败'
                        });
                    }
                } catch (error) {
                    results.failed++;
                    results.details.push({
                        id: task.id,
                        title: task.title,
                        success: false,
                        error: error instanceof Error ? error.message : '未知错误'
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
            console.error('批量重试下载失败:', error);
            return c.json({
                success: false,
                message: '批量重试失败',
                error: error instanceof Error ? error.message : '未知错误'
            }, 500);
        }
    }
);

// 离线下载回调接口
app.post('/offline/callback',
    describeRoute({
        summary: '离线下载回调接口',
        description: '123云盘离线下载完成后的回调接口',
        tags: ['123云盘'],
    }),
    async (c) => {
        try {
            const body = await c.req.json();
            const { url, status, failReason, fileID } = body;

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
            console.error('处理离线下载回调失败:', error);
            return c.json({
                success: false,
                message: '回调处理失败',
                error: error instanceof Error ? error.message : '未知错误'
            }, 500);
        }
    }
);

export default app;
