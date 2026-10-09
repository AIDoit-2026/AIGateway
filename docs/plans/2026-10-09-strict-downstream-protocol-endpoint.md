# 下游协议严格一致：/v1/messages 不再转换到 /v1/responses

状态：已按方案 A 实施（2026-10-09）
作者：agent
日期：2026-10-09

## 0. 实施记录

已落地：

- 新增 `src/server/proxy-core/capabilities/nativeProtocolSupport.ts`：显式的平台→上游协议声明
  （`openai-chat` / `openai-responses` / `anthropic-messages` / `gemini-generate-content`），
  导出 `resolveStrictProtocolEndpointCandidates()` 与 `buildStrictProtocolUnsupportedMessage()`。
- 新增 `nativeProtocolSupport.test.ts`：用真实 `buildUpstreamEndpointRequest()` 逐平台 × 端点校验
  声明与构建器不漂移（可执行架构守卫）。
- `chatSurface.ts`：claude 下游分支改用严格候选；候选为空时记失败日志 + 尝试换通道，
  最终以 501 明确拒绝；`disableCrossProtocolFallback` 在严格模式下强制为 true；
  `count_tokens` 分支统一到同一份声明。
- `upstreamEndpointRuntimeMemory.ts`：`downstreamFormat === 'claude'` 不再写/读端点记忆，
  避免 responses 被长期锁定与写入死状态。
- 新增设置项 `strict_protocol_endpoint`（默认 **true**，即默认开启同协议），
  贯通 config / runtimeSettingsHydration / settings API / web api / Settings UI。
- 测试：更新 5 个记录旧跨协议行为的用例 + 新增 3 个拒绝/透传用例；
  `chat.codex-oauth.test.ts` 的两处跨协议翻译用例改为经逃生舱（`strictProtocolEndpoint=false`）
  驱动，并新增默认拒绝用例。
- `npm run repo:drift-check` 通过（0 violations，4 项为既有 tracked debt）。

未纳入本切片：下游 `/v1/chat/completions`（openai）仍是多候选，未收敛为 `['chat']`。
`nativeProtocolSupport` 已按通用形式实现，如需扩展只改 `chatSurface.ts` 一行判断。

## 1. 需求

下游请求的协议必须与上游端点一致：

- 下游 `/v1/messages` → 上游必须 `/v1/messages`
- 下游 `/v1/chat/completions` → 上游 `/v1/chat/completions`
- 下游 `/v1/responses` → 上游 `/v1/responses`

宁可上游不支持下游接口，也不要跨协议转换。当前 `/v1/messages` 会打到上游
`/v1/responses`，产生二次协议转换并浪费 token。

## 2. 现状：链路与关键文件

入口：

- `src/server/routes/proxy/chat.ts` — `/v1/messages` 注册在 `claudeMessagesProxyRoute`，
  转发到 `handleChatSurfaceRequest(request, reply, 'claude')`。
- `src/server/proxy-core/surfaces/chatSurface.ts` — 主编排（通道选择、端点候选、重试、
  计费、日志、debug trace）。

请求解析：

- `src/server/transformers/anthropic/messages/inbound.ts` → `anthropicMessagesInbound.parse`
- `src/server/transformers/shared/chatFormatsCore.ts:1283` `parseDownstreamChatRequest(body, 'claude')`
  返回 `upstreamBody`（OpenAI chat 格式，由 `convertClaudeRequestToOpenAiBody` 生成）
  与 `claudeOriginalBody`（原始 Anthropic 请求体，未改）。

端点候选：

- `src/server/services/upstreamEndpointDerivation.ts`
  - `preferredEndpointOrder()` — 静态优先级
  - `resolveUpstreamEndpointCandidates()` — 叠加能力画像、定价目录、运行时记忆
- `src/server/services/upstreamEndpointRuntimeMemory.ts`
  - `applyUpstreamEndpointRuntimePreference()` / `recordUpstreamEndpointSuccess()` /
    `recordUpstreamEndpointFailure()`

端点构建：

- `src/server/services/upstreamRequestBuilder.ts` `buildUpstreamEndpointRequest()`
  - `endpoint === 'messages'` 且 `downstreamFormat === 'claude'` → **原生透传**
    (`nativeClaudeBody = claudeOriginalBody`，仅覆写 model/stream)。这是唯一"上下游一致"的分支。
  - `endpoint === 'responses'` → `convertOpenAiBodyToResponsesBody(openaiBody)` 二次转换。
  - `endpoint === 'chat'` → 直接发 OpenAI chat 体。

流转与降级：

