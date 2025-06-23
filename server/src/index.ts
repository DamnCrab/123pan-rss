import {Hono} from 'hono'
import {HTTPException} from "hono/http-exception";
import { logger } from 'hono/logger'
import user from "./api/user";
import rss from "./api/rss";
import {openAPISpecs} from "hono-openapi";
import {Scalar} from "@scalar/hono-api-reference";

const app = new Hono()

app.use(logger())
app.route('/api/user', user)
app.route('/api/rss', rss)
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
app.get("/openapi",
    openAPISpecs(app, {
        documentation: {
            info: {
                title: "123网盘 RSS订阅",
                version: "1.0.0",
                description: "",
            },
            servers: [
                {
                    url: "http://localhost:8787",
                    description: "Local server",
                },
            ],
        },
    })
);
app.get('/scalar', Scalar({ url: '/openapi' }))
export default app
