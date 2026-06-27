# 配置说明

[返回文档中心](./README.md)

## 配置入口

| 配置项 | 推荐入口 |
|------|------|
| 管理员令牌 | 设置，或首次启动时用 `AUTH_TOKEN` |
| 下游全局代理令牌 | 设置，或首次启动时用 `PROXY_TOKEN` |
| 项目级下游 Key | 下游密钥 |
| 上游站点 | 站点管理 |
| 上游 API Key | API Key 连接 |
| 路由策略 | 设置 / 路由 |
| 通知渠道 | 通知设置 |
| 数据库与端口 | 环境变量 |

## 首次启动环境变量

| 变量名 | 说明 | 默认值 |
|------|------|------|
| `AUTH_TOKEN` | 管理后台初始令牌 | `change-me-admin-token` |
| `PROXY_TOKEN` | 下游 `/v1/*` 初始令牌 | `change-me-proxy-sk-token` |
| `PORT` | 服务端口 | `4000` |
| `DATA_DIR` | SQLite 数据目录 | `./data` |
| `TZ` | 时区 | `Asia/Shanghai` |
| `DB_TYPE` | 数据库类型：`sqlite` / `mysql` / `postgres` | `sqlite` |
| `DB_URL` | MySQL/Postgres 连接串 | 空 |
| `DB_SSL` | 远端数据库 SSL | `false` |
| `SYSTEM_PROXY_URL` | 系统代理地址 | 空 |

## API Key-only 说明

客户端已移除 OAuth、签到、账号令牌和用户名密码登录入口。新连接只应通过 **API Key 连接** 添加。

`ACCOUNT_CREDENTIAL_SECRET` 仍保留用于历史兼容数据的加密读取，但新 API Key 连接不会保存账号密码。

## 下游 API Key 策略

「下游密钥」页面用于给调用方分配项目级 Key，可配置：

- 过期时间
- 请求和费用上限
- 模型白名单
- 路由白名单
- 站点权重倍率
- 启停和重置用量

下游客户端调用 `/v1/*` 时使用 `PROXY_TOKEN` 或这里创建的下游 Key。

## 备份与敏感信息

备份可能包含：

- 站点配置
- 上游 API Key 连接
- 下游密钥
- 路由与运行设置

请妥善保管备份文件，并定期轮换 `AUTH_TOKEN`、`PROXY_TOKEN`、上游 API Key 和下游 Key。
