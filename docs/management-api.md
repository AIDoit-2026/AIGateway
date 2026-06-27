# 管理 API

本文档说明如何用脚本调用 Metapi 管理后台的 `/api/*` 接口。管理 API 使用 `AUTH_TOKEN`，不是下游代理使用的 `PROXY_TOKEN`。

[返回文档中心](./README.md)

## 认证

```http
Authorization: Bearer <AUTH_TOKEN>
```

## API Key-only 建站流程

```bash
export METAPI_ADMIN_BASE_URL="http://127.0.0.1:4000"
export METAPI_AUTH_TOKEN="your-admin-token"
```

### 1. 创建站点

```bash
curl -sS "${METAPI_ADMIN_BASE_URL}/api/sites" \
  -H "Authorization: Bearer ${METAPI_AUTH_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "OpenAI compatible",
    "url": "https://api.example.com/v1",
    "platform": "openai"
  }'
```

### 2. 验证 API Key

```bash
curl -sS "${METAPI_ADMIN_BASE_URL}/api/accounts/verify-token" \
  -H "Authorization: Bearer ${METAPI_AUTH_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "siteId": 1,
    "accessToken": "sk-upstream",
    "credentialMode": "apikey"
  }'
```

### 3. 保存 API Key 连接

```bash
curl -sS "${METAPI_ADMIN_BASE_URL}/api/accounts" \
  -H "Authorization: Bearer ${METAPI_AUTH_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "siteId": 1,
    "username": "primary-key",
    "accessToken": "sk-upstream",
    "credentialMode": "apikey"
  }'
```

批量导入：

```json
{
  "siteId": 1,
  "accessTokens": ["sk-a", "sk-b", "sk-c"],
  "credentialMode": "apikey"
}
```

### 4. 重建路由

```bash
curl -sS "${METAPI_ADMIN_BASE_URL}/api/routes/rebuild" \
  -H "Authorization: Bearer ${METAPI_AUTH_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{"refreshModels": true, "wait": true}'
```

## 仍可查询的主要接口

| 接口 | 用途 |
|------|------|
| `GET /api/sites` | 站点列表 |
| `POST /api/sites` | 创建站点 |
| `PUT /api/sites/:id` | 更新站点 |
| `DELETE /api/sites/:id` | 删除站点 |
| `GET /api/accounts` | 连接快照 |
| `POST /api/accounts/verify-token` | 验证 API Key |
| `POST /api/accounts` | 创建 API Key 连接 |
| `PUT /api/accounts/:id` | 更新 API Key 连接 |
| `DELETE /api/accounts/:id` | 删除连接 |
| `GET /api/routes` | 路由列表 |
| `POST /api/routes/rebuild` | 重建路由 |
| `GET /api/downstream-keys` | 下游 Key 列表 |
| `POST /api/downstream-keys` | 创建下游 Key |

## 已下线或废弃的客户端流程

以下接口可能仍为历史兼容保留，但不应再用于新自动化：

- `POST /api/accounts/login`
- `POST /api/accounts/:id/rebind-session`
- `/api/account-tokens/*`
- `/api/checkin/*`
- `/api/oauth/*`

新集成请只创建 API Key 连接。
