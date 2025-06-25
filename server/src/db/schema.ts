import { sqliteTable, text, int } from "drizzle-orm/sqlite-core";

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
