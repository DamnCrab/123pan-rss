# 123pan-rss

## 项目概述

使用hono和vue构建，只适用于cloudflare workers。目的是定时拉取rss并使用123云盘离线下载能力自动保存到123云盘。

## 进度

- [x] 基础功能
- [x] 123云盘离线下载
- [ ] 123云盘离线下载状态查询
- [ ] 前端页面
- [ ] 针对workers进行优化 防止30s超时

## 部署

### 需要配置的变量

#### 在cloudflare workers中需要创建的环境变量

| 环境变量                   | 描述             | 示例         |
|------------------------|----------------|------------|
| `ENVIRONMENT`          | 开发环境/本地环境      | production |
| `pan123_client_id`     | 123云盘申请        |            |
| `pan123_client_secret` | 123云盘申请        |            |
| `admin_password`       | 初始admin用户密码 不填则为admin123 |            |

#### 在本地wrangler.jsonc中需要配置的环境变量

项目中有多处`db_123`需要替换成数据库名称

```.jsonc
"d1_databases": [
    {
        "binding": "database",
        "database_name": "数据库名称",
        "database_id": "数据库id",
        "migrations_dir": "drizzle/migrations"
    }
  ],
```

本地开发时，建议使用 `.dev.vars` 文件来配置这些变量。可以在项目根目录下创建一个 `.env` 文件，并添加以下内容：

```.dev.vars
ENVIRONMENT=development
pan123_client_id=your_client_id
pan123_client_secret=your_client_secret
```

### 定时任务

配置触发事件为scheduled()

建议20分钟 */20 * * * *

## 开发

### 数据库

本项目使用 Drizzle ORM 进行数据库操作。可以通过 `drizzle:generate` 命令生成数据库模型，并使用 `drizzle:migrate` 命令执行数据库迁移。

本地调试时可以创建`.env` 文件，并添加以下内容方便连接线上数据库：

```.env
CLOUDFLARE_ACCOUNT_ID=
CLOUDFLARE_DATABASE_ID=
CLOUDFLARE_D1_TOKEN=
```

### Scripts 用途

此项目包含 `client` 和 `server` 两个主要部分，它们各自的 `package.json` 文件中定义了不同的 `scripts` 命令，用于项目的开发、构建和运行。

#### `client` 目录下的 `scripts`

在 `client` 目录下，`package.json` 中的 `scripts` 主要用于前端应用的开发和管理。例如：

- `dev`: 启动开发服务器，通常用于本地开发和热重载。
- `build`: 构建生产环境的前端资源，生成优化后的静态文件。
- `preview`: 预览生产构建后的应用。
- `lint`: 运行代码风格检查和格式化工具。

#### `server` 目录下的 `scripts`

在 `server` 目录下，`package.json` 中的 `scripts` 主要用于后端服务的开发、运行和数据库管理。例如：

- `dev`: 启动后端开发服务器。
- `dev:remote`: 启动后端开发服务器，连接线上资源。
- `deploy`: 部署生产环境。
- `build-frontend`: 编译前端项目。
- `cf-typegen`: 生成Cloudflare Typescript类型。
- `deploy-with-frontend`: 编译前端项目并部署。
- `drizzle:generate`: 生成数据库模型。
- `drizzle:migrate`: 执行数据库迁移。
- `drizzle:push`: 推送数据库更改。
- `drizzle:check`: 检查数据库状态。
- `drizzle:studio`: 启动数据库管理界面。
