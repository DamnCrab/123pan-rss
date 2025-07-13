import 'dotenv/config';
import { defineConfig } from 'drizzle-kit';
import { D1Helper } from "@nerdfolio/drizzle-d1-helpers";

// https://github.com/drizzle-team/drizzle-orm/discussions/1545#discussioncomment-13372294
// 好麻烦 需要切配置来运行drizzle

const crawledDbHelper = D1Helper.get("database");
const updateProd = false // 设置为true可以在本地测试时使用生产环境的配置
const isProd = () => process.env.NODE_ENV === 'production' || updateProd

const getCredentials = () => {
    const prod = {
        driver: 'd1-http',
        dbCredentials: {
            ...crawledDbHelper.withCfCredentials(
                process.env.CLOUDFLARE_ACCOUNT_ID,
                process.env.CLOUDFLARE_D1_TOKEN,
            ).proxyCredentials,
        }
    }

    const dev = {
        dbCredentials: {
            url: crawledDbHelper.sqliteLocalFileCredentials.url
        }
    }
    return isProd() ? prod : dev
}

export default defineConfig({
    schema: "./src/db/schema.ts",
    out: "./drizzle",
    dialect: "sqlite",
    ...getCredentials()
});
