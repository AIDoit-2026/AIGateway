# 上游接入指南

Metapi 当前的上游接入统一收敛为 **Base URL + API Key**。

[返回文档中心](./README.md)

## 通用流程

1. 进入 **站点管理**。
2. 添加站点，填写上游 Base URL。
3. 进入 **API Key 连接**。
4. 为站点添加一个或多个 API Key。
5. 验证模型发现结果。
6. 进入 **路由** 页面确认路由已生成。

## 站点配置

| 字段 | 说明 |
|------|------|
| 站点名称 | 便于管理的自定义名称 |
| 站点 URL | 上游 Base URL；OpenAI 兼容入口通常包含 `/v1` |
| 平台类型 | 按上游协议选择 `openai`、`claude`、`gemini` 或兼容平台 |
| API 请求地址池 | 可选；同一站点有多个 API 地址时使用 |
| 代理配置 | 可选；服务器访问上游需要代理时使用 |

## API Key 连接

API Key 连接是 Metapi 的唯一推荐连接方式：

- `accessToken` 为空。
- `apiToken` 保存上游 API Key。
- `extraConfig.credentialMode` 为 `apikey`。
- 模型发现和路由重建基于该 API Key 执行。
- 代理失败不会自动把连接状态置为 `expired`。

批量导入时可在 API Key 输入框中每行粘贴一个 Key。

## 常见平台

| 上游类型 | 建议平台类型 | 接入方式 |
|------|------|------|
| OpenAI 兼容入口 | `openai` | Base URL + API Key |
| Anthropic / Claude 兼容入口 | `claude` | Base URL + API Key |
| Gemini 兼容入口 | `gemini` | Base URL + API Key |
| New API / One API / OneHub / Veloera / DoneHub | 对应平台 | 使用站点提供的用户 API Key |
| CPA / CLIProxyAPI | `cliproxyapi` 或兼容平台 | Base URL + API Key |
| 官方 Coding Plan / DeepSeek / Moonshot / MiniMax / ModelScope | 官方预设 | 选择预设后添加 API Key |

## 不再推荐的路径

以下客户端管理入口已移除：

- 用户名密码登录
- Session Token / Cookie 连接管理
- 账号令牌同步和管理
- 签到记录和签到操作
- OAuth 管理页面

后端兼容 API 和历史数据可能仍保留一段时间，但新配置应只使用 API Key 连接。

## 排障

| 现象 | 建议 |
|------|------|
| `/v1/models` 没有模型 | 检查 API Key 权限，重新执行模型检查或重建路由 |
| 代理返回 401 / 403 | 上游鉴权失败；替换 API Key 或检查上游权限 |
| 无可用通道 | 确认站点启用、连接启用、模型已发现、路由已重建 |
| 连接进入 runtime unhealthy | 检查最近代理失败原因，必要时替换 API Key |

## 安全建议

- 为不同项目使用不同下游密钥。
- 定期轮换上游 API Key。
- 不要把上游 Key 写入公开仓库或前端配置。
- 删除站点会级联删除其连接和路由配置，请谨慎操作。
