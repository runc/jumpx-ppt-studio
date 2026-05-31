# 05 — Writer

> Step 4 落地文档。把确认后的 `outline.md` 写成符合 `slide_plan.schema.json` 的 `slide_plan.json`。Writer 写页面计划和讲稿，不写 HTML。

---

## 角色

> 切换到 **Slide Writer**。

职责：

- 将 Gate 2 确认后的大纲转成逐页 `slide_plan.json`。
- 写每页标题、可见文本、讲解提示、视觉方向。
- 控制信息密度，给 Image / HTML renderer 留出可执行结构。
- 在 Reviewer 要求 1 处 critical 返工时，只增量修改相关页。

不做：

- 不手写 `index.html`。
- 不发明 schema 外字段。
- 不把长正文塞进图片页。
- 不把视觉风格写死成 CSS。

---

## 输入

- `source/context_pack.md`
- `source/outline.md`（已过 Gate 2）
- `source/research_notes.md`（若存在）
- `schemas/slide_plan.schema.json`

---

## 输出：`slide_plan.json`

必须通过：

```bash
python3 scripts/validate_slide_plan.py <project>/source/slide_plan.json
```

最低字段由 schema 强制：

- `deck_meta`
- `pages[].page_id`
- `pages[].page_title`
- `pages[].page_goal`
- `pages[].page_role_in_story`
- `pages[].key_message`
- `pages[].on_slide_text`
- `pages[].speaker_notes`
- `pages[].visual_direction`
- `pages[].layout_type`
- `pages[].image_requirement`

---

## 写作规则

### 标题

- 标题表达观点，不只写类别名。
- 避免 AI 腔套话，例如“开启新时代”“深入探索”“赋能未来”。
- 中文标题优先短句，英文标题优先动词或清晰名词短语。

### On-slide Text（深度教学版默认 medium-high 密度）

- 每页只保留一个主要观点，但**每个要点都要带一层支撑，不要只给标签**。
- **支撑层格式**：每条用「主点 → 支撑」或「标题：正文」承载——主点是结论/标签（≤24 中文字），支撑是它的*为什么 / 一个数字 / 一个具体例子 / 一处对比*（≤40 中文字）。
  - 反例（太薄，禁止）：`周末补觉`
  - 正例（有血肉）：`周末补觉 → 打乱生物钟，周一更困（社交时差，相当于每周飞一次时区）`
- `body` 默认 **4-6 条**；高视觉页 0-3 条；教学展开页可到 6 条。宁可一页 4 条都带支撑，也不要 6 条干标签。
- 抽象概念页至少配一个具象锚点（一个数字、一个生活化类比、一个真实场景）。
- 图片页如果 `text_in_image_risk = high`，可见文字必须极少，复杂正文放 HTML 或 speaker notes。

### Speaker Notes（口播讲稿，是血肉的主要载体）

> speaker_notes 不挤在幻灯片上、不会溢出，因此**这里要写厚**——它是演讲者真正照着讲的口播稿，也是 deck 脱离现场时的自学材料。

- **每页 speaker_notes 不少于 150 个中文字**，写成演讲者可以**逐字照念**的口播稿，不是导演提示。
- ❌ 禁止写成「强调 X」「用 Y 比喻」「点出 Z」这类导演式提示（太薄）。
- ✅ 要写出**真正要说出口的话**，并覆盖：① 钩子/过渡的原话（接上一页）② 把每个可见要点用 2-3 句**展开**讲清 ③ **为什么是这样**（机制/原理，讲明白）④ **一个具体例子、数字或类比的完整叙述**（不是只提一句，要讲完）⑤ 一句过渡到下一页。
  - 对照：导演提示「用锚的比喻说明固定起床」←太薄；口播稿「想象起床时间是一只锚。锚一旦抛下，船（你的睡眠）就会自然停在它周围——所以与其纠结几点睡，不如先固定几点起，困意会自己提前找上来。」←这才对。
- 未验证的数字/事实在 notes 标注「（约数 / 待核实）」，不要在可见文本里硬写绝对数字。

### 资料很少时如何充实（重要）