- `src/server/proxy-core/orchestration/endpointFlow.ts` `executeEndpointFlow()`
  按候选顺序逐个尝试，失败后进入下一个候选。
  `disableCrossProtocolFallback: true` 只截断"尝试下一个候选"。
- `src/server/transformers/shared/endpointCompatibility.ts`
  - `isEndpointDowngradeError()` — 404/405/415/501、not found、unsupported 等视为降级信号
  - `promoteRequiredEndpointCandidateAfterProtocolError()`
  - `promoteResponsesCandidateAfterLegacyChatError()` / `shouldPreferResponsesAfterLegacyChatError()`
  - `inferRequiredEndpointFromProtocolError()` — `input is required` ⇒ responses

已有的严格先例（重要参考）：

- `src/server/proxy-core/surfaces/openAiResponsesSurface.ts:464-496`
  非平台适配器 upstream 时候选写死 `['responses']`，并传 `disableCrossProtocolFallback: true`，
  注释明确写 "Strict responses-only mode"。**迁移方案照抄这个模式即可，架构上自洽。**
- `chatSurface.ts` 的 `/v1/messages/count_tokens`（`handleClaudeCountTokensSurfaceRequest`）
  已经是 messages-only（`requestKind: 'claude-tokens'` 时非 messages 返回空候选，直接 501）。

## 3. 为什么下游 /v1/messages 会落到上游 /v1/responses

按实际影响排序：

1. **平台优先级无条件覆盖下游协议**（主因）
   `upstreamEndpointDerivation.ts:105-107`
   ```ts
   if (platform === 'openai') return ['responses', 'chat', 'messages'];
   ```
   在 `downstreamFormat === 'claude'` 的判断之前，且与下游格式无关。
   站点平台标为 `openai` 时，Claude Code 的 `/v1/messages` 第一次请求就打 `/v1/responses`。

2. **运行时端点记忆会长期锁定 responses**
   `upstreamEndpointRuntimeMemory.ts:232-238` `shouldRememberSuccessfulEndpoint()`：
   `downstreamFormat !== 'responses'` 时一律记录成功端点。即 claude 下游一次 responses 成功，
   `preferredEndpoint` 被置为 `responses`，之后 24h 内 `applyUpstreamEndpointRuntimePreference()`
   把 responses 提到候选首位。**即使平台不是 openai 也会被逐步带偏。**

3. **失败降级链**
   `isEndpointDowngradeError()` 把 404/405/415/501、`not found`、`unsupported`、`not implemented`
   等全部当作"换端点重试"的信号。messages 不被支持时会静默改打 chat/responses。

4. **错误驱动的候选提升**
   `promoteRequiredEndpointCandidateAfterProtocolError()`、
   `promoteResponsesCandidateAfterLegacyChatError()`、
   `shouldRetryNormalizedMessagesBody()`、`isMessagesRequiredError()` 都会在失败后
   把 responses/chat 提到更前的位置。

5. **能力画像与目录重排**
   `hasNonImageFileInput`、`wantsContinuationAwareResponses`
   (`shouldPreferResponsesForAnthropicContinuation`：带 `previous_response_id` /
   `prompt_cache_key` / `metadata.user_id` 且存在孤儿 `tool_result` 时倾向 responses)、
   `preferMessagesForClaudeModel`、定价目录 `supportedEndpointTypes` 都能改变顺序。

6. **平台适配器的静默转换**
   gemini / gemini-cli / antigravity 平台下，`buildUpstreamEndpointRequest()` 走
   `isInternalGeminiUpstream` 分支，把 OpenAI 体再转成 Gemini `generateContent`。
   codex 平台的 `resolveEndpointPath()` 无论 endpoint 都返回 `/responses`。

7. **全局开关不够用**
   `config.disableCrossProtocolFallback`（默认 `false`，设置页文案"失败时不尝试其他协议"）
   只切断"第二个候选"，既不改变候选顺序，也不阻止第一次就打 responses。

## 4. 代价

- 双重转换：Anthropic Messages → OpenAI Chat → OpenAI Responses；返回侧再
  Responses → Normalized → Anthropic。
- **prompt caching 断点失效**：Anthropic 的 `cache_control` 折损后无法在跨协议端点复现，
  上游按全量 input 计费 —— 这是"浪费 token"的主因。
- 语义损耗：`thinking` 块、`tool_use`/`tool_result` id 形态、`stop_reason`、并行工具调用
  都靠重建而非透传。
- 计费口径漂移：reasoning token 归属、缓存读写 token 统计与原生 `/v1/messages` 不同。
- 可观测性失真：无法从结果判断上游是否真的支持 `/v1/messages`。

## 5. 目标语义

`downstreamFormat === 'claude'` 时：

