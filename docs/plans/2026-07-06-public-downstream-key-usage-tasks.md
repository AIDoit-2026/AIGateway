# 下游密钥公开用量页任务清单

## 任务 1：确定公开契约和数据最小化

**目标：** 明确 public API 返回字段，避免直接复用管理接口导致敏感字段泄露。

- [ ] 在 `src/server/routes/api/downstreamApiKeys.ts` 中设计 public overview/trend 响应类型。
- [ ] 新增 `toPublicDownstreamKeyView()`，只返回 `id/name/keyMasked/enabled/description/groupName/tags/expiresAt/usedCost/usedRequests/lastUsedAt/createdAt` 等展示字段。
- [ ] 明确不返回完整 `key`、路由策略、站点权重、排除账号/令牌引用。
- [ ] 保持现有管理接口响应不变。

## 任务 2：新增无需登录的后端 public API

**目标：** 为公开页面提供只读统计数据。

- [ ] 新增 `GET /api/public/downstream-keys/:id/overview`。
- [ ] 新增 `GET /api/public/downstream-keys/:id/trend`。
- [ ] overview 复用现有 24h/7d/all 聚合逻辑。
- [ ] trend 复用 `readDownstreamApiKeyTrendBuckets()`。
- [ ] id 非法返回 `400`，不存在返回 `404`。
- [ ] `hasProxyLogDownstreamApiKeyIdColumn()` 未就绪时返回空统计，页面仍可打开。
- [ ] 禁用或过期 key 仍允许查看历史统计，通过状态字段展示。

## 任务 3：扩展服务端公开路由白名单

**目标：** 只让新增 public GET 接口绕过管理员鉴权。

- [ ] 修改 `src/server/desktop.ts` 的 `isPublicApiRoute()`。
- [ ] 允许 `/api/public/downstream-keys/` 前缀。
- [ ] 确认 `/api/downstream-keys/**` 管理接口仍受 `authMiddleware` 保护。
- [ ] 增加测试覆盖 public API 不带 Authorization 可访问。
- [ ] 增加测试覆盖管理 API 不带 Authorization 仍被拒绝。

## 任务 4：新增前端 public API 调用

**目标：** 公开页面不能依赖 `auth_token`，也不能触发登录态清理。

- [ ] 在 `src/web/api.ts` 增加不带鉴权的 public fetch helper，或新增单独的 `src/web/publicApi.ts`。
- [ ] 新增 `getPublicDownstreamApiKeyOverview(id)`。
- [ ] 新增 `getPublicDownstreamApiKeyTrend(id, params)`。
- [ ] 复用现有错误解析逻辑，但不要调用 `requireAuthToken()`。
- [ ] 对 `401/403` 不执行 `clearAuthSession()` 和页面 reload。

## 任务 5：提取可复用用量面板

**目标：** 管理抽屉和公开页共享统计 UI，减少后续维护分叉。

- [ ] 从 `src/web/pages/downstream-keys/DownstreamKeyDrawer.tsx` 提取统计主体组件。
- [ ] 建议新建 `src/web/pages/downstream-keys/DownstreamKeyUsagePanel.tsx`。
- [ ] 组件接收 `item/overview/buckets/trendRange/loading/onRangeChange` 等数据和事件。
- [ ] 保留 `RangeToggle`、`DownstreamKeyTrendChart`、格式化函数的复用。
- [ ] 管理抽屉改为只负责抽屉容器、打开关闭和管理 API 数据加载。
- [ ] 确认抽屉现有展示和交互不回归。

## 任务 6：新增公开用量页面

**目标：** 提供可直接打开的公开页面。

- [ ] 新建 `src/web/pages/PublicDownstreamKeyUsage.tsx`。
- [ ] 页面路由使用 `/public/downstream-keys/:id/usage`。
- [ ] 默认展示 `24h` 范围，支持切换 `24h / 7d / all`。
- [ ] 并发加载 overview 和 trend。
- [ ] 展示「使用趋势」「基础信息」「当前范围汇总」。
- [ ] 视页面空间保留「固定窗口对比」。
- [ ] 添加加载、空数据、404/错误状态。
- [ ] 页面不展示管理侧边栏、顶部管理导航、搜索、通知、退出登录入口。

## 任务 7：调整前端登录门禁

**目标：** 未登录时可以访问 public 页面，其他页面仍进入登录页。

- [ ] 在 `src/web/App.tsx` 中识别 public usage 路径。
- [ ] public 路径命中时先渲染公开路由，不执行 `if (!authed) return <Login />`。
- [ ] 管理路由保持原有登录判断。
- [ ] 未登录访问 `/downstream-keys` 仍显示登录页。
- [ ] 未登录访问 `/public/downstream-keys/:id/usage` 显示公开用量页。

## 任务 8：管理端提供公开地址入口

**目标：** 管理员可以方便复制或打开每个下游密钥的公开用量地址。

- [ ] 在下游密钥列表行、操作菜单或详情抽屉中增加「公开用量」入口。
- [ ] 支持复制完整 URL，例如 `${window.location.origin}/public/downstream-keys/${id}/usage`。
- [ ] 支持新标签打开公开页。
- [ ] 复制成功使用现有 Toast 提示。
- [ ] 不改变现有编辑、删除、批量操作流程。

## 任务 9：测试覆盖

**目标：** 防止公开能力扩大权限边界或破坏现有管理体验。

- [ ] 后端测试：public overview 无鉴权访问成功。
- [ ] 后端测试：public trend 无鉴权访问成功。
- [ ] 后端测试：public 响应不包含 `key/allowedRouteIds/siteWeightMultipliers/excludedSiteIds/excludedCredentialRefs`。
- [ ] 后端测试：管理接口无鉴权仍失败。
- [ ] 前端测试：未登录 public 路由不显示登录页。
- [ ] 前端测试：公开页面渲染趋势、基础信息、当前范围汇总。
- [ ] 前端测试：range 切换触发 public trend 请求。
- [ ] 回归测试：`src/web/pages/DownstreamKeys.test.tsx`。

## 任务 10：验证命令

**目标：** 完成实现后用最小必要命令验证。

- [ ] `npm test -- src/server/routes/api/downstreamApiKeys.test.ts`
- [ ] `npm test -- src/web/pages/DownstreamKeys.test.tsx`
- [ ] 新增 public 页面测试后运行对应测试文件。
- [ ] `npm run build`
- [ ] `git diff --check`

## 待确认项

- [ ] 是否长期接受数字 id 可枚举。如果不能接受，需要在实现前新增随机 `publicId/shareToken` 字段和迁移。
- [ ] 公开页是否允许展示 `description/groupName/tags`。如果这些字段可能包含内部备注，应在 public view 中移除。
- [ ] 公开地址是否需要管理员可开关。如果需要，需要新增 `publicUsageEnabled` 字段和迁移。
