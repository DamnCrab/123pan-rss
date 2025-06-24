# 123pan-rss

## Scripts 用途

此项目包含 `client` 和 `server` 两个主要部分，它们各自的 `package.json` 文件中定义了不同的 `scripts` 命令，用于项目的开发、构建和运行。

### `client` 目录下的 `scripts`

在 `client` 目录下，`package.json` 中的 `scripts` 主要用于前端应用的开发和管理。例如：

- `dev`: 启动开发服务器，通常用于本地开发和热重载。
- `build`: 构建生产环境的前端资源，生成优化后的静态文件。
- `preview`: 预览生产构建后的应用。
- `lint`: 运行代码风格检查和格式化工具。

### `server` 目录下的 `scripts`

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
