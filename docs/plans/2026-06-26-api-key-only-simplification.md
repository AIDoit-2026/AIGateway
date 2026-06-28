# API Key Only 精简任务清单

创建日期：2026-06-26

## 目标

将连接管理精简为只保留上游 API Key 管理，删除客户端侧的账号管理、账号令牌管理、签到、签到记录和 OAuth 管理入口。

本次精简采用“产品能力裁剪”策略，不在第一阶段物理删除底层 `accounts` 表。API Key 连接仍然作为内部 account 记录保存，供路由、模型发现、代理日志、成本归属和通道选择继续使用。

## 范围确认

- 保留：站点管理、API Key 连接管理、模型发现、路由管理、代理调用、代理日志、下游密钥、设置、模型操练场、监控。
- 删除/隐藏：账号管理、账号令牌管理、签到操作、签到记录页面、OAuth 管理页面。
- 暂不删除：`accounts` 表、`account_tokens` 表、OAuth 相关表结构、旧管理 API。第一阶段先保留兼容，后续确认无回滚需求后再做深度清理。
- 需要保留兼容：已有 `credentialMode=apikey` 的连接应继续可用；已有 session/token/OAuth 数据不应因 UI 精简被自动删除。

## 阶段 1：前端入口和页面裁剪

- [x] 修改 `src/web/App.tsx` 侧边栏。
  - [x] 将“连接管理”明确指向 API Key 管理视图。
  - [x] 删除“OAuth 管理”菜单项。
  - [x] 删除“签到记录”菜单项。
  - [x] 确认“下游密钥”仍然独立保留。
- [x] 修改 `src/web/App.tsx` 路由。
  - [x] 移除 `/oauth` 页面路由。
  - [x] 移除 `/checkin` 页面路由。
  - [x] 移除或重定向 `/tokens` 路由。
  - [x] 保留 `/accounts`，但只呈现 API Key 管理。
- [x] 修改 `src/web/pages/Accounts.tsx`。
  - [x] 删除 `session` segment。
  - [x] 删除 `tokens` segment。
  - [x] 删除 `TokensPanel` import 和嵌入渲染。
  - [x] 默认视图固定为 `apikey`。
  - [x] 删除用户名密码登录表单。
  - [x] 删除 Session Token / Cookie 相关表单和提示。
  - [x] 删除签到开关、余额刷新、重绑 Session、账号健康刷新等 session-only 操作。
  - [x] 将页面文案从“账号”收敛为“API Key 连接”或“连接”。
- [x] 删除或停用 `src/web/pages/Tokens.tsx` 的可访问入口。
  - [x] 若保留文件，确保只作为旧 `/tokens` 重定向兼容存在。
  - [x] 若删除文件，同步移除所有 import、测试和路由引用。
- [x] 删除或停用 `src/web/pages/CheckinLog.tsx` 的可访问入口。
- [x] 删除或停用 `src/web/pages/OAuthManagement.tsx` 的可访问入口。
- [x] 清理相关页面子组件。
  - [x] `src/web/pages/oauth/OAuthModelsModal.tsx`
  - [x] 与账号令牌管理强绑定的 UI helper/test。

## 阶段 2：前端 API 客户端收敛

- [x] 修改 `src/web/api.ts`。
  - [x] 保留 API Key 创建、更新、删除、模型检查相关调用。
  - [x] 移除 UI 不再使用的 `loginAccount` 调用。
  - [x] 移除 UI 不再使用的 `rebindAccountSession` 调用。
  - [x] 移除 UI 不再使用的 `getAccountTokens` / `addAccountToken` / `syncAccountTokens` / `syncAllAccountTokens` 等调用。
  - [x] 移除 UI 不再使用的 OAuth 调用。
  - [x] 移除 UI 不再使用的签到调用。
- [x] 保留类型时要确认没有被其他页面复用。
- [x] 如果后端兼容 API 暂时保留，前端可先只移除调用，不必同步删除服务端路由。

## 阶段 3：后端行为限制和兼容

- [x] 调整 `src/server/routes/api/accounts.ts`。
  - [x] 新增连接时默认 `credentialMode=apikey`。
  - [x] 对新请求拒绝或忽略 `credentialMode=session`。
  - [x] 对用户名密码登录接口决定策略：保留但废弃，或返回明确错误。
  - [x] 对 rebind session 接口决定策略：保留但废弃，或返回明确错误。
  - [x] 创建 API Key 连接时继续走 `createManualAccount()`。
