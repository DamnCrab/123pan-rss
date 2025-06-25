import { Hono } from 'hono'
import {HTTPException} from "hono/http-exception";
import { logger } from 'hono/logger'
import user from "./api/user";
import rss from "./api/rss";
import magnet from "./api/magnet";
import { processRSSFeeds } from "./api/magnet";
import openapi from "./middleware/openapi";
import { cors } from 'hono/cors'

const app = new Hono()

app.use(logger())
app.use('*', cors({
    origin: ['http://localhost:8787'], // 允许所有来源
}));
app.route('/api/user', user)
app.route('/api/rss', rss)
app.route('/api/magnet', magnet)

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

// 定时任务处理器 - 每5分钟执行一次
export default {
    fetch: app.fetch,
    async scheduled(controller: any, env: any, ctx: any) {
        console.log('定时任务开始执行:', new Date().toISOString())
        try {
            await processRSSFeeds(env)
            console.log('定时任务执行成功')
        } catch (error) {
            console.error('定时任务执行失败:', error)
        }
    }
}