当 `context_pack.md` 资料很少（如用户只给了一个主题）时，**不要因此写薄**：

- 从领域常识补充具体数据、真实案例、生活化类比，让每页有抓手；补充的数字/事实按上条标注。
- 主动加"机制/为什么"与"具体例子"的内容，把单薄主题讲出层次。
- 标题表达观点而非类别；正文给"所以呢/为什么/怎么用"，而不是停在名词。

### Visual Direction

写给 Web Renderer 与 Image Renderer 的共同提示：

- 页面构图，例如“左侧大标题，右侧三步路径”。
- 视觉隐喻，例如“从混乱便签到清晰流程”。
- 图片意图，例如“封面 hero image / diagram / quote card / no image”。

不要写具体 CSS 值；颜色、字体从 `style_lock.json` 来。

---

## Layout 选择规则

| 叙事用途 | 推荐 `layout_type` |
|----------|--------------------|
| 封面 / 开场 | `cover` |
| 章节切换 | `section-divider` |
| 单一核心观点 | `big-idea` |
| 概念 + 解释 / 问题 + 方案 | `two-column` |
| 金句 / 用户原话 | `quote` |
| 方法论 / 模型 | `framework` |
| 流程 / 路线图 | `timeline` |
| Before / After / 方案对比 | `comparison` |
| 有明确配图或截图 | `image-text` |
| 总结 / 行动 | `closing` |

---

## Image Requirement 规则

| Output Mode | `image_requirement.needed` 建议 |
|-------------|----------------------------------|
| `html-only` | 仅封面、章节页、金句页可 true |
| `html-takeover` | 为后续 Prompt Staging 保留 true，但 HTML 必须能无图工作 |
| `image-first` | 多数页面 true；高文字页可 false 或降文字；**每页真出图约 60–90 秒**（见 `09-image-renderer.md` §生成耗时预期），页数多时应与用户确认是否改为 `mixed` 或减少 needed 页 |
| `mixed` | 封面、章节页、金句页、传播页 true；正文页按需 |
| `html-only-with-prompts` | 只为用户指定页 true |

`generated_image_path` 仅在图片已存在或约定将生成时填写，格式必须类似 `images/slide-03.png`。

---

## Body 行格式约定（给 Web Renderer）

Writer 需要按 layout 提供可解析的 `on_slide_text.body`：

| Layout | body 写法 |
|--------|-----------|
| `two-column` | 2 条以上时，`body[0]` 会进入左栏说明，`body[1..]` 进入右栏列表；少于 2 条时左栏回退 `key_message` |
| `framework` | 每条写 `标题:正文`，最多 6 条 |
| `timeline` | 每条写 `阶段:说明`，最多 6 条 |
| `comparison` | 每条写 `标题:正文`，最多 4 条 |
| `closing` | 每条写 `行动:说明`，最多 6 条 |
| `image-text` | 所有 body 进入文字侧列表；若 `image_requirement.needed == true`，必须准备 `generated_image_path` 或接受 pending 占位 |

Mixed 项目中，要在 HTML 里显示配图的页应优先使用 `image-text` layout；`cover` / `quote` 等 layout 不会自动铺全页背景图。

---

## 返工策略

Reviewer 发现 1 处 critical 时：

1. 只改相关页。
2. 保持 `page_id` 不变。
3. 更新 `key_message`、`on_slide_text`、`speaker_notes` 或 `evidence_refs`。
4. 重新运行 `validate_slide_plan.py`。
5. 交回 Reviewer 复审一次。

2+ critical 或复审仍失败，回退 Gate 2。

---

## 与其他角色的衔接

| 下一步 | 谁接手 | 用到什么 |
|--------|--------|----------|
| Step 5 Review | Reviewer | 完整 `slide_plan.json` |
| Step 6 Design | Designer | `deck_meta.style_name`、`layout_type`、`visual_direction` |
| Step 7A Image | Image Renderer | `image_requirement`、`visual_direction`、`on_slide_text` |
| Step 7B Web | Web Renderer | `layout_type`、`on_slide_text`、`speaker_notes` |
