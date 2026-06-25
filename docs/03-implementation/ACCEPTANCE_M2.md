# M2 · Lite v1 验收清单

> **里程碑**：Phase C + D + F 完成，可 `pnpm build:lite` 静态部署。  
> 对照 Studio live 模式；`frontend/app` + `backend/` 保持参考不动。

## 前置

```bash
pnpm sync:skill && pnpm install
pnpm dev:lite          # 开发
pnpm build:lite        # 生产包 → packages/lite/dist/
pnpm test:ports        # stream-utils 单测
```

在 **模型能力** 中配置 OpenAI 兼容 Base URL + API Key + Model（与 Studio 火山方舟相同即可）。

---

## E2E 手动验收

- [ ] **输入**：主题 + 篇幅/受众/语气；上传 txt / pdf / docx 资料能进 Context Pack
- [ ] **生成**：todos + 活动流实时；三 HITL（大纲 / 模板 / 形态）可停—续
- [ ] **大纲**：OutlineEditor 双栏编辑 → 确认后续跑
- [ ] **模板**：7 套网格 + ★ 推荐（无 PNG 时文字占位可接受）
- [ ] **完成**：iframe/srcDoc 预览可翻页；演示模式双窗 BC
- [ ] **副驾**：聊天续跑、停止按钮
- [ ] **导出**：HTML 下载；PDF/PPTX/PNG 有 Lite 说明 + 打印指引
- [ ] **配方**：Hub 编辑/保存/选用/zip 导入导出；换配方后新 run 用新 skill
- [ ] **Skill 页**：reference 全文可读；zip 下载与内置 skill 一致
- [ ] **持久化**：完成后刷新 →「最近生成」可见；HITL 中断刷新 →「继续上次」
- [ ] **设置**：测试连接；CORS 失败时有可操作建议（设置页 + RUN.md）

---

## 已知 Won't fix（v1）

| 项 | 等效 |
|----|------|
| Playwright PDF/PNG/PPTX | HTML + 打印 / Studio |
| pptx/xlsx 资料 | 转 PDF 或粘贴 |
| 样式导入 vision | mock 占位 + 文案 |
| 配方 revalidateAll 干跑 | 保存时 AJV（I4） |
| Run ↔ Studio workspace | 本地 IDB（I5 run 包） |
| 原生 Anthropic SDK | OpenAI 兼容网关 |
| Extension CORS | Phase E |

---

## 构建

`pnpm build:lite` 须 **exit 0**（2026-06-24 起通过，bundle ~3MB gzip ~909KB）。

---

*完成全部勾选即 M2 Done；下一步 Phase E（Extension）。*
