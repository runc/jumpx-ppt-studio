# Changelog

格式参考 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/)。Studio 跟随其驱动的 skill [`jumpx-ppt-forge`](https://github.com/JumpX-Labs/jumpx-ppt-forge) 的能力演进。

## [Unreleased]

### Added
- **Tier-1 渲染检查** `backend/render_check.py`：用无头浏览器逐页测真实**溢出 / 断字 / WCAG 对比度**（skill 的 Tier-0 `validate_html.py` 测不到的那一半），并支持 PDF/PNG 导出复用；无浏览器时优雅降级。
- OSS 健康文件：`LICENSE`(MIT)、`CONTRIBUTING`、`CODE_OF_CONDUCT`、`SECURITY`、`.github/`（issue/PR 模板）。

### Changed
- `SKILL_REF` 从浮动 `main` **钉到 `v1.1.0`**（forge 的确定性 QA 门禁发布版），保证可复现构建。
- README 升级为发布级（头部 / 徽章 / 导航 / 风格画廊 / 训练营 CTA）。

> 历史与架构演进见 [`docs/`](./docs/)（按 JumpX AI 实战营 · Week04 Vibe Coding 授课链路组织）。
