import {z} from "zod";
import {resolver} from "hono-openapi/zod";

export const errorResponseSchema = z.object({
    success: z.boolean().describe('success'),
    message: z.string().describe('message'),
    error: z.string().optional()
}).openapi({
    ref: 'ErrorResponse'
})

export const successResponseSchema = z.object({
    success: z.boolean().describe('success'),
    message: z.string().describe('message'),
    data: z.any().optional()
}).openapi({
    ref: 'SuccessResponse'
})

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
                    }) : successResponseSchema)
                }
            }
        },
        401: {
            description: '未授权访问',
            content: {
                'application/json': {
                    schema: resolver(errorResponseSchema)
                }
            }
        },
        500: {
            description: '服务器内部错误',
            content: {
                'application/json': {
                    schema: resolver(errorResponseSchema)
                }
            }
        }
    }
}
