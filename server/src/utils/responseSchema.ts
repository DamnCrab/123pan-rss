import { z } from 'zod'
import 'zod-openapi/extend'
import { apiResponseSchema } from './openApiSchemas'
import {resolver} from "hono-openapi/zod";

// 使用统一的API响应格式schema

// 兼容旧版本的导出
export const successResponseSchema = apiResponseSchema()
export const errorResponseSchema = apiResponseSchema()

export const responseSchema = <T extends z.ZodTypeAny>(successSchema?: T) => {
    return {
        200: {
            description: '请求成功',
            content: {
                'application/json': {
                    schema: resolver(apiResponseSchema(successSchema))
                }
            }
        },
        404: {
            description: '资源未找到',
            content: {
                'application/json': {
                    schema: resolver(apiResponseSchema())
                }
            }
        },
        500: {
            description: '服务器内部错误',
            content: {
                'application/json': {
                    schema: resolver(apiResponseSchema())
                }
            }
        }
    }
}
