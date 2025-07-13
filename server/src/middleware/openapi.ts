import {Hono} from "hono";
import {generateSpecs} from "hono-openapi";
import {Scalar} from "@scalar/hono-api-reference";
import {BlankEnv, BlankSchema} from "hono/types";

/**
 * 这样写是因为openAPISpecs需要注册了路由的app实例
 * @param app
 */
const openapi = (app: Hono<BlankEnv, BlankSchema, "/">) => {
    app.get("/openapi", async (c) => {
            const envVar = c.env as Cloudflare.Env;
            if (envVar.ENVIRONMENT === 'production') {
                return c.json({error: "OpenAPI documentation is not available in production mode."}, 403);
            }
            const data = await generateSpecs(app, {
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
                        {
                            url:"https://123pan-rss.enormouscrab.workers.dev/",
                            description: "Production server",
                        }
                    ],
                },
            })
            return c.json(data);
        }
    );
    app.get('/scalar', Scalar({url: '/openapi'}))
    console.log('OpenAPI文档已启用',"http://localhost:8787/scalar");
}
export default openapi;
