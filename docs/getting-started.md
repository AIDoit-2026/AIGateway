# 快速上手

本文档帮助你完成 Metapi 的首次部署和 API Key-only 配置。

[返回文档中心](./README.md)

## 部署

### Docker Compose

```yaml
services:
  metapi:
    image: 1467078763/metapi:latest
    ports:
      - "4000:4000"
    volumes:
      - ./data:/app/data
    environment:
      AUTH_TOKEN: ${AUTH_TOKEN:?AUTH_TOKEN is required}
      PROXY_TOKEN: ${PROXY_TOKEN:?PROXY_TOKEN is required}
      BALANCE_REFRESH_CRON: "0 * * * *"
      PORT: ${PORT:-4000}
      DATA_DIR: /app/data
      TZ: ${TZ:-Asia/Shanghai}
    restart: unless-stopped
```

```bash
export AUTH_TOKEN=your-admin-token
export PROXY_TOKEN=your-proxy-sk-token
docker compose up -d
```

打开 `http://localhost:4000`，用 `AUTH_TOKEN` 登录管理后台。

## 首次使用流程

### 1. 添加站点

进入 **站点管理**，添加上游服务：

- 填写站点名称和 Base URL。
- 选择平台类型；官方入口可直接选择官方预设。
- 如需从多组上游地址请求，使用「API 请求地址池」。
- 如服务器访问上游需要代理，可配置站点代理或系统代理。

### 2. 添加 API Key 连接

进入 **API Key 连接**，为站点添加上游 API Key：

- 选择站点。
- 填写连接名称。
- 粘贴 API Key；批量导入时每行一个 Key。
- 可先验证 Key，也可选择暂不拉取模型后保存。

Metapi 会把 API Key 连接保存为内部连接记录，用于模型发现、路由生成、代理日志和成本归属。

### 3. 管理路由

进入 **路由** 页面：

- 自动路由会基于已发现模型生成。
- 如果刚添加或替换 Key，可手动重建路由。
- API Key 连接创建的通道直接绑定连接，`tokenId` 为空，不依赖账号令牌。

### 4. 验证代理

```bash
curl http://localhost:4000/v1/models \
  -H "Authorization: Bearer your-proxy-sk-token"
```

```bash
curl http://localhost:4000/v1/chat/completions \
  -H "Authorization: Bearer your-proxy-sk-token" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "gpt-4o-mini",
    "messages": [{"role": "user", "content": "hello"}]
  }'
```

## 仍然保留的能力

- 站点管理
- API Key 连接管理
- 模型发现
- 路由管理
- 代理调用和使用日志
- 下游密钥
- 设置、模型操练场、监控

账号登录、账号令牌管理、签到记录和 OAuth 管理入口已从客户端移除。旧数据不会因为 UI 精简被自动删除。
