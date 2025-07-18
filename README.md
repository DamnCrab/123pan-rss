# 123pan-rss

## 项目概述

基于 Hono 和 Vue 3 构建的自动化RSS订阅和下载系统，专为 Cloudflare Workers 平台设计。系统能够定时拉取RSS源，自动解析磁力链接，并通过123云盘的离线下载功能将资源保存到指定的云盘文件夹中。

## 主要功能

### ✅ 已完成功能

- **用户认证系统**：JWT令牌认证，支持管理员账户
- **RSS订阅管理**：创建、编辑、删除RSS订阅，支持自定义刷新间隔
- **123云盘集成**：自动获取和刷新访问令牌，支持文件夹管理
- **磁力链接解析**：自动从RSS中提取磁力链接
- **离线下载功能**：批量创建123云盘离线下载任务
- **下载状态管理**：跟踪下载任务状态和进度
- **定时任务调度**：自动定时更新RSS和处理下载
- **现代化前端界面**：基于 Naive UI 的响应式管理界面
- **API文档**：集成 Swagger UI 和 Scalar API 文档
- **数据库管理**：使用 Drizzle ORM 和 Cloudflare D1
- **错误处理和日志**：完善的错误处理机制
- **速率限制**：防止API滥用的限流机制

### 🚧 开发中功能

- **下载进度实时查询**：实时获取123云盘下载任务进度
- **性能优化**：针对 Cloudflare Workers 30秒超时限制的优化
- **通知系统**：下载完成通知功能

## 技术栈

### 后端
- **框架**：Hono.js
- **运行时**：Cloudflare Workers
- **数据库**：Cloudflare D1 (SQLite)
- **ORM**：Drizzle ORM
- **认证**：JWT
- **API文档**：OpenAPI 3.0 + Swagger UI

### 前端
- **框架**：Vue 3 + TypeScript
- **构建工具**：Vite
- **UI库**：Naive UI
- **状态管理**：Pinia
- **样式**：Tailwind CSS
- **HTTP客户端**：Axios

## 部署

### 需要配置的变量

#### 在cloudflare workers中需要创建的环境变量

| 环境变量                   | 描述                       | 示例         |
|------------------------|--------------------------|------------|
| `ENVIRONMENT`          | 开发环境/本地环境                | production |
| `pan123_client_id`     | 123云盘申请                  |            |
| `pan123_client_secret` | 123云盘申请                  |            |
| `admin_password`       | 初始admin用户密码 不填则为admin123 |            |
| `JWT_SECRET`           | jwt密钥 推荐使用32位随机数         |            |

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
JWT_SECRET=JWT_SECRET
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

## 快速开始

### 1. 克隆项目
```bash
git clone <repository-url>
cd 123-dmhy-rss
```

### 2. 安装依赖
```bash
# 安装服务端依赖
cd server
bun install

# 安装客户端依赖
cd ../client
bun install
```

### 3. 配置环境变量
创建 `server/.dev.vars` 文件：
```
ENVIRONMENT=development
pan123_client_id=your_client_id
pan123_client_secret=your_client_secret
admin_password=your_admin_password
```

### 4. 数据库设置
```bash
cd server
# 生成数据库迁移文件
bun run drizzle:generate
# 执行数据库迁移
bun run drizzle:migrate
```

### 5. 启动开发服务器
```bash
# 启动后端服务（在 server 目录）
bun run dev-server

# 启动前端服务（在 client 目录）
bun run dev-client
```

## 开发脚本说明

### 服务端脚本 (server/package.json)

- `dev-server`: 启动本地开发服务器
- `dev-server:remote`: 启动开发服务器并连接远程资源
- `deploy`: 部署到生产环境
- `build-frontend`: 构建前端项目
- `deploy-with-frontend`: 构建前端并部署
- `cf-typegen`: 生成 Cloudflare TypeScript 类型定义
- `drizzle:generate`: 生成数据库迁移文件
- `drizzle:migrate`: 执行数据库迁移
- `drizzle:push`: 推送数据库更改
- `drizzle:studio`: 启动数据库管理界面

### 客户端脚本 (client/package.json)

- `dev-client`: 启动前端开发服务器
- `build`: 构建生产版本（包含类型检查）
- `build-only`: 仅构建，不进行类型检查
- `preview`: 预览生产构建
- `type-check`: TypeScript 类型检查

## API 文档

项目集成了完整的 API 文档，部署后可通过以下地址访问：
- Swagger UI: `https://your-domain.com/ui`
- Scalar API Reference: `https://your-domain.com/reference`

## 项目结构

```
123-dmhy-rss/
├── client/                 # Vue 3 前端应用
│   ├── src/
│   │   ├── api/           # API 接口定义
│   │   ├── components/    # Vue 组件
│   │   ├── views/         # 页面视图
│   │   ├── stores/        # Pinia 状态管理
│   │   └── utils/         # 工具函数
│   └── package.json
├── server/                 # Hono.js 后端应用
│   ├── src/
│   │   ├── api/           # API 路由
│   │   ├── db/            # 数据库模型
│   │   ├── middleware/    # 中间件
│   │   └── utils/         # 工具函数
│   └── package.json
└── README.md
```

## 核心功能说明

### RSS 订阅管理
- 支持添加多个 RSS 源
- 自定义刷新间隔（分钟、小时、天）
- 自动解析 RSS 中的磁力链接
- 支持启用/禁用订阅

### 123云盘集成
- 自动获取和刷新访问令牌
- 支持创建和管理云盘文件夹
- 批量离线下载磁力链接
- 下载状态跟踪和进度查询

### 定时任务
- 自动定时更新所有 RSS 订阅
- 批量处理待下载的磁力链接
- 支持并发限制，避免 API 限流
- 错误重试机制

## 性能优化

项目针对 Cloudflare Workers 平台进行了多项优化：

- **数据库查询优化**：减少重复查询，使用联表查询提高效率
- **批量处理**：支持批量下载，减少 API 调用次数
- **并发控制**：限制并发数量，避免超时和限流
- **错误处理**：完善的错误处理和重试机制
- **缓存机制**：Token 自动刷新和缓存

## 安全特性

- JWT 令牌认证
- CORS 跨域保护
- CSRF 攻击防护
- API 速率限制
- 环境变量安全存储

## 常见问题

### Q: 如何获取 123云盘的 client_id 和 client_secret？
A: 需要在 123云盘开发者平台申请应用，获取相应的凭据。

### Q: 定时任务多久执行一次？
A: 建议设置为 20 分钟执行一次（`*/20 * * * *`），可根据需要调整。

### Q: 如何查看下载进度？
A: 可以通过前端界面查看磁力链接的下载状态，或使用 API 查询具体进度。

### Q: 遇到 30 秒超时怎么办？
A: 项目已针对此问题进行优化，包括批量处理、并发控制等。如仍有问题，可调整并发数量。

## 贡献指南

欢迎提交 Issue 和 Pull Request！

1. Fork 本项目
2. 创建特性分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 开启 Pull Request

## 许可证

本项目采用 MIT 许可证 - 查看 [LICENSE](LICENSE) 文件了解详情。

## 更新日志

### v1.0.0
- ✅ 完整的 RSS 订阅管理系统
- ✅ 123云盘离线下载集成
- ✅ 现代化 Web 管理界面
- ✅ 完善的 API 文档
- ✅ 数据库查询优化
- ✅ 错误处理和日志系统
