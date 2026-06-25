# 重构迁移开发计划 · Studio → 纯 Web (Lite) + Extension

> **写给执行者（人或编码 agent）**。目标：在 **不改动** 现有 `frontend/app` 与 `backend/` 的前提下，把 Studio 的 UI 与生成体验 **复制 + 适配** 到 `packages/lite`（纯浏览器）与未来的 `packages/extension`（Chrome MV3）。
>
> **关系**：
> - 产品规格：[`PRD_v2.md`](../02-prd/PRD_v2.md)
> - Studio 已交付闭环：[`PROGRESS.md`](PROGRESS.md)（MVP ✅）
> - Studio 产品化路线（LangGraph 侧）：[`IMPLEMENTATION_PLAN.md`](IMPLEMENTATION_PLAN.md) —— **本计划不替代它**，只覆盖「客户端形态扩展」
> - 启动方式：[`RUN.md`](../../RUN.md)

**文档版本**：v1.1 · 2026-06-24  
**状态**：**已拍板 · 执行中**（Lite v1 优先；`frontend/app` + `backend/` 冻结作对照）

---

## 0. 目标与硬约束

### 0.1 要达成什么

| 目标 | 说明 |
|------|------|
| **体验对齐** | Lite / Extension 的用户可见流程与 Studio **live 模式**一致：输入 → agent 规划 → 大纲确认 → 选模板 → 选形态 → 渲染 → 预览 →（可选）演示 |
| **代码隔离** | `frontend/app`、`backend/` **只读对照**，不在此计划内 refactor / 改行为 |
| **共享实现** | UI 与领域逻辑抽到 `packages/*`，Lite 与 Extension **同一套组件**，差异仅在 **ports 适配层** |
| **Lite 正式版** | `packages/lite` 是 **v1 正式交付形态**（非 demo）；Extension 在 Lite v1 验收后再做 |
| **缺口透明** | 无法 1:1 的能力见 **§8**；已拍板等效方案见 **§10** |
| **UI 优先对齐** | Lite **功能 / 交互 / 界面** 与 Studio 保持一致；无法无缝迁移的后端能力 **先 mock 占位**（可见 UI + 明确提示），Phase F+ 再实装 |

### 0.2 硬约束（护栏）

