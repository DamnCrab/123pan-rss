import 'dotenv/config';
import { defineConfig } from 'drizzle-kit';
import { D1Helper } from "@nerdfolio/drizzle-d1-helpers";

// https://github.com/drizzle-team/drizzle-orm/discussions/1545#discussioncomment-13372294
// 好麻烦 需要切配置来运行drizzle

const crawledDbHelper = D1Helper.get("db_123");
const isProd = () => process.env.NODE_ENV === 'production'

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

// export default defineConfig({
//     out: './drizzle',
//     schema: './src/db/schema.ts',
//     dialect: 'sqlite',
//     driver: 'd1-http',
//     dbCredentials: {
//         accountId: process.env.CLOUDFLARE_ACCOUNT_ID!,
//         databaseId: process.env.CLOUDFLARE_DATABASE_ID!,
//         token: process.env.CLOUDFLARE_D1_TOKEN!,
//     },
// });
