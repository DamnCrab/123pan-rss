import { Hono } from "hono";
import {openAPISpecs} from "hono-openapi";
const app = new Hono();
app.get(
    "/",
    openAPISpecs(app, {
        documentation: {
            info: {
                title: "Hono",
                version: "1.0.0",
                description: "API for greeting users",
            },
            servers: [
                {
                    url: "http://localhost:3000",
                    description: "Local server",
                },
            ],
        },
    })
);
