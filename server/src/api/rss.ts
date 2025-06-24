import { Hono } from 'hono'
import { z } from 'zod'
import { zValidator } from '@hono/zod-validator'
import { jwtMiddleware } from '../middleware/jwt'
import {db} from "../db";
import user from "./user";

const app = new Hono()

// 应用JWT中间件到所有RSS路由
app.use('/*', jwtMiddleware)

const rssSchema = z.object({
    url: z.string().url(),
})

// 添加RSS订阅
app.post('/', zValidator('json', rssSchema), async (c) => {
    const { url } = c.req.valid('json')
    const user = c.get('jwtPayload') // 从JWT中间件获取用户信息

    return c.json({
        message: 'RSS订阅添加成功',
        url,
        userId: user.id
    })
})

// 获取RSS订阅列表
app.get('/', async (c) => {
    const user = c.get('jwtPayload')

    // 这里应该从数据库获取用户的RSS订阅
    const mockRssFeeds = [
        { id: 1, url: 'https://example.com/rss1.xml', title: 'Example RSS 1' },
        { id: 2, url: 'https://example.com/rss2.xml', title: 'Example RSS 2' }
    ]

    return c.json({
        message: '获取RSS订阅列表成功',
        feeds: mockRssFeeds,
        userId: user.id
    })
})

// 删除RSS订阅
app.delete('/:id', async (c) => {
    const id = c.req.param('id')
    const user = c.get('jwtPayload')

    return c.json({
        message: `RSS订阅 ${id} 删除成功`,
        userId: user.id
    })
})


export default app
