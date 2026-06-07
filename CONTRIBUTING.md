# 贡献指南 · Contributing

谢谢你愿意改进 **Jumpx PPT Studio**！

> ⚠️ **先分清边界**：幻灯**生成逻辑**（提示词 / 门禁 / 渲染契约 / 风格）住在 **[`jumpx-ppt-forge`](https://github.com/JumpX-Labs/jumpx-ppt-forge)**——Studio 不重新实现这些。
> - 想改"写得厚不厚、版式怎么做、什么时候卡门禁" → 去 **forge** 提。
> - 想改"界面、HITL 编排、预览/导出/演示、API、样式导入" → 就在这里。

## 本地跑起来

完整步骤见 [`RUN.md`](RUN.md)（本地开发）与 [`DEPLOYMENT.md`](DEPLOYMENT.md)（Docker / 部署）。最短路径：

```bash
cp backend/.env.example backend/.env   # 填 ARK_* 密钥（向开发者索取，勿提交）
docker compose up -d --build           # 构建时会从 jumpx-ppt-forge 拉 skill
open http://localhost:5180
```

## 仓库怎么组织

| 路径 | 是什么 |
|---|---|
| `backend/` | LangGraph agent、`ai_render`、导出（Playwright）、API、样式导入；`render_check.py`（Tier-1 渲染检查） |
| `frontend/app/` | Vite + React 操作台 |
| `Dockerfile` | 单容器三进程；构建时 `git clone` forge skill（`SKILL_REF` 钉版本） |
| `docs/` | 工程文档（按 JumpX 实战营授课模块组织） |

## 几条原则

- **别把生成逻辑搬进 Studio**：那是 forge 的事，保持单一事实来源。
- **重活放后端**：无头浏览器渲染 / 导出属 Tier-1，集中在 `backend/`；保持可探测、可降级。
- **别提交密钥**：`backend/.env` 与 `backend/workspace/` 已被 `.gitignore` 拦截。
- **改 skill 版本**：通过 `SKILL_REF`（Dockerfile / compose）钉 forge 的 tag，别 vendor 一份拷贝。

## 提 Issue / PR

- 走 [Issue 模板](.github/ISSUE_TEMPLATE)；PR 请说明改了前端 / 后端 / 编排 / 部署哪一块。
- 行为准则见 [`CODE_OF_CONDUCT.md`](CODE_OF_CONDUCT.md)；安全问题见 [`SECURITY.md`](SECURITY.md)。
