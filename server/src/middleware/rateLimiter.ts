import { cloudflareRateLimiter } from '@hono-rate-limiter/cloudflare';
import type { Context } from 'hono';


/**
 * 通用速率限制 - 每分钟100次请求
 * 适用于大部分API接口
 */
export const generalRateLimit = cloudflareRateLimiter({
  rateLimitBinding: (c: Context) => c.env.RateLimitGeneral,
  keyGenerator: (c: Context) => {
    // 优先使用Cloudflare的真实IP
    const cfConnectingIp = c.req.header('cf-connecting-ip');
    const xForwardedFor = c.req.header('x-forwarded-for');
    const xRealIp = c.req.header('x-real-ip');

    return cfConnectingIp || xForwardedFor?.split(',')[0]?.trim() || xRealIp || 'unknown';
  },
  message: '请求过于频繁，请稍后再试'
});

/**
 * 登录速率限制 - 每分钟5次请求
 * 适用于登录接口，防止暴力破解
 */
export const loginRateLimit = cloudflareRateLimiter({
  rateLimitBinding: (c: Context) => c.env.RateLimitLogin,
  keyGenerator: (c: Context) => {
    const cfConnectingIp = c.req.header('cf-connecting-ip');
    const xForwardedFor = c.req.header('x-forwarded-for');
    const xRealIp = c.req.header('x-real-ip');
    
    return cfConnectingIp || xForwardedFor?.split(',')[0]?.trim() || xRealIp || 'unknown';
  },
  message: '登录尝试过于频繁，请稍后再试',
});

/**
 * RSS更新速率限制 - 每分钟3次请求
 * 适用于RSS更新和触发接口，防止频繁更新
 */
export const rssUpdateRateLimit = cloudflareRateLimiter({
  rateLimitBinding: (c: Context) => c.env.RateLimitRSSUpdate,
  keyGenerator: (c: Context) => {
    const cfConnectingIp = c.req.header('cf-connecting-ip');
    const xForwardedFor = c.req.header('x-forwarded-for');
    const xRealIp = c.req.header('x-real-ip');
    
    return cfConnectingIp || xForwardedFor?.split(',')[0]?.trim() || xRealIp || 'unknown';
  },
  message: 'RSS更新请求过于频繁，请稍后再试',
});

/**
 * 严格速率限制 - 每分钟10次请求
 * 适用于敏感操作接口，如批量重试下载等
 */
export const strictRateLimit = cloudflareRateLimiter({
  rateLimitBinding: (c: Context) => c.env.RateLimitStrict,
  keyGenerator: (c: Context) => {
    const cfConnectingIp = c.req.header('cf-connecting-ip');
    const xForwardedFor = c.req.header('x-forwarded-for');
    const xRealIp = c.req.header('x-real-ip');
    
    return cfConnectingIp || xForwardedFor?.split(',')[0]?.trim() || xRealIp || 'unknown';
  },
  message: '操作过于频繁，请稍后再试',
});