---
title: 日志治理、Token 验证可观测性与稳定优先路由
date: 2026-08-03
owner: codex
status: proposed
---

# 目标

围绕 `docs/2026-08-03/requirement.md`，降低正常运行日志噪声，同时让外部请求失败、`/api/accounts/verify-token` 失败和路由选择具备可诊断的证据；将 Token 路由策略收敛为一种稳定优先策略，按明确顺序选择通道，并在连续失败后按配置进入冷却。

# 现状与边界

- `src/server/routes/api/accounts.ts` 是验证接口适配层，负责参数解析、超时包装和 API Key 的站点端点池调用。
- 平台适配器（`src/server/services/platforms/**`）负责实际的 `/api/user/self`、模型列表等上游请求。基础适配器先尝试 Session，再尝试 API Key；`new-api` 适配器还会尝试 Bearer、带 `New-Api-User` 的请求和 Cookie 变体。
- API Key 验证当前通过 `getModelsWithSiteApiEndpointPool()` 获取模型；超时后会额外调用 `/api/user/self` 做失败诊断。
- `src/server/services/tokenRouter.ts` 已有 `route_channels.priority`、连续失败/冷却字段和运行时持久化；当前同时支持 `weighted`、`round_robin`、`stable_first`。
- 运行时设置通过 `/api/settings/runtime` 持久化并回写内存配置；数据库 schema、迁移和生成产物必须保持同步。

# 设计

## 1. 日志策略

建立统一的上游请求失败日志 helper（放在 `src/server/services` 或 `src/server/proxy-core` 的中立模块，不放在单一路由目录）。日志分为：

- 正常路径：只保留请求完成、选择结果等必要的 `info`/`debug`，默认不打印完整请求体、响应体和重复重试细节。
- 异常路径：对 timeout、网络异常、非预期 HTTP 状态、空响应和流失败记录 `warn` 或 `error`。字段至少包括 `requestId`、协议/来源、目标 URL（去除 query secret）、HTTP 方法、状态码、耗时、错误分类、重试次数、站点/账号/通道 ID。
- 请求内容：只有确实由外部请求失败或超时触发时才记录经过截断和脱敏的请求摘要；Authorization、Cookie、API Key、token、密码及自定义敏感头必须掩码，body 受大小上限约束，默认不记录响应体。
- Fastify 的请求日志级别和 scheduler 等正常完成日志一起降噪；启动、配置切换和真正异常仍保留。

日志分类应复用现有 retry/health failure vocabulary，避免同一故障在路由健康、重试和日志中使用不同名称。为 logger helper 增加单元测试，验证脱敏、截断、timeout 分类和正常路径不输出敏感内容。

## 2. verify-token 可观测性与诊断

在 `/api/accounts/verify-token` 入口生成关联 ID，并在每个失败返回前写一条结构化失败日志；400、站点不存在、平台不支持、空 token、上游 timeout、HTTP/解析失败、模型为空和 `unknown` 必须可区分。成功日志只记录 token 类型和模型数量，不记录 token。

当前对外请求链路应在日志/诊断响应中明确记录为：

1. Session 通用路径：适配器请求 `${site.url}/api/user/self`，成功后可能继续请求余额和 API token。
2. API Key 路径：通过站点 API endpoint pool 请求模型列表（通常是 OpenAI 兼容的 `/v1/models`，具体路径由适配器决定）。
3. New-API/AnyRouter 诊断：超时或失败后，按 Bearer、`session=...`、`token=...` Cookie 变体请求 `${baseUrl}/api/user/self`，必要时带 `New-Api-User` 和 `X-Requested-With`。

失败日志应包含实际选择的 base URL、请求路径、认证形态（`bearer`/`cookie`/`api-key`）和平台用户 ID 是否提供，但不包含原始凭据。排查一个正常站点和 token 时不要求用户直接提供 token：优先收集站点平台、脱敏 URL、失败时间、关联 ID、HTTP 状态/响应摘要和是否提供 platformUserId。只有在用户明确同意且通过安全渠道时才允许临时复现凭据，默认测试使用替代 token。

## 3. 多 API Key 与重复响应排查

把“站点下多个 API Key”视为多个 `route_channels` 候选，检查一次下游请求是否可能同时启动多个上游 attempt，特别关注流式响应写入、重试和 endpoint pool 的并发。为 `executeEndpointFlow()`、`sharedSurface.ts` 和各协议 surface 增加请求级关联 ID及“选中/尝试/提交响应”计数，保证一个下游请求最多有一个 response owner；失败重试只能在响应尚未提交时发生。

先用并发集成测试复现：同站点两个有效 Key、非流式和流式请求、首个成功/首个失败、超时后恢复四种组合。若确认重复响应，修复共享编排层的竞态或重复写入，而不是在路由文件中加局部锁；若未复现，保留诊断计数和测试作为回归保护。

## 4. 稳定优先路由

`RouteRoutingStrategy` 仅保留 `stable_first`。新建路由默认稳定优先；历史 `weighted`/`round_robin` 数据在读取和迁移时归一化为 `stable_first`，导入导出、API contract 和 UI 不再提供其它选项（不删除已有数据行）。

稳定优先选择规则：

1. 候选按 `route_channels.priority` 升序，再按稳定的 channel/id 顺序排序；同优先级按现有健康过滤和确定性 tie-breaker 处理。
2. 默认从最小序号开始；当前通道成功后继续作为首选，只有不可用或进入冷却才尝试下一序号。
3. 连续失败达到设置 `tokenRouterFailureThreshold`（N）后，将通道 `cooldownUntil` 设置为当前时间加 `tokenRouterFailureCooldownMinutes`（M），失败计数和冷却级别按成功/冷却到期规则复位。
4. 冷却中的通道跳过；全部通道冷却时返回单一明确错误，不并行发起多个成功候选。
5. N、M 通过现有 `/api/settings/runtime` 保存，做正整数校验、合理上限和默认值（建议 N=3、M=10 分钟）；配置变更立即影响后续请求。

保留现有 `route_channels` 失败统计和冷却清理 API，避免新增平行状态。若需要新的设置键，只新增运行时设置，不新增数据库列；若发现现有冷却语义无法表达固定 M，再按 schema/SQLite migration/生成产物三件套补充字段。

# 验收标准

- 默认启动和正常请求日志明显减少；timeout/外部错误能定位到目标、参数摘要和关联 ID，且无明文凭据。
- 每个 `verify-token` 失败都有结构化原因和上游请求阶段；无需用户提供原始 token 即可完成首次诊断。
- 同站点多 API Key 的并发测试证明一个下游请求只产生一个最终响应。
- 路由 API/UI/导入导出只暴露稳定优先；按序选择、N 次失败冷却 M 分钟和冷却恢复均有测试覆盖。
- `npm run repo:drift-check`、相关单元/集成测试、`npm run build` 和 `git diff --check` 通过。
