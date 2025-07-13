import {z} from "zod";
import {resolver} from "hono-openapi/zod";

// 统一的API响应格式
export const apiResponseSchema = z.object({
    success: z.boolean().describe('操作是否成功'),
    message: z.string().describe('响应消息'),
    data: z.any().optional().describe('响应数据')
}).openapi({
    ref: 'ApiResponse'
})

// 兼容旧版本的导出
export const successResponseSchema = apiResponseSchema
export const errorResponseSchema = apiResponseSchema

export const responseSchema = (successSchema?: any) => {
    return {
        200: {
            description: '请求成功',
            content: {
                'application/json': {
                    schema: resolver(successSchema ? z.object({
                        success: z.boolean(),
                        message: z.string(),
                        data: successSchema
                    }) : apiResponseSchema)
                }
            }
        },
        404: {
            description: '资源未找到',
            content: {
                'application/json': {
                    schema: resolver(apiResponseSchema)
                }
            }
        },
        500: {
            description: '服务器内部错误',
            content: {
                'application/json': {
                    schema: resolver(apiResponseSchema)
                }
            }
        }
    }
}
