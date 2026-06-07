# 安全策略 · Security Policy

## 上报漏洞

请**不要**在公开 Issue 里贴漏洞细节。两种私密上报方式：

1. GitHub **Security Advisories**：本仓库 → Security → *Report a vulnerability*（推荐）。
2. 私信 [JumpX Labs](https://github.com/JumpX-Labs) <!-- ★ 可补一个安全邮箱 -->。

我们会尽快确认、评估并修复，并在修复后视情况致谢。

## 威胁模型（请先读）

Jumpx PPT Studio 是**单机、无账号、无登录**的应用：一个容器对外开一个端口（默认 `5180`），数据全在本机持久卷。它**默认面向受信任的本地/内网环境**。

- ⛔ **不要把它裸暴露到公网**。没有内置鉴权；如需对外，请在前面加反向代理 + 认证（见 [`DEPLOYMENT.md`](DEPLOYMENT.md)）。
- 🔐 **密钥**：`ARK_*` 等 API key 只放 `backend/.env`（已 `.gitignore`），不入库、不打日志、不回前端。请勿在 Issue / PR / 截图里泄露。
- 🧰 **运行面**：后端会跑无头 Chromium（Playwright）渲染**模型产出的 HTML**。请只在可信内容上运行；不要把不受信任的第三方 HTML 投喂进渲染/导出链路。
- 📦 **依赖**：skill 在构建时从 `jumpx-ppt-forge` 按 `SKILL_REF` 拉取——**建议钉到 tag**（如 `v1.1.0`），不要长期用浮动 `main`，以保证可复现与可审计。

## 支持范围

仅对**最新发布 / `master` 头**提供安全修复。旧镜像请重建到最新。
