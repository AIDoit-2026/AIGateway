# 下游密钥公开用量页设计

## 背景

每个下游密钥需要一个唯一的网络地址，供下游用户随时查看该密钥自己的使用量。现有客户端已经在下游密钥管理页内提供统计抽屉，包含「使用趋势」「基础信息」「当前范围汇总」等信息。本需求是把这块能力开放为一个无需管理员登录的只读页面。

当前相关实现：

- 管理页路由：`src/web/App.tsx` 中的 `/downstream-keys`
- 管理页列表：`src/web/pages/DownstreamKeys.tsx`
- 统计抽屉：`src/web/pages/downstream-keys/DownstreamKeyDrawer.tsx`
- 共享展示类型和格式化：`src/web/pages/downstream-keys/shared.tsx`
- 趋势图：`src/web/components/charts/DownstreamKeyTrendChart.tsx`
- 管理接口：`src/server/routes/api/downstreamApiKeys.ts`
- 前端 API 封装：`src/web/api.ts`
- 服务端 API 鉴权白名单：`src/server/desktop.ts`

## 目标

- 每个下游密钥获得一个稳定的公开用量地址。
- 地址不要求管理员登录，不依赖本地 `auth_token`。
- 公开页展示现有统计抽屉中的核心数据：
  - 使用趋势
  - 基础信息
  - 当前范围汇总
  - 固定窗口对比可以作为延续展示，若页面空间允许建议保留
- 公开能力只读，不允许在公开页修改、删除、重置用量或查看完整密钥。
- 管理端仍保留原有下游密钥管理、筛选、批量操作和抽屉能力。

## 路由方案

建议使用明确的 public 前缀，避免和管理路由混淆：

- 前端页面：`/public/downstream-keys/:id/usage`
- 公开概览 API：`GET /api/public/downstream-keys/:id/overview`
- 公开趋势 API：`GET /api/public/downstream-keys/:id/trend?range=24h|7d|all&timeZone=Asia/Shanghai`

这里的 `id` 可以直接使用现有 `downstream_api_keys.id`。它满足唯一和稳定的要求，且不需要新增数据库字段。

安全注意：数字 id 可枚举。按本次需求可以接受使用现有唯一 id，但公开接口必须做数据最小化，不能返回完整 key、路由策略、排除账号、站点权重等管理配置。后续如果需要更强隔离，可以新增 `publicId` 或 `shareToken` 字段，用随机不可猜 token 替代数字 id。

## 鉴权边界

服务端当前在 `src/server/index.ts` 对所有 `/api/` 请求执行 `authMiddleware`，只有 `isPublicApiRoute()` 返回 true 的路径会绕过鉴权。因此需要：

- 在 `src/server/desktop.ts` 扩展公开 API 白名单：
  - `/api/public/downstream-keys/`
- 只把新增 public GET 接口加入白名单。
- 现有 `/api/downstream-keys/**` 管理接口继续要求管理员鉴权。
- 公开接口不应复用管理接口路径直接放开，避免未来新增字段时误暴露。

前端当前 `AppShell` 在未登录时直接返回 `<Login />`，导致所有 SPA 路由都被登录页拦截。因此需要：

- 在 `AppShell` 中先识别 public 页面路径。
- public 页面路径命中时直接渲染公开页面，不进入管理布局和登录判断。
- 管理页面仍使用现有登录逻辑。

## 数据契约

公开概览接口返回建议：

```ts
type PublicDownstreamKeyOverviewResponse = {
  success: true;
  item: {
    id: number;
    name: string;
    keyMasked: string;
    enabled: boolean;
    description: string | null;
    groupName: string | null;
    tags: string[];
    expiresAt: string | null;
    usedCost: number;
    usedRequests: number;
    lastUsedAt: string | null;
    createdAt: string | null;
  };
  usage: {
    last24h: AggregateUsage | null;
    last7d: AggregateUsage | null;
    all: AggregateUsage | null;
  };
};
```

公开趋势接口返回可沿用现有趋势接口形状：

