# OAuth 管理（历史说明）

OAuth 管理页面已从客户端移除。新连接请统一使用 **站点 Base URL + API Key**。

历史版本曾提供 Codex、Claude、Gemini CLI、Antigravity 等 provider 的浏览器授权入口。当前 API Key-only 精简阶段保留部分后端兼容代码和历史数据结构，但不再在管理后台暴露 OAuth 创建、重绑、导入或删除入口。

如果你维护旧实例：

- 已存在的历史数据不会因为 UI 精简自动删除。
- 不建议继续新增 OAuth 连接。
- 新站点请在「站点管理」添加 Base URL，然后在「API Key 连接」添加上游 Key。
