import {db} from "../db";
import {cloudTokenTable} from "../db/schema";
import {eq} from "drizzle-orm";

interface pan123Response {
    code: number;
    message: string;
    data?: any;
    "x-traceID": string
}

// 获取access_token
export async function getAccessToken(env: Cloudflare.Env): Promise<string | null> {
    const database = db(env);

    try {
        // 获取当前配置
        let config = await database.select().from(cloudTokenTable).limit(1);

        // 如果数据库中没有配置，尝试从环境变量中获取并保存
        if (config.length === 0) {
            if (!env.pan123_client_secret || !env.pan123_client_id) {
                throw new Error('未配置123云盘客户端信息，请在环境变量中设置 pan123_client_id 和 pan123_client_secret');
            }

            // 从环境变量中获取配置并保存到数据库
            const now = Date.now();
            await database.insert(cloudTokenTable).values({
                clientId: env.pan123_client_id,
                clientSecret: env.pan123_client_secret,
                createdAt: now,
                updatedAt: now
            });

            // 重新查询配置
            config = await database.select().from(cloudTokenTable).limit(1);
        }

        const tokenConfig = config[0];

        // 检查token是否存在且在85天刷新周期内
        const now = Date.now();
        const dayMs = 24 * 60 * 60 * 1000; // 一天的毫秒数
        const refreshThreshold = 85 * dayMs; // 85天的毫秒数

        if (tokenConfig.accessToken && tokenConfig.createdAt) {
            const tokenAge = now - tokenConfig.createdAt;
            // 如果token使用时间少于85天，直接返回现有token
            if (tokenAge < refreshThreshold) {
                const usedDays = Math.floor(tokenAge / dayMs);
                const remainingDays = 85 - usedDays;
                console.log(`使用现有token，已使用${usedDays}天，还有${remainingDays}天后需要刷新`);
                return tokenConfig.accessToken;
            }
            console.log(`Token已使用${Math.floor(tokenAge / dayMs)}天，需要刷新`);
        } else if (tokenConfig.accessToken && tokenConfig.expiredAt) {
            // 兼容旧逻辑：如果没有createdAt但有expiredAt，使用原来的1小时提前刷新逻辑
            const oneHourMs = 60 * 60 * 1000;
            if ((tokenConfig.expiredAt - now) > oneHourMs) {
                console.log('使用现有token（基于过期时间检查）');
                return tokenConfig.accessToken;
            }
            console.log('Token即将过期，需要刷新');
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
                createdAt: now, // 更新创建时间，用于85天刷新计算
                updatedAt: now
            })
            .where(eq(cloudTokenTable.id, tokenConfig.id));

        const nextRefreshDate = new Date(now + (85 * 24 * 60 * 60 * 1000));
        console.log(`新token获取成功，下次刷新时间: ${nextRefreshDate.toISOString()}`);
        
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
        
        // accessToken有效期90天，在85天后刷新
        const dayMs = 24 * 60 * 60 * 1000; // 一天的毫秒数
        const refreshThreshold = 85 * dayMs; // 85天的毫秒数
        
        // 检查token是否存在以及是否需要刷新
        if (tokenConfig.accessToken && tokenConfig.createdAt) {
            const tokenAge = now - tokenConfig.createdAt;
            
            // 如果token已使用超过85天，则刷新
            if (tokenAge >= refreshThreshold) {
                console.log(`Token已使用${Math.floor(tokenAge / dayMs)}天，开始刷新...`);
                await getAccessToken(env);
                console.log('Token刷新完成');
            } else {
                const remainingDays = Math.floor((refreshThreshold - tokenAge) / dayMs);
                console.log(`Token还有${remainingDays}天后需要刷新`);
            }
        } else if (tokenConfig.expiredAt) {
            // 兼容旧逻辑：如果没有createdAt但有expiredAt，使用原来的1小时提前刷新逻辑
            const oneHourMs = 60 * 60 * 1000;
            if ((tokenConfig.expiredAt - now) <= oneHourMs) {
                console.log('Token即将过期，开始刷新...');
                await getAccessToken(env);
                console.log('Token刷新完成');
            }
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

        if (!submitResponse.ok) {
            throw new Error(`提交下载任务失败: ${submitResponse.status}`);
        }

        const submitData = await submitResponse.json() as pan123Response;
        console.log(submitData);

        if (submitData.code !== 0) {
            throw new Error(`提交下载任务失败: ${submitData.message}`);
        }
        if (!submitData.data.task_list || !submitData.data.task_list.length) {
            throw new Error(`未能获取任务ID: ${submitData.message}`);
        }

        return {taskID: submitData.data.task_list[0].task_id.toString()};
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

        return {dirID: data.data.dirID};
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

// 获取用户信息
export async function getUserInfo(env: Cloudflare.Env): Promise<any | null> {
    const accessToken = await getAccessToken(env);
    if (!accessToken) {
        throw new Error('无法获取access_token');
    }

    try {
        const response = await fetch('https://open-api.123pan.com/api/v1/user/info', {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Platform': 'open_platform'
            }
        });

        if (!response.ok) {
            throw new Error(`获取用户信息失败: ${response.status}`);
        }

        const data = await response.json() as pan123Response;

        if (data.code !== 0) {
            throw new Error(`获取用户信息失败: ${data.message}`);
        }

        return data.data;
    } catch (error) {
        console.error('获取用户信息失败:', error);
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