1. **不修改** `frontend/app/**`、`backend/**`（除非用户单独开任务修 Studio bug）。
2. **不 `git commit` / `push`**，除非用户明确要求。
3. API Key、模型选择：**用户 BYO-key**；不写死密钥；Extension 用 `chrome.storage`，Lite 用 `localStorage` / IndexedDB。
4. skill 源 [`jumpx-ppt-forge`](https://github.com/JumpX-Labs/jumpx-ppt-forge)：**只读**；继续用 `pnpm sync:skill` → `@jumpx/forge-assets`。
5. 新代码优先 **复制** Studio 组件再改 import，避免「重写一遍 UI」导致视觉/交互漂移。

### 0.3 不在本计划范围

- **不改动** `frontend/app`、`backend/`（含 Docker 三进程链路）——永久作行为与 UI 对照基准
- 云端多租户 / 账号体系（PRD v2 明确单机无账号）

### 0.4 已确认产品决策（2026-06-24）

| # | 决策 | 对计划的影响 |
|---|------|----------------|
| 1 | **先 Lite，后 Extension** | Phase E 整体排在 Lite v1（M2）之后；Extension 复用 `@jumpx/ui` + ports |
| 2 | **接受「HTML + 打印导 PDF」** | Lite v1 不提供 Playwright 级 PDF/PNG/PPTX；导出菜单 = HTML 下载 + 打印指引（§8.1 方案 A+D） |
| 3 | **配图 mode 不隐藏** | `choose_render_mode` 两卡与 Studio 同显；v1 须在浏览器侧 **实装** `generate_image`（能直连则直连，否则明确报错 + 引导配置 image provider / 等 Extension） |
| 4 | **配方系统进 v1** | Phase F 并入 **Lite v1（M2）**，非可选附加 |
| 5 | **Lite = 正式版** | 密钥 localStorage/IDB、CORS 检测与文档、E2E 与 RUN.md 须达到可交付标准 |
| 6 | **Studio 目录** | `frontend/app` + `backend/` **不动**；**Phase G（迁 `packages/studio`）Lite v1 前不做**——日后若统一 monorepo，仅做目录/脚本收敛，不改 Studio 运行时行为 |

---

## 1. 现状盘点（对照基准）

### 1.1 Studio 技术栈（冻结）

```
浏览器 :5180
  frontend/app (Vite+React)
    ├─ /lg/*  → langgraph dev :2024  (slides_agent, useStream)
    └─ /api/* → recipe_api :2025     (Starlette)
         ├─ recipes / runs / export / presets / providers / skill / styles / extract
         └─ 读写 workspace/ 磁盘
backend/
  agent.py          create_deep_agent + FilesystemBackend + skills + interrupt_on
  slide_tools.py    confirm_outline | choose_template | choose_render_mode | build_slides_html | generate_image
  recipes.py        配方 CRUD + 契约校验 + active 指针
  runs.py           run 列表 / slide_plan / index.html 路径
  export_deck.py    Playwright+Chromium → PDF / PNG zip / PPTX
  recipe_api.py     上述 HTTP 路由
```

### 1.2 Lite 技术栈（进行中）

```
浏览器 :5190
  packages/lite (Vite+React)
    └─ @jumpx/agent-js
         createDeepAgent (deepagents/browser) + createSlideTools + useBrowserAgent
    └─ @jumpx/core          composeBrief, PRESET_DISPLAY
    └─ @jumpx/forge-assets  sync:skill 静态副本
```

**已知 Lite 与 Studio 差异**（必须在迁移中补齐或登记缺口）：

| 项 | Studio | Lite 现状 |
|----|--------|-----------|
| Agent 连接 | LangGraph SDK `useStream` | `useBrowserAgent` 内存 graph |
| 首轮流式 | messages + updates | 仅 `streamMode: 'values'`；resume 用 `invoke` |
| 工作台 UI | `LiveWorkbench.jsx` 完整 | `LiteWorkbench.tsx` 简化版 |
| 大纲编辑器 | `OutlineEditor.jsx` 双栏故事板 | 内联 `<pre>` 兜底 |
| 模板网格 | `/api/presets` 真缩略图 | 文字 preset 列表 |
| 预览 | `/api/runs/{id}/view` iframe | `htmlPreview` → `srcDoc` |
| 逐页 plan | 轮询 `/api/runs/{slug}/plan` | 可从 `state.files` 读（未接 UI） |
| 导出 | PDF/PNG/PPTX | 无 |
| 配方 / 风格库 / 资料解析 | recipe_api | 无 |
| 出图 | 后端多 provider | stub |
| 持久化 | 磁盘 + SQLite checkpoint | MemorySaver，关 tab 即丢 |

### 1.3 前端组件清单（`frontend/app/src/`）

| 文件 | 职责 | 后端 / 流依赖 |
|------|------|----------------|
| `App.jsx` | 顶栏、阶段条、live/mock 路由、导出菜单、Present 入口 | `useAgent`, `/api/runs/*/export/*` |
| `LiveWorkbench.jsx` | 实时工作台：todos、活动流、胶片轨、三交互 Overlay | stream + `/api/presets`, `/api/runs/*/plan`, `/api/runs/*/view` |
| `OutlineEditor.jsx` | 大纲确认：parse outline_md、左树右故事板 | 仅 `respondInterrupt(stream, msg)` |
| `Present.jsx` | 现场演示：舞台 + 演讲者视图 + BroadcastChannel | `/api/runs/{id}/view`, `/api/runs/{id}/plan` |
| `Recipe.jsx` | 配方控制器 Hub | `/api/recipes/*` |
| `StyleLibrary.jsx` | 样式库列表 | `/api/styles` |
| `screens.jsx` | 输入页（含资料上传、风格导入） | `/api/extract`, `/api/styles/import` |
| `Providers.jsx` | 模型能力配置 UI | `/api/providers`, `/api/providers/test` |
| `SkillPage.jsx` | Skill 展示 / 参考文件只读 | `/api/skill`, `/api/skill/file/{name}` |
| `Workbench.jsx` 等 | mock 演示流（非 live） | 无（静态 data.js） |
| `agent.js` | LangGraph SDK 封装 | `/lg` |
| `proto.css` | 全量设计系统 | 无 |

### 1.4 后端 HTTP API 全表（`recipe_api.py`）

| 方法 | 路径 | 用途 | Lite 适配策略 |
|------|------|------|----------------|
| GET | `/providers` | 模型能力状态 | `SettingsStore` |
| POST | `/providers` | 保存 providers | localStorage / chrome.storage |
| POST | `/providers/test` | 测连接 | 浏览器直连或 Ext background |
| GET | `/presets` | 7 套 preset + 缩略图 URL | **静态资产** `@jumpx/forge-assets` 或 `@jumpx/ui-assets` |
| GET | `/presets/{id}/thumb/{n}` | 缩略图 PNG | 同上，打包进 dist |
| GET | `/recipes` | 配方列表 + active | `RecipeStore`（IndexedDB） |
| GET | `/recipes/{id}` | 读配方 + validate | 同上 |
| PUT | `/recipes/{id}` | 保存可改层 | 同上 |
| POST | `/recipes/{id}/fork` | fork | 同上 |
| POST | `/recipes/active` | 切换 active | 同上 + 热替换 skill bundle |
| POST | `/recipes/import` | 上传 zip | JS zip 解析 + 入库 |
| GET | `/recipes/{id}/export` | 导出 zip | JS zip 生成 + download |
| POST | `/recipes/revalidate` | 批量复验 | 端口留空 → §8.5 |
| POST | `/extract` | PDF/Office → 文本 | 浏览器解析库 → §8.4 |
| GET | `/styles` | 风格库列表 | RecipeStore 子集 |
| POST | `/styles/import` | 参考图 → 新 preset | vision API → §8.3 |
| GET | `/skill` | skill 概览 | `forge-assets` 静态 |
| GET | `/skill/file/{name}` | 参考文件正文 | 同上 |
| GET | `/runs` | 历史 run 列表 | `RunStore` → §8.6 |
| GET | `/runs/{id}/plan` | slide_plan JSON | 从 agent `files` 或 RunStore |
| GET | `/runs/{id}/view` | index.html | blob / srcDoc URL |
| GET | `/runs/{id}/export/pdf` | PDF | **缺口** §8.1 |
| GET | `/runs/{id}/export/png` | PNG zip | **缺口** §8.1 |
| GET | `/runs/{id}/export/pptx` | PPTX | **缺口** §8.1 |

LangGraph（非 recipe_api）：

| 路径 | 用途 | Lite 适配 |
|------|------|-----------|
| `/lg/...` | threads, runs, stream | `@jumpx/agent-js` 内存 graph |

---

## 2. 目标架构

### 2.1 分层图

```
┌─────────────────────────────────────────────────────────────┐
│  Shell 应用层                                                │
│  packages/lite          packages/extension                   │
│  (Vite SPA)             (WXT / MV3: popup + side panel)     │
└───────────────────────────────┬─────────────────────────────┘
                                │ 注入 ports
┌───────────────────────────────▼─────────────────────────────┐
│  @jumpx/ui          从 frontend/app **复制** 的 React 组件      │
│  + proto.css        无 fetch；只调 ports + AgentStream       │
└───────────────────────────────┬─────────────────────────────┘
                                │
┌───────────────────────────────▼─────────────────────────────┐
│  @jumpx/ports       TypeScript 接口（本计划 §3）              │
└───────────────┬─────────────────────────────┬───────────────┘
                │                             │
    ┌───────────▼──────────┐      ┌───────────▼──────────────┐
    │ adapters/browser     │      │ adapters/extension       │
    │ (localStorage,       │      │ (chrome.storage,         │
    │  IndexedDB,          │      │  background fetch 代理)  │
    │  直连 LLM*)          │      │                          │
    └───────────┬──────────┘      └───────────┬──────────────┘
                │                             │
    ┌───────────▼─────────────────────────────▼──────────────┐
    │ @jumpx/agent-js    @jumpx/core    @jumpx/forge-assets   │
    └────────────────────────────────────────────────────────┘

* 直连受 CORS 限制，见 §8.2

对照（冻结，不接入 ports）：
  frontend/app ──► backend/ + langgraph
```

### 2.2 目标 Monorepo 包结构

```
packages/
├── core/                 # 已有：composeBrief, presets
├── forge-assets/         # 已有：skill 静态副本
├── agent-js/             # 已有：browser agent + tools + useBrowserAgent
├── ports/                # 【新建】纯 TS 接口 + 类型，零运行时
├── adapters-browser/     # 【新建】Lite 用 ports 实现
├── adapters-extension/   # 【新建】Extension 用 ports 实现
├── ui/                   # 【新建】共享 UI（从 frontend/app 复制）
├── ui-assets/            # 【新建】preset 缩略图等静态资源（从 backend/preset_previews 复制）
├── lite/                 # 已有：壳 + 组装 ports
└── extension/            # 【新建】WXT 工程

frontend/app/             # 冻结，不改
backend/                  # 冻结，不改
```

### 2.3 AgentStream 统一抽象

Studio 的 `useStream` 与 Lite 的 `useBrowserAgent` **形状不同**，必须在 `@jumpx/ports` 定义 **UI 只依赖的最小集合**：

```typescript
/** UI 层唯一消费的 agent 流接口 */
export type AgentStream = {
  messages: unknown[]
  values: { todos?: Todo[]; files?: Record<string, FileEntry> }
  interrupt: InterruptEnvelope | null
  isLoading: boolean
  error: string | null
  awaitingUser: boolean

  submit(
    input: { messages?: { content: string }[] } | null,
    opts?: { command?: { resume?: unknown } },
  ): Promise<void>
  stop?: () => void
  resetSession?: () => void

  /** Lite 专有：内嵌预览 HTML；Studio 走 RunPreviewPort */
  htmlPreview?: string | null
}

export type InterruptInfo = {
  name: 'confirm_outline' | 'choose_template' | 'choose_render_mode' | string
  args: Record<string, unknown>
  description?: string
}

// 纯函数，与实现无关
export declare function readInterrupt(stream: AgentStream | null): InterruptInfo | null
export declare function respondInterrupt(stream: AgentStream, message: string): void
export declare function startRun(stream: AgentStream, topic: string, opts: StartRunOpts): void
export declare function findRunSlug(stream: AgentStream | null): string | null
export declare function findPageCount(stream: AgentStream | null): number
export declare function runFinished(stream: AgentStream | null): boolean
export declare function activityFromMessages(messages: unknown[]): string[]
```

**实施要点**：

- 把 `packages/agent-js` 里已有的 `readInterrupt` / `respondInterrupt` / … **提升到** `@jumpx/ports` 或 `@jumpx/ui` 的 `@jumpx/agent-runtime` 子包，避免 UI 依赖 LangGraph SDK。
- Studio 侧将来若要接同一套 `@jumpx/ui`，可写 **`adapters-studio`**：`useStream` → `AgentStream` 适配器（**本计划不要求改 Studio**，仅预留）。

---

## 3. Ports 接口规范（详细）

> 文件建议：`packages/ports/src/index.ts`。每个 port 一个文件，Lite / Extension 分别实现。

### 3.1 `RunPreviewPort`

```typescript
export type SlidePlanPage = {
  page_title?: string
  title?: string
  key_message?: string
  on_slide_text?: { headline?: string; sub_headline?: string; body?: string[]; caption?: string }
  speaker_notes?: string
  layout_type?: string
}

export interface RunPreviewPort {
  /** 当前 run 的 slug（生成中即可从 messages/files 推断） */
  getRunSlug(stream: AgentStream): string | null

  /** 逐页 plan：优先 stream.values.files['.../slide_plan.json']，其次 RunStore */
  getPlan(slug: string): Promise<{ pages: SlidePlanPage[] } | null>

  /** 可嵌入 iframe 的预览 URL；Studio=file path；Lite=blob:；Ext=extension:// 或 blob */
  getPreviewUrl(slug: string): Promise<string | null>

  /** 下载单文件 HTML */
  downloadHtml(slug: string, filename?: string): Promise<void>
}
```

**Studio 等价**：`GET /api/runs/{id}/plan` + `GET /api/runs/{id}/view`  
**Lite 等价**：解析 `files` + `stream.htmlPreview` → `URL.createObjectURL`

### 3.2 `PresetCatalogPort`

```typescript
export type PresetMeta = {
  id: string
  display_name: string
  mood: string
  thumbs: string[]  // 相对 URL 或 import.meta.url
}

export interface PresetCatalogPort {
  list(): Promise<PresetMeta[]>
}
```

**Studio 等价**：`GET /api/presets`  
**Lite 等价**：读 `@jumpx/ui-assets/presets.json` + 静态 PNG

### 3.3 `SettingsPort`（Providers）

```typescript
export type ProviderKind = 'text' | 'image'
export type ImageProvider = 'none' | 'mock' | 'openai' | 'gemini' | 'jimeng'

export type ProvidersState = {
  text: { provider: string; base_url: string; model: string; api_key_set: boolean }
  image: { provider: ImageProvider; base_url: string; model: string; api_key_set: boolean }
  tenancy: 'local' | 'shared'
}

export interface SettingsPort {
  get(): Promise<ProvidersState>
  save(partial: Partial<ProvidersState & { text?: { api_key?: string }; image?: { api_key?: string } }>): Promise<ProvidersState>
  test(body: { kind: ProviderKind; provider: string; api_key: string; base_url?: string; model?: string }): Promise<{ ok: boolean; message: string }>
}
```

**Studio 等价**：`/api/providers*`（key 落盘 `backend/.env` 或 local providers 文件）  
**Lite**：`localStorage`；**Extension**：`chrome.storage.local`（可选 sync 仅非密钥字段）

### 3.4 `RecipeStorePort`

```typescript
export interface RecipeStorePort {
  list(): Promise<{ recipes: RecipeManifest[]; active: string; contract_version: string; editable: string[] }>
  get(id: string): Promise<{ manifest: RecipeManifest; editable: Record<string, string>; validate: ValidateResult }>
  save(id: string, body: { files?: Record<string, string>; name?: string; density?: number }): Promise<SaveResult>
  fork(id: string, name?: string): Promise<{ id: string }>
  setActive(id: string): Promise<void>
  importZip(bytes: ArrayBuffer, name?: string): Promise<ImportResult>
  exportZip(id: string): Promise<Blob>
  revalidateAll?(): Promise<RevalidateResult>  // 可选，见 §8.5
}
```

**语义差异（必须在 UI 文案中说明）**：

- Studio：改配方 → 落盘 `workspace/recipes/` → LangGraph 下次 run 读磁盘。
- Lite：改配方 → IndexedDB → **热替换** `skillFiles` 注入 `useBrowserAgent`；与 Studio **不互通**。

### 3.5 `MaterialParserPort`

```typescript
export interface MaterialParserPort {
  extractText(file: File): Promise<{ text: string; chars: number; truncated: boolean; error?: string }>
}
```

### 3.6 `StyleImportPort`

```typescript
export interface StyleImportPort {
  list(): Promise<{ styles: StyleEntry[] }>
  importFromImages(images: { dataUrl: string }[], label: string): Promise<ImportStyleResult>
}
```

### 3.7 `ExportPort`

```typescript
export type ExportFormat = 'pdf' | 'png' | 'pptx' | 'html'

export interface ExportPort {
  supported(): ExportFormat[]  // Lite 可能仅 ['html']
  exportRun(slug: string, format: ExportFormat): Promise<Blob>
}
```

**Studio 实现**：调 `/api/runs/{id}/export/*`  
**Lite v1 实现**：`supported()` 返回 `['html']`；UI **仍展示** Studio 同款导出菜单，PDF/PPTX/PNG 项改为「下载 HTML」+「打印为 PDF」指引，不假装服务端渲染已完成

### 3.8 `SkillDocsPort`

```typescript
export interface SkillDocsPort {
  overview(): Promise<SkillOverview>
  readReference(name: string): Promise<string>
}
```

**Lite 默认**：读 `@jumpx/forge-assets` 打包内容（与 Studio「运行态 skill」可能版本不同步——UI 标注「Lite 内置 skill @ vX」）

### 3.9 `HttpClientPort`（Extension 专用）

```typescript
/** 绕过页面 CORS；Extension background 实现 */
export interface HttpClientPort {
  fetch(input: string, init?: RequestInit): Promise<Response>
}
```

Lite 默认：`globalThis.fetch`（无代理）

### 3.10 `AppPorts` 聚合

```typescript
export type AppPorts = {
  run: RunPreviewPort
  presets: PresetCatalogPort
  settings: SettingsPort
  recipes: RecipeStorePort
  materials: MaterialParserPort
  styles: StyleImportPort
  export: ExportPort
  skill: SkillDocsPort
  http?: HttpClientPort
}
```

React 注入：`PortsProvider` + `usePorts()`。

---

## 4. UI 迁移映射（逐文件）

| Studio 源 | 目标包路径 | 改造要点 |
|-----------|-----------|----------|
| `proto.css` | `@jumpx/ui/styles/proto.css` | 原样复制；Lite/Ext 各自 import |
| `OutlineEditor.jsx` | `@jumpx/ui/outline/OutlineEditor.tsx` | `agent.js` → `@jumpx/ports` 的 `respondInterrupt`；JS → TS |
| `LiveWorkbench.jsx` | `@jumpx/ui/workbench/LiveWorkbench.tsx` | 所有 `fetch('/api/...')` → `usePorts()`；`stream` 类型 → `AgentStream` |
| `Present.jsx` | `@jumpx/ui/present/Present.tsx` | `viewURL` → `run.getPreviewUrl`；plan → `run.getPlan` |
| `Recipe.jsx` | `@jumpx/ui/recipe/RecipeHub.tsx` | `API` 常量 → `ports.recipes` |
| `StyleLibrary.jsx` | `@jumpx/ui/style/StyleLibrary.tsx` | → `ports.styles.list` |
| `Providers.jsx` | `@jumpx/ui/settings/ProvidersPanel.tsx` | → `ports.settings` |
| `SkillPage.jsx` | `@jumpx/ui/skill/SkillPage.tsx` | → `ports.skill` |
| `screens.jsx` | `@jumpx/ui/screens/*` | 输入页资料/风格 → `materials` / `styles` ports |
| `App.jsx` | **不整体复制** | Lite/Ext 壳各自简化；共享 TopBar/Stepper 可抽 `@jumpx/ui/chrome/*` |
| `Brand.jsx`, `Slide.jsx` | `@jumpx/ui/...` | 低改动复制 |

**`LiteWorkbench.tsx` 处理**：迁移完成后 **删除** 或改为 re-export `LiveWorkbench`（避免双份 UI）。

---

## 5. Agent 层迁移（`@jumpx/agent-js`）

### 5.1 与 Studio `slide_tools.py` 对齐表

| 工具 | Studio | agent-js 现状 | 任务 |
|------|--------|---------------|------|
| `confirm_outline` | interrupt_on | ✅ interrupt | 保持 |
| `choose_template` | interrupt_on | ✅ interrupt | 保持 |
| `choose_render_mode` | interrupt_on | ✅ interrupt | 保持 |
| `build_slides_html` | Python `ai_render` | ✅ `renderDeckHtml` | 对齐 prompt/契约变更时 sync |
| `generate_image` | 多 provider + 写盘 | ❌ stub | §8.3 / Phase E |

### 5.2 流式（必须补齐）

| 能力 | Studio | 目标（Lite/Ext） |
|------|--------|------------------|
| todos 实时 | `updates` / `values` | `streamMode` 含 `values` ✅ |
| token 打字机 | `messages` partial | 加 `messages` + UI 可选展示 |
| 活动流 | `activityFromMessages` | 从 messages 流增量更新 |
| resume 流式 | SDK 统一 stream | resume 改 `stream` 而非 `invoke` |
| 停止 | `stream.stop()` | 暴露 `AbortController` |

**参考**：`deepagentsjs/examples/streaming/*`、`doc-agent-core/src/stream/run-doc-agent-stream.ts`

### 5.3 持久化（可选 Phase D）

| 能力 | Studio | 目标 |
|------|--------|------|
| thread checkpoint | LangGraph SQLite | IndexedDB checkpoint（参考 `doc-agent-core` `indexed-db-checkpoint-saver`） |
| runs 历史 | `workspace/runs/` | `RunStore` IndexedDB 存 html + plan |

---

## 6. 分阶段开发计划

> 每阶段结束更新 [`PROGRESS.md`](PROGRESS.md) 的「Lite/Extension 迁移」小节（不修改 Studio 段落）。

---

### Phase A · 基础设施（ports + 静态资产）— ✅ 2026-06-24

| ID | 任务 | 状态 |
|----|------|------|
| A1 | `@jumpx/ports` 接口 + stream-utils | ✅ |
| A2 | `@jumpx/adapters-browser` + `PortsProvider` | ✅ |
| A3 | `@jumpx/ui-assets` presets.json + `sync:preset-previews` | ✅（PNG 需 Studio 侧 `build_preset_previews.py` 后 sync） |
| A4 | `consumeAgentStream`：values+messages，resume 同 stream | ✅ |
| A5 | `activityFromMessages` 单测 ×4 | ✅ |

---

### Phase B · 核心 UI 迁移 — ✅ 2026-06-25

**目标**：Lite 视觉与交互对齐 Studio live 模式（不含配方/导出/风格库）。

| ID | 任务 | 状态 |
|----|------|------|
| B1 | `@jumpx/ui` + `proto.css` | ✅ |
| B2 | `OutlineEditor` 双栏故事板 | ✅ |
| B3 | `RunPreviewPort` browser（files + srcDoc） | ✅ |
| B4 | `LiveWorkbench` 三栏 + 胶片轨 + PageDetail | ✅ |
| B5 | `TemplateChooser` → `PresetCatalogPort` | ✅ |
| B6 | Lite 接 `LiveWorkbench` | ✅ |
| B7 | todos / 活动流实时 | ✅ |

**验收**：[`ACCEPTANCE_PHASE_B.md`](ACCEPTANCE_PHASE_B.md)

---

### Phase C · 输入增强 + 设置 + 演示 — ✅ M2（2026-06-24）

| ID | 任务 | 状态 |
|----|------|------|
| C1 | 输入页 | ✅ |
| C2 | MaterialParser txt/md/pdf/docx | ✅ |
| C3 | ProvidersPanel + SettingsPort | ✅ |
| C4 | Present 双窗 BC | ✅ |
| C5 | 单一设置入口 | ✅ |
| C6 | CORS + RUN.md | ✅ |
| C7 | generate_image | ✅ |

验收：[`ACCEPTANCE_M2.md`](ACCEPTANCE_M2.md)

---

### Phase D · 持久化 + Run 历史 — ✅ M2

| ID | 任务 | 状态 |
|----|------|------|
| D1 | RunStore IndexedDB | ✅ |
| D2 | IndexedDB checkpoint | ✅ |
| D3 | RunHistory UI | ✅ |

---

### Phase E · Extension 壳

| ID | 任务 | 产出 | 验收 |
|----|------|------|------|
| E1 | 新建 `packages/extension`（WXT 或 Plasmo） | 工程 | 加载 side panel |
| E2 | `@jumpx/adapters-extension`：`chrome.storage` Settings/Recipe | adapter | 与 Lite 同 UI 不同 storage |
| E3 | background service worker：`HttpClientPort` 代理 LLM/image API | worker | 火山/OpenAI 兼容 API 可调通 |
| E4 | 复用 `@jumpx/ui` + `@jumpx/lite` 路由逻辑 | MV3 | E2E 与 Lite 同流程 |
| E5 | 打包 skill assets + ui-assets 进 extension | build | 离线可打开 UI |
| E6 | 权限清单：`storage`, `host_permissions` 最小化 | manifest | 商店审核友好说明 |

**依赖**：**Lite v1（M2）验收完成后**再启动  
**参考**：`deepagentsjs/apps/doc-agent-extension/`、`doc-agent-storage/chrome-adapter.ts`

---

### Phase F · 配方 + 风格库 — ✅ M2

| ID | 任务 | 状态 |
|----|------|------|
| F1 | RecipeStore + zip | ✅ |
| F2 | RecipeHub | ✅ |
| F3 | active skill 热替换 | ✅ |
| F4 | StyleLibrary + mock 导入 | ✅ |
| F5 | SkillPage + forge 全文/zip | ✅ |
| F6 | 保存校验 | ✅ |

---

### Phase G · Studio monorepo 收敛（**Lite v1 后 · 低优先级**）

> **Lite v1 验收前不做**。`frontend/app` + `backend/` 保持现路径作参考；本 Phase 仅在未来需要统一 pnpm workspace 时执行，**不要求** Studio 改用 `@jumpx/ui`。

| ID | 任务 | 说明 |
|----|------|------|
| G1 | `frontend/app` → `packages/studio`（可选） | 目录搬迁；Docker 仍可从原路径 build 或同步改 compose |
| G2 | `adapters-studio`（可选） | 验证三端 UI 一致；非 v1 阻塞项 |
| G3 | 更新 RUN.md / compose 路径 | 与 G1 同步 |

---

## 7. 测试与 parity 清单

### 7.1 手动 E2E（每 Phase B 起必须跑）

1. 输入主题（含参考资料 txt）→ 开始  
2. 观察 todos 实时推进 + 活动流  
3. 大纲 Overlay：`OutlineEditor` 双栏 → 确认  
4. 选模板：7 网格 + ★ 推荐  
5. 选 HTML 形态 → 渲染  
6. 完成：iframe/srcDoc 预览可翻页  
7. HITL 每一步 Cancel/重拟路径不白屏  

### 7.2 Studio 对照测试

同一主题、同一模型配置下：

| 检查项 | Studio | Lite/Ext |
|--------|--------|----------|
| 大纲页数 | 记录 | ±1 页可接受（模型随机） |
| 选用 preset | 记录 | 一致 |
| 最终 HTML 页数 | slide count | 一致 |
| 交互次数 | 3 interrupts | 3 interrupts |

### 7.3 自动化（建议 Phase B 后）

- `@jumpx/ports`：`parseOutline` 单测（从 OutlineEditor 抽纯函数）  
- `@jumpx/agent-js`：mock model 跑工具链集成测（可选 vitest）  
- UI：Playwright  smoke（Lite dev server）

---

## 8. 缺口登记册（无法无缝 · 留空迭代）

> **产品策略（已拍板）**：**不隐藏** Studio 已有入口；无法无损的能力用 **等效 UX + 诚实文案**（如不声称「矢量 PDF 已生成」）。导出见 §8.1；配图 mode 见 §8.3。

---

### 8.1 导出 PDF / PNG zip / PPTX

**Studio 实现**：`export_deck.py` — Playwright 启动 Chromium，加载 `index.html` file:// URI，注入打印/截图 CSS。

**为何不能无损**：

- 浏览器页内无 headless Chromium；WASM Chromium 体积与 MV3 限制不现实  
- `html2pdf.js` / `jspdf` 无法达到 Studio 的矢量 PDF 与分页精度  
- PPTX 需 python-pptx 或逐页截图贴图 pipeline

**可选等效方案（待拍板）**：

| 方案 | 优点 | 缺点 |
|------|------|------|
| A. Studio-only 导出 | 零开发 | Lite 功能缺失 |
| B. 用户「在 Studio 打开此 HTML」 | 简单 | 需部署 Studio |
| C. 可选 **导出 microservice**（用户自建 Docker 只跑 export API） | 保真 | 又不是纯前端 |
| D. 浏览器 **打印 → 另存 PDF**（引导用户 Cmd+P） | 零后端 | 体验差、分页不可控 |
| E. 第三方 SaaS（如 CloudConvert API） | 省运维 | 密钥、隐私、费用 |
| F. PPTX：仅 **图片幻灯片**（canvas 截图 per slide） | 纯前端可做 | 非 editable 矢量，与 Studio 不同 |

**v1 已定（方案 A + D）**：HTML 文件下载 + 浏览器「打印 → 另存为 PDF」引导；PNG/PPTX 菜单项说明「Lite 暂不支持，可下载 HTML 后在 Studio 导出」或后续 I1。Playwright 级导出留 **Iteration I1**。

---

### 8.2 LLM / API CORS（纯 Web）

**Studio 实现**：Vite proxy `/lg` + 后端代调。

**为何不能无损**：静态托管的 Lite 页面向 `ark.cn-beijing...` 直连会被 CORS 拒绝。

**可选等效方案**：

| 方案 | 适用 |
|------|------|
| A. **Extension background fetch** | Extension ✅ |
| B. 用户自建 CORS 反代（nginx/cloudflare worker） | 高级用户 |
| C. 文档列「支持浏览器 CORS 的网关」 | 运营 |
| D. Lite 部署在同源 BFF 后（又变成有后端） | 半 Studio |

**v1（Lite 正式版）**：Phase **C6** — 设置页 + [`RUN.md`](../../RUN.md) 写清 CORS/反代；失败时 actionable 错误。  
**Extension（Phase E）**：background fetch（方案 A），作为无反代用户的完整解法。

---

### 8.3 AI 配图 `generate_image`

**Studio 实现**：后端 `slide_tools.generate_image` — OpenAI/Gemini/Jimeng/mock，写 `runs/.../images/`。

**Lite 现状**：stub 返回 `image-backend-unavailable`。

**可选等效方案**：

| 方案 | 说明 |
|------|------|
| A. Extension background + 存储 blob 到 IndexedDB | 推荐 Ext 路径 |
| B. 浏览器直连 image API | 多数不可行 + 密钥暴露 |
| C. 维持 HTML-only，配图 mode 置灰 | ~~已否决~~（用户要求不隐藏） |
| D. 用 **同一 LLM** 生成 SVG/Canvas 内联图（非 raster） | 体验不同，作 fallback |

**v1（Lite）**：Phase **C7** — 浏览器实装 `generate_image`（对齐 Studio provider 矩阵中能 CORS 直连的部分）；失败时 tool 返回 `image-backend-unavailable` 并 **UI 提示**配置 image key 或改 HTML。  
**Extension**：Phase E 用 background 补齐 CORS 受限 provider → **Iteration I2** 与 E 合并验收。

---

### 8.4 资料上传解析（`/api/extract`）

**Studio**：markitdown + pypdf，多格式。

**浏览器可覆盖**：

| 格式 | 方案 |
|------|------|
| txt/md | 原生 |
| pdf（文字层） | pdf.js |
| docx | mammoth.js（丢版式） |
| pptx/xlsx | **缺口** — sheetjs 仅 partial |

**不可覆盖**：扫描件 PDF OCR（Studio 也不支持）。

**计划占位**：Phase C2 已做 txt/md/pdf/docx；pptx/xlsx 留空或提示「请转 pdf」。

---

### 8.5 配方契约校验 `validate_recipe` / `revalidateAll`

**Studio**：Python 调 skill 的 `validate_slide_plan`、lint、安全审查。

**浏览器**：可 port 部分 JSON Schema 校验（AJV）；**干跑 agent** 不现实。

**v1 最小集**：Phase **F6** — 保存时 AJV + 路径白名单。  
**完整干跑**：**Iteration I4**（post-v1）。

---

### 8.6 Run 历史与 Studio workspace 互通

**Studio**：`workspace/runs/` 持久化在 docker volume。

**Lite/Ext**：IndexedDB 本地；**不会**自动读 Studio 目录。

**可选等效**：Export/import「run 包」（zip：plan + html + source md）手动迁移 — **Iteration I5**。

---

### 8.7 Provider 密钥安全模型

**Studio**：密钥在后端 `.env`，前端 masked。

**Lite/Ext**：密钥进 localStorage / chrome.storage — **XSS 即泄露**。

**缓解**：Extension 隔离 origin；Content Security Policy；不在 content script 暴露 key；文档安全说明。

---

### 8.8 Skill 版本与「运行态」一致

**Studio**：active 配方 = LangGraph 挂载目录，可在线改 references。

**Lite**：内置 `@jumpx/forge-assets` @ sync 版本；改配方仅影响本地 IDB 副本。

**等效**：设置页显示 `skillVersion`；支持用户 import 与 Studio 导出的 zip 对齐 — Phase F。

---

## 9. 迭代 backlog 汇总（Lite v1 之后）

| ID | 主题 | 优先级 | 依赖 |
|----|------|--------|------|
| I1 | Playwright 级 PDF/PNG/PPTX（或 microservice） | P3 | v1 已用 HTML+打印 |
| I2 | Extension 补齐 CORS 受限的 image/LLM | P1 | Phase E（M3） |
| I3 | docx/pptx 资料解析 | P3 | — |
| I4 | 配方完整干跑校验 | P3 | F6 已覆盖最小集 |
| I5 | Run 包 import/export（与 Studio 互通） | P3 | Phase D |
| I6 | Lite 可选 BFF 同源代理 | P4 | 运维 |
| I7 | `@jumpx/ui` 回接 Studio | P5 | Phase G |

---

## 10. 已拍板决策（锁定）

| # | 问题 | **结论** |
|---|------|----------|
| 1 | Lite vs Extension 优先级 | **先 Lite v1，后 Extension** |
| 2 | 导出能力 | **接受** HTML 下载 + 打印导 PDF；不承诺 Studio 级 PDF/PNG/PPTX |
| 3 | 配图 mode | **不隐藏**；v1 在 Lite 实装浏览器侧出图（C7），Ext 再补 CORS |
| 4 | 配方 | **v1 必做**（Phase F 并入 M2） |
| 5 | Lite 定位 | **正式版**；密钥存 browser storage，配安全说明与 CSP |
| 6 | Studio 目录 | **`frontend/app` + `backend/` 参考不动**；Phase G **v1 前不做** |

---

## 11. 里程碑与完成定义

| 里程碑 | 包含 Phase | Definition of Done |
|--------|------------|-------------------|
| **M1 · Lite 主路径** | A + B | 无后端：主题 → 三 HITL → HTML 预览；`LiveWorkbench`/`OutlineEditor` 对齐 Studio；`frontend/app` 无 diff |
| **M2 · Lite v1 正式版** | + C + D + **F** | 输入/资料/设置(CORS)/演示/Present；IDB 恢复；**Recipe Hub + active 热替换**；导出=HTML+打印指引；**配图 mode 可选且可用或明确报错**；RUN.md 可交付 |
| **M3 · Extension MVP** | E | **M2 完成后**；侧栏；background CORS；chrome.storage |
| **M4 · 缺口迭代** | I1–I7 | 按 §9 关闭或 Won't fix |
| **— · Phase G** | G | Lite v1 后可选；不阻塞 M2/M3 |

---

## 12. 执行顺序速查

```
Phase A (ports/资产/流式)
    → Phase B (LiveWorkbench + OutlineEditor)           ← M1
    → Phase C (输入/设置/Present/CORS/出图)              ┐
    → Phase D (IDB 持久化)                               ├─ M2 · Lite v1
    → Phase F (Recipe/Style/Skill + F6 校验)             ┘
    → Phase E (Extension)                               ← M3（M2 后）
    → Iteration I*                                      ← M4
    → Phase G (Studio monorepo，可选，v1 后)
```

---

## 13. 相关文件索引

| 路径 | 说明 |
|------|------|
| `frontend/app/src/LiveWorkbench.jsx` | UI 迁移主源 |
| `frontend/app/src/OutlineEditor.jsx` | 最先迁移组件 |
| `frontend/app/src/agent.js` | Studio AgentStream 对照 |
| `packages/agent-js/src/useBrowserAgent.tsx` | Lite agent 实现 |
| `packages/lite/src/LiteWorkbench.tsx` | 迁移后删除/替换 |
| `backend/recipe_api.py` | ports 行为对照 |
| `backend/export_deck.py` | 导出缺口依据 |
| `deepagentsjs/apps/doc-agent-extension/` | Extension 参考 |
| `scripts/sync-forge-skill.mjs` | skill 资产同步 |

---

*文档维护：每完成一个 Phase，在本文件 §6 表格中标注 ✅，并在 §8 更新缺口状态（已实现 / Won't fix / 方案 X）。*
