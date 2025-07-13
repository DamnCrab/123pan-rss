import {db} from "../db";
import {cloudTokenTable} from "../db/schema";
import {eq} from "drizzle-orm";

interface pan123Response {
    code: number;
    message: string;
    data?: any;
    "x-traceID":string
}

// 获取access_token
export async function getAccessToken(env: Cloudflare.Env, clientId?: string, clientSecret?: string): Promise<string | null> {
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


// 创建离线下载任务（新版API - 两步流程）
export async function createOfflineDownload(env: Cloudflare.Env, params: {
    url: string;
    dirID?: number;
}): Promise<{ taskID: string } | undefined> {
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
                    select_file_id: selectFileIds,
                }],
                upload_dir: params.dirID || 0 // 默认根目录
            })
        });
        console.log({
            resource_list: [{
                resource_id: resourceId,
                select_file_id: selectFileIds,
            }],
            upload_dir: params.dirID || 0 // 默认根目录
        })
        console.log(submitResponse)

        if (!submitResponse.ok) {
            throw new Error(`提交下载任务失败: ${submitResponse.status}`);
        }

        const submitData = await submitResponse.json() as pan123Response;
        console.log(submitData);

        if (submitData.code !== 0) {
            throw new Error(`提交下载任务失败: ${submitData.message}`);
        }
        if (!submitData.data.task_list || !submitData.data.task_list.length){
            throw new Error(`未能获取任务ID: ${submitData.message}`);
        }

        return { taskID: submitData.data.task_list[0].task_id.toString() };
    } catch (error) {
        console.error('创建离线下载任务失败:', error);
    }
}

// 创建文件夹
export async function createFolder(env: any, params: {
    name: string;
    parentID: number;
}): Promise<{ dirID: number } | null> {
    const accessToken = await getAccessToken(env);
    if (!accessToken) {
        throw new Error('无法获取access_token');
    }

    try {
        const response = await fetch('https://open-api.123pan.com/upload/v1/file/mkdir', {
            method: 'POST',
            headers: {
                'Platform': 'open_platform',
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${accessToken}`
            },
            body: JSON.stringify({
                name: params.name,
                parentID: params.parentID
            })
        });

        if (!response.ok) {
            throw new Error(`创建文件夹失败: ${response.status}`);
        }

        const data = await response.json() as pan123Response;

        if (data.code !== 0) {
            throw new Error(`创建文件夹失败: ${data.message}`);
        }

        return { dirID: data.data.dirID };
    } catch (error) {
        console.error('创建文件夹失败:', error);
        return null;
    }
}

// 获取文件列表
export async function getFileList(env: Cloudflare.Env, params: {
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