- 候选端点集合钦定为 `['messages']`，且 `disableCrossProtocolFallback: true`。
- 不写运行时端点记忆；不参与错误驱动的候选提升；不参与能力画像/目录重排。
- 上游不支持时返回明确错误（4xx/502 + "upstream does not support /v1/messages"），
  由通道选择器去换"真正支持 messages 的通道"，而不是降级改协议。

## 6. 方案

### 方案 A（推荐）：严格同协议模式

1. 在 `chatSurface.ts` 的 `downstreamFormat === 'claude'` 分支引入 strict 决定函数，
   直接产出候选 `['messages']` 或 `[]`，不再调用 `resolveUpstreamEndpointCandidates()`。
2. 平台能力显式化（遵守 AGENTS.md "Platform behavior must be explicit"）：
   新增/复用声明式能力，例如 `resolveNativeEndpointSupport(platform)` 返回该平台原生支持的端点集合。
   判定依据用"端点路径解析结果"而不是散落 `if (platform === ...)`：
   - 原生 `/v1/messages`：`claude`、`openai`、默认平台分支（anyrouter / sub2api / new-api /
     one-api / done-hub 等落到 `resolveEndpointPath('messages') => '/v1/messages'` 的平台）
   - 非原生（拒绝）：`codex`（→ `/responses`）、`gemini`（→ `/v1beta/openai/chat/completions`）、
     `gemini-cli` / `antigravity`（→ `/v1internal:*`）
3. `executeEndpointFlow` 传 `disableCrossProtocolFallback: true`，与 `openAiResponsesSurface` 对齐。
4. 关闭 claude 下游的运行时端点记忆：
   `shouldRememberSuccessfulEndpoint()` / `recordUpstreamEndpointFailure()` 对
   `downstreamFormat === 'claude'` 直接 no-op（或只在 messages 端点内记录）。
5. 候选为空时返回明确错误，并把该通道视为"不支持 messages"，
   让 `selectSurfaceChannelForAttempt` 去换通道；错误信息要能区分
   "上游没有 /v1/messages" 与 "上游拒绝该模型"。
6. 灰度：新增设置项（如 `strict_protocol_endpoint`，默认关），跑通后再切默认开。

### 方案 B（不推荐）：只禁 responses，允许降级到 chat

候选限定 `['messages', 'chat']`。改动小，但仍然是跨协议转换，不满足"上下游一致"。

### 方案 C（不推荐）：只改配置

把 `disable_cross_protocol_fallback` 默认打开 + 修 `preferredEndpointOrder` 的 openai 分支。
不够：运行时记忆第 2 条仍会把 responses 提到首位，必须同时做 A 的第 1、4 点。
可作为 A 的过渡手段。

## 7. 改动清单

| 文件 | 改动 |
| --- | --- |
| `src/server/proxy-core/surfaces/chatSurface.ts` | claude 分支 strict 候选 + `disableCrossProtocolFallback: true` |
| `src/server/services/upstreamEndpointDerivation.ts` | 新增 strict/原生支持声明；`preferredEndpointOrder` 的 openai 分支 |
| `src/server/services/upstreamEndpointRuntimeMemory.ts` | claude 下游不写记忆 |
| `src/server/transformers/shared/endpointCompatibility.ts` | claude 下游禁用降级/提升判定 |
| `src/server/proxy-core/providers/registry.ts` 或新 capability 模块 | 平台原生端点支持声明 |
| `src/server/routes/api/settings.ts` + `src/web/pages/Settings.tsx` | 灰度开关（若采纳方案 A.6） |
| 测试 | `chat.stream.test.ts` / `upstreamEndpoint.test.ts` / `endpointFlow.test.ts` 中 claude 下游跨协议用例改为预期失败 |

验收：

- `npm run repo:drift-check`
- 相关架构边界测试（`architecture-boundaries.test.ts`、`architecture-semantic-boundaries.test.ts`）
- 端到端：Claude Code 打 `/v1/messages`，debug trace 的 `finalUpstreamPath` 必须是 `/v1/messages`；
  站点不支持时返回明确错误而非改协议。

## 8. 风险与权衡

- 站点确实不支持 `/v1/messages` 时，行为从"能跑但贵"变成"直接失败"。需要通道筛选/提示配合。
- 平台判定准确性是前提：很多中转站平台标为 `openai` 但实际支持 `/v1/messages`；
  反之也有标为通用平台但只支持 chat 的。建议优先用站点级"支持协议"声明，
  而不是仅靠平台枚举。
- `count_tokens` 已经是 messages-only，两处逻辑应统一到同一个"原生支持声明"。
- 该改动会让部分历史可用配置变成不可用，需要迁移说明。