- [x] 调整 `src/server/services/manualAccountCreationService.ts`。
  - [x] 确认 API Key 路径仍然写入 `apiToken`，`accessToken` 为空。
  - [x] 确认 `extraConfig.credentialMode` 为 `apikey`。
  - [x] 确认模型发现和路由重建仍然执行。
- [x] 调整 `src/server/services/accountExtraConfig.ts`。
  - [x] 保持 `supportsDirectAccountRoutingConnection()` 对 API Key 的支持。
  - [x] 保持 `requiresManagedAccountTokens()` 对 API Key 返回 `false`。
- [x] 调整 `src/server/routes/api/accountTokens.ts`。
  - [x] 第一阶段可保留旧 API，但不再由 UI 调用。
  - [x] 后续若确认不再支持账号令牌，再统一废弃或删除路由。
- [x] 调整 `src/server/routes/api/checkin.ts`。
  - [x] 第一阶段可保留旧 API，但不再由 UI 调用。
  - [x] 后续若确认不再支持签到，再停止注册路由和 scheduler。
- [x] 调整 `src/server/routes/api/oauth.ts`。
  - [x] 第一阶段可保留旧 API，但不再由 UI 调用。
  - [x] 后续若确认不再支持 OAuth，再停止注册路由和 OAuth callback scheduler。
- [x] 检查 `src/server/index.ts` 启动流程。
  - [x] 如果后端也裁掉签到，移除 `startScheduler()` 或拆掉其中签到部分。
  - [x] 如果后端也裁掉 OAuth，移除 OAuth provider site seed、identity backfill、loopback callback server。
  - [x] 第一阶段建议先不动启动流程，降低风险。

## 阶段 4：路由、模型和代理回归

- [ ] 验证 API Key 连接创建后，`model_availability` 正常写入。
- [ ] 验证 `rebuildRoutes()` 创建的 `route_channels` 使用 `accountId` 且 `tokenId=null`。
- [ ] 验证 `/v1/models` 能返回 API Key 连接发现到的模型。
- [ ] 验证 `/v1/chat/completions` 能通过 API Key 连接完成代理。
- [ ] 验证代理日志仍然记录 `accountId`、站点、模型、token usage、成本。
- [ ] 验证批量 API Key 导入仍然可用。
- [ ] 验证站点 API 请求地址池仍然生效。

## 阶段 4.1：修复 API Key 被自动置为 expired

现象：API Key 连接在代理使用过程中可能被自动置为 `expired`。初步定位原因是 `reportTokenExpired()` 会无条件更新 `accounts.status='expired'`，而代理失败路径中只要上游错误被 `isTokenExpiredError()` 识别为 401 / invalid token / expired token，就会触发该函数。

目标：API Key only 模式下，代理失败可以记录失败、冷却通道、写代理日志和通知，但不能自动把 API Key 连接置为 `expired`。`expired` 状态只保留给 Session/OAuth 等需要重新授权的凭证。

- [x] 修改 `src/server/services/alertService.ts`。
  - [x] 让 `reportTokenExpired()` 在更新账号状态前读取账号凭证类型。
  - [x] 对 `credentialMode=apikey` 或 `requiresManagedAccountTokens(account) === false` 的连接，不执行 `accounts.status='expired'` 更新。
  - [x] 对 API Key 连接仍可写事件和通知，但文案应避免“请重新绑定账号”这类 Session 提示。
  - [x] 对 Session/OAuth 连接保留现有置为 `expired` 的行为，除非产品后续决定一起取消。
- [x] 调整调用语义。
  - [x] 检查 `src/server/proxy-core/surfaces/sharedSurface.ts` 中的代理失败路径。
  - [x] 检查 `src/server/routes/proxy/images.ts`、`completions.ts`、`embeddings.ts`、`search.ts`、`videos.ts` 等仍在 route 层直接调用 `reportTokenExpired()` 的旧路径。
  - [x] 如有必要，给 `reportTokenExpired()` 增加参数，例如 `markAccountExpired?: boolean` 或 `source?: 'proxy' | 'balance' | 'checkin'`，但优先在函数内部统一判断账号类型。
