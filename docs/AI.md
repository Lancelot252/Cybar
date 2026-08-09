# Cybar AI 架构

## 模型与端点

Cybar 仅调用阿里云百炼北京地域，不做第二供应商回退。默认文本模型为 `qwen3.7-flash`，所有文本请求设置 `enable_thinking: false` 和 `response_format: { type: "json_object" }`，再由 Ajv 验证字段、类型和评分范围。默认图片模型为 `z-image-turbo`，使用同步接口并关闭提示词改写，配图只在用户主动点击后产生。

公共端点为 `https://dashscope.aliyuncs.com`。如果业务空间提供专属域名，通过 `DASHSCOPE_BASE_URL` 覆盖。模型名也允许运维覆盖，但调用协议仍以兼容当前模型为前提。

选择依据与价格以阿里云官方文档为准：[模型价格](https://help.aliyun.com/zh/model-studio/model-pricing)、[Z-Image API](https://help.aliyun.com/zh/model-studio/z-image-api-reference)。方案制定时，北京地域 `qwen3.7-flash` 短上下文约为输入 0.2 元、输出 0.8 元/百万 Token；实际账单以调用时官方价格为准。

## 风味分析缓存

缓存键对输入做以下规范化：修剪名称和描述；原料按名称排序并保留容量、ABV；步骤保持用户顺序。规范化对象连同模型名和提示词版本生成 SHA-256。

读取顺序：

1. 进程内热点 LRU，默认最多 200 项、10 分钟 TTL。
2. MySQL `ai_analysis_cache`，正常有效期 30 天。
3. 百炼上游调用。

相同键的并发请求共享同一个 Promise。数据库读写异常只记录不阻断上游调用；上游不可用时可返回最近 90 天的旧结果，并设置 `cache.stale=true`。后台每小时清理临时图片与 90 天以前的缓存记录。

## 图片生命周期

`POST /api/custom/generate-image` 规范化当前配方并调用百炼。百炼 URL 只用于服务端即时下载，下载过程限制 HTTPS、MIME 类型、体积和超时。文件保存到按用户隔离的 `uploads/ai-temp/<user>/`，API 返回 24 小时签名 token 和受登录保护的预览 URL。

创建或更新配方时，服务端验证 token 的签名、用途、用户和期限，然后将文件转存至 `uploads/cocktails/`。multipart 中同时出现本地 `image` 与 `generatedImageToken` 时，本地上传优先。图片失败不会清空或阻断文本配方编辑。

## 失败与限流

- 未配置 `DASHSCOPE_API_KEY`：返回 `503 AI_NOT_CONFIGURED`，页面继续支持手动创建。
- 瞬时网络错误、408、429、5xx：有限超时后重试一次。
- 结构非法：使用同一文本模型修复一次，仍非法则失败。
- 默认限流：分析每 IP 10 分钟 60 次；配方生成、配图分别每用户每小时 10 次。
- 所有限制、TTL 和超时均可通过 `.env.example` 中的环境变量覆盖。

## 部署顺序

1. 备份数据库。
2. 执行 `migrations/001_ai_analysis_cache.sql`。
3. 配置 `.env`，尤其是数据库、`SESSION_SECRET` 与百炼密钥。
4. 发布应用并检查 `/api/auth/status`。
5. 使用测试账号分别验证文本生成、主动配图、风味分析与配方保存。

日志不得输出 API Key、Authorization 请求头或密钥片段。
