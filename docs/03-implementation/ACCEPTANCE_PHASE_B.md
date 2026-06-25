# Phase B 验收清单 · Lite 主路径 UI

> 打开 **http://localhost:5190**（或 Vite 自动跳转到 **5191** 若端口占用）。需先在 ⚙ 模型 中配置 LLM API Key。

## 前置

```bash
pnpm install
pnpm sync:skill
pnpm dev:lite
```

## 验收步骤

| # | 操作 | 预期 |
|---|------|------|
| 1 | 打开首页 | 纸感 Studio 风格顶栏 + 输入区（非旧版深色 lite 布局） |
| 2 | 填主题 → **开始生成** | 进入三栏工作台：舞台 / 副驾 / 胶片轨 |
| 3 | 观察左侧副驾 | **计划** todos 随 agent 推进实时勾选；**它在干什么** 活动流有 tool 调用 |
| 4 | 大纲弹层 | **左树 + 右故事板**（非 `<pre>` 兜底）；可点「确认大纲」 |
| 5 | 选模板弹层 | 7 套 preset 网格（有 PNG 则显示缩略图，无则显示名称） |
| 6 | 选形态 | HTML / AI 配图 两卡均可见 |
| 7 | 生成完成 | 舞台内 **iframe 预览**；「下载 HTML」「新标签打开」可用 |
| 8 | 底部胶片轨 | slide_plan 写入后缩略图显示页标题；**点开** 弹出逐页详情 |
| 9 | **新任务** | 回到输入页，session 重置 |

## 与 Studio 差异（本阶段已知）

- 无 `/api/runs` 请求（plan 来自 agent `files`）
- 聊天输入框 disabled（Lite 无聊天续跑）
- 停止按钮 disabled（Phase B 未接 AbortController）
- 导出仅 HTML 下载（无 PDF/PPTX）

## 通过标准

上述 1–9 均可操作且无白屏/控制台致命错误 → **Phase B ✅**
