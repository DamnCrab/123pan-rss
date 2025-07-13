// 错误类型枚举
export enum ErrorType {
    // 数据库相关错误
    DATABASE_ERROR = 'DATABASE_ERROR',
    DATABASE_CONNECTION_ERROR = 'DATABASE_CONNECTION_ERROR',
    
    // 认证相关错误
    AUTH_TOKEN_INVALID = 'AUTH_TOKEN_INVALID',
    AUTH_TOKEN_EXPIRED = 'AUTH_TOKEN_EXPIRED',
    AUTH_CREDENTIALS_INVALID = 'AUTH_CREDENTIALS_INVALID',
    
    // 资源相关错误
    RESOURCE_NOT_FOUND = 'RESOURCE_NOT_FOUND',
    RESOURCE_ALREADY_EXISTS = 'RESOURCE_ALREADY_EXISTS',
    
    // 外部服务错误
    EXTERNAL_SERVICE_ERROR = 'EXTERNAL_SERVICE_ERROR',
    CLOUD123_API_ERROR = 'CLOUD123_API_ERROR',
    RSS_FETCH_ERROR = 'RSS_FETCH_ERROR',
    
    // 验证相关错误
    VALIDATION_ERROR = 'VALIDATION_ERROR',
    INVALID_PARAMETER = 'INVALID_PARAMETER',
    
    // 业务逻辑错误
    BUSINESS_LOGIC_ERROR = 'BUSINESS_LOGIC_ERROR',
    OPERATION_NOT_ALLOWED = 'OPERATION_NOT_ALLOWED',
    
    // 系统错误
    INTERNAL_SERVER_ERROR = 'INTERNAL_SERVER_ERROR',
    NETWORK_ERROR = 'NETWORK_ERROR',
    TIMEOUT_ERROR = 'TIMEOUT_ERROR'
}

// 错误消息映射
const ERROR_MESSAGES: Record<ErrorType, string> = {
    [ErrorType.DATABASE_ERROR]: '数据库操作失败',
    [ErrorType.DATABASE_CONNECTION_ERROR]: '数据库连接失败',
    
    [ErrorType.AUTH_TOKEN_INVALID]: 'token无效',
    [ErrorType.AUTH_TOKEN_EXPIRED]: 'token已过期',
    [ErrorType.AUTH_CREDENTIALS_INVALID]: '用户名或密码错误',
    
    [ErrorType.RESOURCE_NOT_FOUND]: '资源不存在',
    [ErrorType.RESOURCE_ALREADY_EXISTS]: '资源已存在',
    
    [ErrorType.EXTERNAL_SERVICE_ERROR]: '外部服务调用失败',
    [ErrorType.CLOUD123_API_ERROR]: '123云盘服务异常',
    [ErrorType.RSS_FETCH_ERROR]: 'RSS源获取失败',
    
    [ErrorType.VALIDATION_ERROR]: '数据验证失败',
    [ErrorType.INVALID_PARAMETER]: '参数无效',
    
    [ErrorType.BUSINESS_LOGIC_ERROR]: '业务逻辑错误',
    [ErrorType.OPERATION_NOT_ALLOWED]: '操作不被允许',
    
    [ErrorType.INTERNAL_SERVER_ERROR]: '服务器内部错误',
    [ErrorType.NETWORK_ERROR]: '网络连接错误',
    [ErrorType.TIMEOUT_ERROR]: '请求超时'
};

