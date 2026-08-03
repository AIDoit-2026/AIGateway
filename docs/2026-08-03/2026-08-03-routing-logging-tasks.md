---
title: 日志治理、Token 验证可观测性与稳定优先路由任务清单
date: 2026-08-03
owner: codex
status: proposed
---


- [x] 稳定路由通道状态可观测性：TokenRoutes 通道行显示优先级、连续失败次数和活动冷却剩余时间；新增冷却时间格式化测试。
- [x] 历史备份导入策略归一化：备份中的 `weighted`/`round_robin` 路由策略导入后统一保存为 `stable_first`，并更新回归断言。
# 任务清单

## A. 现状基线与复现

- [ ] 梳理 Fastify、proxy-core、scheduler 和路由选择的正常日志来源，记录降噪前基线。
- [ ] 为 `/api/accounts/verify-token` 建立测试矩阵：Session/API Key、普通平台/New-API、带/不带 platformUserId、超时、401/403、HTML challenge、空模型。
- [ ] 增加同站点两个有效 API Key 的非流式/流式并发复现测试，覆盖首个成功、失败重试和 endpoint pool 场景。
- [ ] 输出一次验证请求链路和重复响应排查结论；若未复现，记录证据并保留回归测试。

## B. 日志治理

- [x] 在中立服务模块实现上游失败日志 helper、错误分类、请求摘要脱敏和 body 截断。
- [x] 将 `endpointFlow`、`sharedSurface`、各协议 surface 及外部请求 helper 接入统一 helper，正常 verbose 分支降为 debug 或移除。
- [x] 调整 Fastify/scheduler 的正常完成日志级别，保留启动、配置切换和异常日志。
- [x] 为日志 helper 添加单测：凭据掩码、URL/query 脱敏、大小限制、timeout/HTTP 错误分类、正常路径不打印 body。
- [x] 检查 proxy debug trace 与新日志策略的边界，避免同一请求重复保存敏感内容。

已完成：Fastify 常规请求日志已降为 `warn`；scheduler 正常开始、成功完成和计划摘要不再打印；`executeEndpointFlow()` 与共享 failure toolkit 已接入统一的脱敏失败日志，并覆盖非成功 HTTP 响应、检测失败和获取 Response 前的网络异常；proxy debug trace 落库前会脱敏 headers、body、target URL 和错误文本。相关测试已更新，但本机缺少 `vitest`，尚未执行。

## C. verify-token 日志与诊断

- [x] 在 `accounts.ts` 创建 request correlation ID，并统一封装所有失败返回的结构化日志。
- [x] 在平台适配器/请求封装层记录 `/api/user/self`、模型列表、余额和 API token 后续请求的阶段、URL、认证形态和耗时。
- [x] 为 API Key endpoint pool 和 New-API/AnyRouter 诊断变体增加可辨识的阶段名；禁止记录原始 Authorization、Cookie 和 token。
- [x] 明确超时后的诊断请求预算，避免诊断本身放大请求量；增加超时和诊断失败测试。
- [x] 更新管理 API/运维文档，说明需要提供的脱敏信息、关联 ID 和采集方式，不要求用户提交明文 token。

已完成：`verify-token` 已为 API Key、Session、空模型和未知凭据失败记录关联 ID、目标与认证形态；Base/New-API 请求封装已记录阶段、URL、认证形态、状态和耗时，并对诊断变体使用独立阶段名；每次诊断最多发起 6 个 2.5 秒请求；新增 adapter 超时后的诊断请求上限回归测试。测试尚未在当前缺少 `vitest` 的环境执行。

## D. 稳定优先策略

- [x] 将 `src/server/services/routeRoutingStrategy.ts`、token route contracts、导入导出和 API 更新逻辑收敛为 `stable_first`。
- [ ] 在 `tokenRouter.ts` 删除 weighted/round-robin 选择分支，使用 priority + 稳定 tie-breaker 的顺序选择，并复用现有失败/冷却记录。
- [x] 增加 `tokenRouterFailureThreshold` 和 `tokenRouterFailureCooldownMinutes` 的配置解析、默认值、上下限和运行时设置 API/UI 字段。
- [ ] 处理历史策略值：读取归一化、数据库迁移/启动兼容和备份导入导出均转换为 stable-first；确认不破坏旧备份。
- [ ] 更新 TokenRoutes UI、类型、文案和相关测试，移除其它策略选项并展示优先序号、失败次数和冷却剩余时间。
- [ ] 补充选择顺序、连续 N 次失败、M 分钟冷却、冷却跳过、恢复后重新可选、全部冷却和并发请求测试。
- [ ] 评估 `route_channels.priority` 是否足以表达需求；只有不足时才按数据库三件套新增字段/迁移/生成产物。

进行中：实际选择已按 `priority`、再按 channel ID 确定性排序；TokenRoutes 已固定显示稳定优先，不再提供其它策略选择，并已同步更新对应 UI 测试。旧选择分支的代码删除、冷却可视化和完整回归测试仍待完成；本机缺少 `vitest`，尚未执行更新后的测试。

## E. 重复响应修复与回归

- [ ] 在 `executeEndpointFlow()`/`sharedSurface.ts` 增加单一 response owner 保护和 attempt 计数，确保响应提交后不再切换候选。
- [ ] 对流式响应增加“首字节/headers 已提交”边界测试，验证失败重试不会二次写入。
- [ ] 将多 API Key 回归测试接入 CI，并记录每次下游请求的最终 channel ID。

初步结论：`executeEndpointFlow()` 逐个 `await` endpoint 候选，失败后才进入下一个候选，不会并行发送多个 endpoint 请求。仍需以同站点多 API Key 的流式/非流式集成测试验证整条 surface 的单一响应提交行为。

## F. 验证与交付

- [ ] 运行相关 server/web 单测和集成测试。
- [ ] 运行 `npm run build`、`git diff --check`。
- [ ] 运行 `npm run repo:drift-check`，处理架构边界和 schema 产物漂移。
- [x] 更新 `docs/operations.md` 或相关运维文档，补充日志字段、脱敏规则、验证失败排查和稳定优先参数说明。
