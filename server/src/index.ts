import { Hono } from 'hono'
import {HTTPException} from "hono/http-exception";
import { logger } from 'hono/logger'
import user from "./api/user";
import rss from "./api/rss";
import magnet from "./api/magnet";
import cloud123 from "./api/cloud123";
import { processRSSFeeds } from "./api/magnet";
import { refreshTokenIfNeeded } from "./api/cloud123";
import openapi from "./middleware/openapi";
import { cors } from 'hono/cors'
import { csrf } from 'hono/csrf'

const app = new Hono()

app.use(logger())
app.use('*', cors({
    origin: ['http://localhost:8787','http://localhost:5173'],
    // allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    credentials: true,
}));
// app.use(csrf())

app.route('/api/user', user)
app.route('/api/rss', rss)
app.route('/api/magnet', magnet)
app.route('/api/cloud123', cloud123)

app.notFound((c) => {
    return c.json(
        {
            error: "Not Found",
            message: `Route ${c.req.method} ${c.req.path} not found.`,
        },
        404,
    );
});
app.onError((err, c) => {
    if (err instanceof HTTPException) {
        return c.json({error: err.message}, err.status);
    }
    return c.json({error: "Internal Server Error"}, 500);
});
openapi(app)

// 定时任务处理器
export default {
    fetch: app.fetch,
    async scheduled(controller: any, env: any, ctx: any) {
        console.log('定时任务开始执行:', new Date().toISOString())
        try {
            // 刷新123云盘token（如果需要）
            await refreshTokenIfNeeded(env)

            // 处理RSS订阅
            await processRSSFeeds(env)

            console.log('定时任务执行成功')
        } catch (error) {
            console.error('定时任务执行失败:', error)
        }
    }
}