- [x] 调整健康状态。
  - [x] API Key 代理失败不应让页面显示为“凭证已过期，需要重绑”。
  - [x] API Key 可进入通道冷却或 runtime unhealthy，但账号持久状态应保持 `active`。
  - [x] 若需要展示问题，应使用“最近代理失败 / 上游鉴权失败 / 请检查 API Key”这类 API Key 语义。
- [x] 更新测试。
  - [x] 新增 `reportTokenExpired()` 对 API Key 连接不改 `accounts.status` 的测试。
  - [ ] 新增代理路径中 API Key 遇到 401 后仍保持 `active` 的测试。
  - [x] 保留 Session 账号遇到 token expired 后置为 `expired` 的测试。
  - [ ] 更新或删除 `src/server/routes/api/accounts.apikey-recovery.test.ts` 中默认假设 API Key 会进入 `expired` 的用例。
  - [x] 更新 `src/web/pages/accounts.proxy-only-expired.test.tsx`，确保 API Key only UI 不再依赖 `expired` 状态表达失败。
- [ ] 回归验证。
  - [ ] 连续触发 API Key 上游 401 / 403 / 5xx / timeout 后，连接状态仍为 `active`。
  - [ ] 通道失败计数和冷却仍然生效，避免坏 Key 被无限优先选择。
  - [ ] 更换 API Key 后模型发现、路由重建仍然正常。

## 阶段 5：测试调整

- [x] 更新侧边栏测试。
  - [x] `src/web/App.sidebar.test.ts`
  - [x] 移除 OAuth 管理、签到记录、账号令牌独立入口相关断言。
- [x] 更新连接管理页面测试。
  - [x] 删除 session segment 相关测试。
  - [x] 删除 tokens segment / embedded TokensPanel 相关测试。
  - [x] 保留 API Key 创建、验证、批量添加、模型查看测试。
- [x] 更新 token 页面测试。
  - [x] 如果删除 `Tokens.tsx`，移除对应测试。
  - [x] 如果保留重定向，改为重定向测试。
- [x] 更新签到页面测试。
  - [x] 如果删除 `CheckinLog.tsx`，移除对应测试。
  - [x] 如果保留后端 API，保留后端 route/service 测试。
- [x] 更新 OAuth 页面测试。
  - [x] 如果删除 `OAuthManagement.tsx`，移除对应 UI 测试。
  - [x] 如果保留后端 API，保留 OAuth service/route 测试。
- [x] 增加 API Key only 回归测试。
  - [x] API Key 连接创建后不会创建可用 `account_tokens` 依赖。
  - [x] API Key route channel 使用 `tokenId=null`。
  - [x] API Key 连接不显示签到、余额刷新、session 重绑操作。
- [ ] 运行关键测试。
  - [ ] `npm test -- src/server/services/modelService.test.ts`
  - [ ] `npm test -- src/server/services/accountExtraConfig.test.ts`
  - [ ] `npm test -- src/server/routes/api/accounts.apiSite.test.ts`
  - [ ] `npm test -- src/web/App.sidebar.test.ts`
  - [ ] 连接管理相关 web tests。

## 阶段 6：文档和截图清理

- [x] 更新 `docs/getting-started.md`。
  - [x] 删除账号管理流程。
  - [x] 删除账号令牌同步流程。
  - [x] 删除签到相关说明。
  - [x] 删除 OAuth 作为首选连接路径的说明，或标注已下线。
  - [x] 首次使用流程改为：添加站点 -> 添加 API Key 连接 -> 路由管理 -> 验证代理。
- [x] 更新 `docs/upstream-integration.md`。
  - [x] 删除用户名密码、Session/Cookie、账号令牌管理作为推荐路径的描述。
  - [x] 将上游接入统一收敛到 Base URL + API Key。
  - [x] 删除 OAuth 连接接入章节，或标注为已移除。
- [x] 更新 `docs/oauth.md`。
  - [x] 删除该页面或改为历史说明。
  - [x] 同步移除 VitePress 导航引用。
- [x] 更新 `docs/configuration.md`。
  - [x] 删除 OAuth client 覆盖、签到计划等不再对外使用的说明。
- [x] 更新 `docs/client-integration.md`。
  - [x] 确认下游调用文档仍然只讲 `PROXY_TOKEN` 或下游密钥。
- [x] 更新 `docs/management-api.md`。
  - [x] 管理 API 示例改成 API Key only。
  - [x] 将账号登录、账号令牌、OAuth 接口标为废弃或移除。