// 错误分类函数
export function categorizeError(error: any): ErrorType {
    if (!error) {
        return ErrorType.INTERNAL_SERVER_ERROR;
    }
    
    const errorMessage = error.message?.toLowerCase() || '';
    const errorName = error.name?.toLowerCase() || '';
    
    // 数据库相关错误
    if (errorMessage.includes('database') || 
        errorMessage.includes('sql') || 
        errorMessage.includes('connection') ||
        errorName.includes('database')) {
        return ErrorType.DATABASE_ERROR;
    }
    
    // 网络相关错误
    if (errorMessage.includes('network') || 
        errorMessage.includes('fetch') ||
        errorMessage.includes('timeout') ||
        errorName.includes('network')) {
        if (errorMessage.includes('timeout')) {
            return ErrorType.TIMEOUT_ERROR;
        }
        return ErrorType.NETWORK_ERROR;
    }
    
    // 认证相关错误
    if (errorMessage.includes('token') || 
        errorMessage.includes('auth') ||
        errorMessage.includes('unauthorized')) {
        if (errorMessage.includes('expired')) {
            return ErrorType.AUTH_TOKEN_EXPIRED;
        }
        return ErrorType.AUTH_TOKEN_INVALID;
    }
    
    // 验证相关错误
    if (errorMessage.includes('validation') || 
        errorMessage.includes('invalid') ||
        errorMessage.includes('required')) {
        return ErrorType.VALIDATION_ERROR;
    }
    
    // 外部服务错误
    if (errorMessage.includes('api') || 
        errorMessage.includes('service') ||
        errorMessage.includes('cloud123')) {
        return ErrorType.EXTERNAL_SERVICE_ERROR;
    }
    
    // RSS相关错误
    if (errorMessage.includes('rss') || 
        errorMessage.includes('feed') ||
        errorMessage.includes('xml')) {
        return ErrorType.RSS_FETCH_ERROR;
    }
    
    // 默认为内部服务器错误
    return ErrorType.INTERNAL_SERVER_ERROR;
}

// 获取用户友好的错误消息
export function getErrorMessage(errorType: ErrorType): string {
    return ERROR_MESSAGES[errorType] || ERROR_MESSAGES[ErrorType.INTERNAL_SERVER_ERROR];
}

// 处理错误的主函数 - 直接返回JSON响应
export function handleError(error: any, c: any, customMessage?: string) {
    const errorType = categorizeError(error);
    const message = customMessage || getErrorMessage(errorType);
    
    // 确定是否需要记录日志（敏感错误或系统错误需要记录）
    const shouldLog = [
        ErrorType.DATABASE_ERROR,
        ErrorType.DATABASE_CONNECTION_ERROR,
        ErrorType.INTERNAL_SERVER_ERROR,
        ErrorType.EXTERNAL_SERVICE_ERROR,
        ErrorType.CLOUD123_API_ERROR
    ].includes(errorType);
    
    // 只有需要记录的错误才输出到控制台
    if (shouldLog) {
        console.error('系统错误:', error);
    }
    
    return c.json({
        success: false,
        message
    }, 500);
}

// 创建标准化的错误响应（保留用于非Hono上下文）
export function createErrorResponse(error: any, customMessage?: string) {
    const errorType = categorizeError(error);
    const message = customMessage || getErrorMessage(errorType);
    
    // 确定是否需要记录日志
    const shouldLog = [
        ErrorType.DATABASE_ERROR,
        ErrorType.DATABASE_CONNECTION_ERROR,
        ErrorType.INTERNAL_SERVER_ERROR,
        ErrorType.EXTERNAL_SERVICE_ERROR,
        ErrorType.CLOUD123_API_ERROR
    ].includes(errorType);
    
    // 只有需要记录的错误才输出到控制台
    if (shouldLog) {
        console.error('系统错误:', error);
    }
    
    return {
        success: false,
        message
    };
}

// 检查是否为敏感错误（不应该暴露给前端的错误）
export function isSensitiveError(error: any): boolean {
    const errorMessage = error.message?.toLowerCase() || '';
    
    // 包含敏感信息的错误关键词
    const sensitiveKeywords = [
        'password',
        'secret',
        'key',
        'token',
        'credential',
        'database',
        'connection string',
        'env',
        'config'
    ];
    
    return sensitiveKeywords.some(keyword => errorMessage.includes(keyword));
}