```ts
type PublicDownstreamKeyTrendResponse = {
  success: true;
  range: "24h" | "7d" | "all";
  item: { id: number; name: string };
  bucketSeconds: number;
  timeZone?: string | null;
  buckets: DownstreamApiKeyTrendBucket[];
};
```

禁止公开字段：

- 完整 `key`
- `allowedRouteIds`
- `siteWeightMultipliers`
- `excludedSiteIds`
- `excludedCredentialRefs`
- 上游账号、令牌、OAuth、站点凭证相关信息
- 任何可反推出上游密钥或管理策略的内部调度数据

## 后端实现思路

在 `src/server/routes/api/downstreamApiKeys.ts` 中新增 public 只读路由，复用已有统计查询逻辑，但通过独立响应转换函数返回公开字段。

推荐提取轻量 helper：

- `buildDownstreamKeyUsageOverview(id)`：读取 key、24h/7d/all 汇总。
- `toPublicDownstreamKeyView(item)`：只保留公开字段。
- `readDownstreamApiKeyTrendBuckets()` 已在 service 层，可继续复用。

错误处理：

- id 非法：`400`
- key 不存在：`404`
- proxy log 下游 key 字段未就绪：返回空用量和空趋势，保持页面可打开
- key 已禁用：仍可展示统计，并在 `enabled` 中显示禁用状态
- key 已过期：仍可展示统计，通过 `expiresAt` 表示状态，不阻断查看

## 前端实现思路

新增公开页面组件：

- `src/web/pages/PublicDownstreamKeyUsage.tsx`

页面能力：

- 从 `useParams()` 读取 id。
- 默认 range 为 `24h`，支持 `24h / 7d / all` 切换。
- 调用新的 public API fetch 函数，不使用带鉴权的 `request()`。
- 复用 `RangeToggle`、`StatusBadge`、`TagChips`、`formatIso`、`formatMoney`、`formatCompactTokens`、`resolveOverviewUsageByRange`。
- 趋势图继续懒加载 `DownstreamKeyTrendChart`。
- UI 应是独立公开页，不显示管理侧边栏、顶部管理操作、搜索、通知、退出登录等管理入口。

可以进一步把 `DownstreamKeyDrawer` 中统计内容提取为可复用组件，例如：

- `src/web/pages/downstream-keys/DownstreamKeyUsagePanel.tsx`

然后管理抽屉和公开页都使用该组件。这样可以避免两套统计 UI 之后漂移。

## 性能和缓存

公开页只做读操作，不写数据库。

建议：

- 趋势和概览请求保持并发加载。
- 不在公开页做轮询，避免公开地址被长期打开后持续打数据库。
- 可对 public API 加短缓存头，例如 `Cache-Control: private, max-age=10` 或不加缓存，按部署代理策略决定。
- 趋势查询沿用已有聚合查询和 bucket 服务，避免在页面层二次计算。

## 测试策略

后端：

- public overview 不带 `Authorization` 可以访问。
- public trend 不带 `Authorization` 可以访问。
- public 响应不包含完整 `key` 和管理策略字段。
- 管理接口 `/api/downstream-keys`、`POST/PUT/DELETE/reset/batch` 仍要求鉴权。
- id 非法和不存在 key 返回正确状态码。

前端：

- 未登录访问 `/public/downstream-keys/1/usage` 不显示登录页。
- 公开页调用 public API 而不是管理 API。
- 页面展示使用趋势、基础信息、当前范围汇总。
- range 切换后重新请求趋势并切换当前范围汇总。
- 管理端 `/downstream-keys` 行为不回归。

## 验收标准

- 管理员可以从下游密钥列表复制或打开该 key 的公开用量地址。
- 未登录浏览器打开公开地址可以看到对应 key 的用量面板。
- 公开地址不会泄露完整下游密钥和内部路由策略。
- 管理 API 的鉴权边界不被放宽。
- 公开页在 desktop 和 mobile 下都能正常阅读核心统计。