- [x] 更新 `docs/operations.md` 和 `docs/faq.md`。
  - [x] 删除签到失败、余额刷新失败、Session 过期重绑等排障内容。
- [x] 更新截图。
  - [x] 替换连接管理截图。
  - [x] 删除账号令牌、OAuth、签到相关截图引用。

## 阶段 7：代理热路径性能优化

目标：Metapi 作为消息中转时，请求优先快速转发。允许在低延迟模式下不统计数据、不写代理日志、不做成本回填、不做调试 trace，避免数据库和上游自日志查询阻塞响应。

初步发现的热路径问题：

- 非流式 chat/responses 在 `reply.send()` 前会等待 `recordSurfaceSuccess()`，其中可能包含上游 self-log 回查、计费计算和代理日志写库。
- 失败路径在返回或重试前会等待 `tokenRouter.recordFailure()` 和失败日志写库。
- 托管下游 Key 每次请求都会先查 `downstream_api_keys`，并且入口处会 `await consumeManagedKeyRequest()` 写请求次数。
- 无可用通道时，`selectProxyChannelForAttempt()` 会同步触发 `refreshModelsAndRebuildRoutes()`，可能把一次代理请求拖成模型刷新和路由重建。
- `reportProxyAllFailed()` / `reportTokenExpired()` 会写事件、更新账号状态、发通知；这些不应阻塞代理响应。
- proxy debug trace 默认关闭时影响小，但开启后多处 `safeInsert/Update/Finalize` 都是同步等待。

- [x] 增加低延迟模式配置。
  - [x] 新增环境变量和运行时设置，例如 `PROXY_LOW_LATENCY_MODE=true`。
  - [x] 明确低延迟模式下允许跳过：代理日志、下游 Key 用量统计、成本统计、self-log usage fallback、失败事件、通知、debug trace。
  - [x] 配置默认值保持兼容：默认不开启，开启后优先速度。
- [ ] 优化代理成功路径。
  - [ ] 拆分 `src/server/proxy-core/surfaces/sharedSurface.ts` 的 `recordSurfaceSuccess()`。
  - [ ] 响应前只保留必要的内存状态更新；日志、计费、用量、持久化全部后台执行或跳过。
  - [ ] 非流式 `chatSurface.ts` / `openAiResponsesSurface.ts` 应先 `reply.send()`，再异步做 success bookkeeping。
  - [ ] 流式请求在 `reply.raw.end()` 后异步做 success bookkeeping，不阻塞关闭响应。
  - [x] `tokenRouter.recordSuccess()` 当前未 await，但缺少统一 catch；改为显式 best-effort，避免未处理 rejection。
- [x] 跳过或异步化 self-log usage fallback。
  - [x] `resolveProxyUsageWithSelfLogFallback()` 可能额外请求上游 `/api/v1/usage` 或日志接口，低延迟模式下必须禁用。
  - [x] 如果上游响应没有 usage，低延迟模式直接记为 unknown，不再回查。
  - [ ] 成本估算可在后台做，或直接跳过。
- [ ] 优化代理失败路径。
  - [x] `createSurfaceFailureToolkit().handleUpstreamFailure()` 不应在返回前等待 `tokenRouter.recordFailure()` 和失败日志。
  - [ ] `tokenRouter.recordFailure()` 拆成内存 patch 和异步持久化；重试选择依赖内存状态，不等数据库。
  - [ ] `recordStreamFailure()`、失败代理日志、失败事件、通知全部 best-effort。
  - [x] `reportProxyAllFailed()` 和 `reportTokenExpired()` 在代理路径里改为后台执行；低延迟模式下可完全跳过通知。
- [ ] 优化认证和下游 Key 统计。
  - [x] `authorizeDownstreamToken()` 为托管下游 Key 增加短 TTL 内存缓存，并在下游 Key 增删改时失效。
  - [x] `proxyAuthMiddleware()` 中的 `consumeManagedKeyRequest()` 不再 await；低延迟模式下可跳过请求次数统计。
  - [x] `recordManagedKeyCostUsage()` 低延迟模式下跳过或后台批量聚合。
  - [ ] 如果只使用全局 `PROXY_TOKEN`，确认认证路径不触发数据库。
- [ ] 优化无通道和路由刷新。
  - [x] `selectProxyChannelForAttempt()` 中的 `refreshModelsAndRebuildRoutes()` 不再同步阻塞代理请求。
  - [ ] 无通道时后台触发单飞路由刷新，当前请求快速返回 503。
  - [ ] 增加节流，避免大量请求同时触发路由刷新。
