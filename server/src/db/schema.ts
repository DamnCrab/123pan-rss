import { sqliteTable, text, int } from "drizzle-orm/sqlite-core";

export const usersTable = sqliteTable("users_table", {
    id: int().primaryKey({ autoIncrement: true }),
    username: text().notNull().unique(),
    password: text().notNull(),
});

// 123云盘access_token表
export const cloudTokenTable = sqliteTable("cloud_token", {
    id: int().primaryKey({ autoIncrement: true }),
    clientId: text().notNull(),
    clientSecret: text().notNull(),
    accessToken: text(),
    expiredAt: int(), // 过期时间戳
    createdAt: int().notNull(), // 创建时间戳
    updatedAt: int().notNull(), // 更新时间戳
});

export const rssSubscriptionsTable = sqliteTable("rss_subscriptions", {
    id: int().primaryKey({ autoIncrement: true }),
    userId: int().notNull().references(() => usersTable.id),
    rssUrl: text().notNull(),
    folderPath: text().notNull(),
    folderName: text().notNull(),
    refreshInterval: int().notNull(), // 刷新间隔，单位：分钟
    refreshUnit: text().notNull().default('minutes'), // 'minutes' 或 'hours'
    isActive: int().notNull().default(1), // 1: 激活, 0: 停用
    lastRefresh: int(), // 最后刷新时间 (时间戳)
    createdAt: int().notNull(), // 创建时间 (时间戳)
    updatedAt: int().notNull(), // 更新时间 (时间戳)
});

export const magnetLinksTable = sqliteTable("magnet_links", {
    id: int().primaryKey({ autoIncrement: true }),
    rssSubscriptionId: int().notNull().references(() => rssSubscriptionsTable.id),
    title: text().notNull(), // 种子标题
    magnetLink: text().notNull().unique(), // 磁力链接，确保不重复
    webLink: text(), // 网页链接
    author: text(), // 作者
    category: text(), // 分类
    pubDate: int(), // 发布时间 (时间戳)
    description: text(), // 描述
    size: text(), // 文件大小
    createdAt: int().notNull(), // 创建时间 (时间戳)
});
