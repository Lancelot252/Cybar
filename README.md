# Cybar

Cybar 是一个鸡尾酒配方社区与创作工具，包含配方浏览、酒精度计算、自定义配方、AI 配方生成、AI 配图和风味分析。

## 运行要求

- Node.js 20+
- MySQL 8+
- 可选：阿里云百炼北京地域 API Key（不配置时仍可手动创建配方）

## 本地启动

```bash
npm install
copy .env.example .env
```

编辑 `.env`，至少设置数据库连接和安全的 `SESSION_SECRET`。初始化新数据库：

```bash
mysql -u root -p cybar < cybar2.sql
```

已有数据库只需先执行可重复迁移，再发布应用：

```bash
npm run migrate
npm start
```

应用默认运行在 [http://localhost:3000](http://localhost:3000)。端口可通过 `PORT` 覆盖。

## AI 配置

```dotenv
DASHSCOPE_API_KEY=sk-...
DASHSCOPE_BASE_URL=https://dashscope.aliyuncs.com
AI_TEXT_MODEL=qwen3.7-flash
AI_IMAGE_MODEL=z-image-turbo
```

文本调用固定使用 JSON 结构化输出并关闭思考模式。项目不包含 DeepSeek 回退或伪造演示结果。配方生成和配图要求登录；风味分析允许匿名访问并有 IP 限流。详细设计见 [AI 架构](docs/AI.md)。

## 主要接口

- `POST /api/custom/generate-recipe`：生成结构化配方，需登录。
- `POST /api/custom/generate-image`：按当前配方生成可选配图，需登录。
- `POST /api/custom/analyze-flavor`：返回分析文本、结构化风味评分和缓存元数据。
- `POST /api/custom/cocktails`、`PUT /api/custom/cocktails/:id`：支持可选 `generatedImageToken`。

## 测试

```bash
npm test
npx playwright install chromium
npm run test:ui
```

测试使用 Node.js `node:test`、Supertest 和模拟的上游响应，不会调用真实收费 API。

## 目录

- `server/services/`：AI 客户端、结构校验、缓存、限流与图片生命周期。
- `server/routes/`：Express 路由。
- `custom/`：新配方四步创作页。
- `migrations/`：可重复数据库迁移。
- `cybar2.sql`：完整 MySQL 初始化文件。
- `docs/AI.md`：AI 架构和运维说明。
