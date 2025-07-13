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
    fatherFolderId: text().notNull(), // 父文件夹ID（123云盘中的文件夹ID）
    fatherFolderName: text().notNull(),
    cloudFolderId: text(), // 在123云盘中创建的文件夹ID
    cloudFolderName: text(), // 在123云盘中创建的文件夹名称
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
    magnetLink: text().notNull(), // 磁力链接，确保不重复
    webLink: text(), // 网页链接
    author: text(), // 作者
    category: text(), // 分类
    pubDate: int(), // 发布时间 (时间戳)
    description: text(), // 描述
    size: text(), // 文件大小
    createdAt: int().notNull(), // 创建时间 (时间戳)
    // 离线下载相关字段
    downloadTaskId: text(), // 123云盘离线下载任务ID
    downloadStatus: text().default('pending'), // 下载状态: pending, downloading, completed, failed
    downloadFileId: text(), // 下载完成后的文件ID
    downloadFailReason: text(), // 下载失败原因
    downloadCreatedAt: int(), // 创建下载任务时间
    downloadCompletedAt: int(), // 下载完成时间
});
