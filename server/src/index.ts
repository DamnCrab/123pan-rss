import { Hono } from 'hono'
import {HTTPException} from "hono/http-exception";
import { logger } from 'hono/logger'
import user from "./api/user";
import rss from "./api/rss";
import openapi from "./middleware/openapi";

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
openapi(app)
export default app