- [ ] 优化 proxy debug trace。
  - [x] 低延迟模式强制不创建 debug trace。
  - [ ] 即使开启 debug trace，也优先改为队列写入，不阻塞代理响应。
  - [ ] 捕获 response body 的逻辑不得 clone/read 热路径响应，除非明确开启调试。
- [x] 增加后台队列或 best-effort 工具。
  - [x] 建立统一 `runProxySideEffect()` / `enqueueProxySideEffect()` 帮助函数。
  - [ ] 所有日志、事件、通知、统计写库统一通过该工具执行。
  - [x] 工具需要 catch 错误并限频打印，避免后台失败刷屏。
- [ ] 增加性能回归测试。
  - [ ] 用 mock 慢数据库验证非流式代理不会等待日志写入后才 `reply.send()`。
  - [ ] 用 mock 慢 `consumeManagedKeyRequest()` 验证认证后不阻塞上游转发。
  - [x] 用 mock 慢 `refreshModelsAndRebuildRoutes()` 验证无通道请求不会同步等待刷新完成。
  - [ ] 用 mock 慢 self-log endpoint 验证低延迟模式不会访问 self-log。
  - [ ] 覆盖低延迟模式开关关闭时仍保留原统计能力。
- [ ] 增加手工 benchmark。
  - [ ] 准备本地假上游，固定返回非流式和流式响应。
  - [ ] 对比普通模式和低延迟模式的首字节时间、完整响应时间。
  - [ ] 覆盖 SQLite、MySQL/Postgres 远端数据库两类场景。

## 阶段 8：后续深度清理（可选）

只有在确认不需要回滚、不需要兼容旧实例 UI 管理后再执行。

- [ ] 停止注册 `accountTokensRoutes`。
- [ ] 停止注册 `checkinRoutes`。
- [ ] 停止注册 `oauthRoutes`。
- [ ] 移除 OAuth callback server、OAuth refresh scheduler、provider site seed。
- [ ] 移除 check-in scheduler。
- [ ] 移除账号令牌同步、创建、删除服务。
- [ ] 移除 OAuth 服务和 provider runtime 中不再使用的管理能力。
- [ ] 评估是否保留 `account_tokens` 表作为历史兼容。
- [ ] 若要删表，按数据库规则同步：
  - [ ] 更新 `src/server/db/schema.ts`
  - [ ] 生成 Drizzle migration
  - [ ] 生成 schema contract
  - [ ] 生成 MySQL/Postgres bootstrap/upgrade artifacts
  - [ ] 更新 schema parity / upgrade / runtime tests

## 风险和决策点

- [ ] 是否允许旧 session/OAuth 数据继续代理？
  - 建议：第一阶段允许继续存在但 UI 不暴露管理入口。
- [ ] 是否保留下游“OAuth 管理”的后端 API？
  - 建议：第一阶段保留后端，先删客户端入口。
- [ ] 是否保留签到后端 scheduler？
  - 建议：如果只是“客户端删减签到功能和签到记录”，第一阶段保留后端 scheduler；如果产品明确不再签到，再进入阶段 8。
- [ ] 是否重命名 `accounts` 为 `connections`？
  - 建议：暂不做。重命名会引入大量数据库和代码迁移风险。
- [ ] 是否删除 `docs/oauth.md`？
  - 建议：先从导航移除，并在页面顶部标注功能已下线；稳定后再删除页面。
- [ ] API Key 遇到上游鉴权失败时是否需要自动禁用？
  - 建议：不自动禁用、不置为 `expired`。只记录失败、冷却通道、提示用户检查 Key。禁用应由用户手动操作或后续显式策略控制。

## 完成标准

- [ ] 新用户只能在连接管理里添加 API Key 连接。
- [ ] 客户端看不到账号管理、账号令牌管理、签到记录、OAuth 管理入口。
- [ ] API Key 连接能完成模型发现、路由生成和代理调用。
- [ ] 旧 API Key 连接不受影响。
- [ ] API Key 连接在代理失败、鉴权失败或连续失败后不会被自动置为 `expired`。
- [ ] 测试覆盖 API Key only 主路径。
- [ ] 用户文档不再引导使用账号、账号令牌、签到或 OAuth 管理。
