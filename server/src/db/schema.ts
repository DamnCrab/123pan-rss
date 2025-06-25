import {int, sqliteTable, text} from "drizzle-orm/sqlite-core";

export const usersTable = sqliteTable("users_table", {
    id: int().primaryKey({ autoIncrement: true }),
    username: text().notNull().unique(),
    password: text().notNull(),
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
    lastRefresh: text(), // 最后刷新时间
    createdAt: text().notNull(),
    updatedAt: text().notNull(),
});

export const magnetLinksTable = sqliteTable("magnet_links", {
    id: int().primaryKey({ autoIncrement: true }),
    rssSubscriptionId: int().notNull().references(() => rssSubscriptionsTable.id),
    title: text().notNull(), // 种子标题
    magnetLink: text().notNull().unique(), // 磁力链接，确保不重复
    pubDate: text(), // 发布时间
    description: text(), // 描述
    size: text(), // 文件大小
    createdAt: text().notNull(),
});
