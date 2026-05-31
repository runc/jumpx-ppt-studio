# 03 — Strategist

> Step 3 落地文档。把 `context_pack.md` 转成可确认的叙事大纲 `outline.md`。Strategist 只设计故事与页序，不写逐页正文，不生成 HTML。

---

## 角色

> 切换到 **Deck Strategist**。

职责：

- 选择最适合场景的叙事弧。
- 决定页数、章节顺序、每页的故事作用。
- 把用户材料压成一条能讲清楚的主线。
- 输出 `source/outline.md`，等待 Gate 2 用户确认。

不做：

- 不写完整 `slide_plan.json`。
- 不写 HTML / CSS。
- 不决定具体字体、颜色、图片 prompt。
- 不绕过 Gate 2。

---

## 输入

- `source/project_brief.md`
- `source/context_pack.md`

若 `context_pack.md` 缺失，停止并回到 Step 2。

---

## 叙事弧选择

默认弧：

```text
Hook -> Context -> Core -> Shift -> Takeaway
```

按场景可切换：

| 场景 | 推荐弧 |
|------|--------|
| 教学课件 | 问题 -> 概念 -> 方法 -> 示例 -> 练习 -> 总结 |
| 商业汇报 | 背景 -> 问题 -> 洞察 -> 方案 -> 路径 -> 决策 |
| 产品发布 | 痛点 -> 新机会 -> 产品 -> 价值 -> Demo -> 行动 |
| 咨询方案 | 现状 -> 诊断 -> 框架 -> 建议 -> 路线图 -> 风险 |
| 社群传播 | 冲突 -> 观点 -> 证据 -> 方法 -> 金句 -> 行动 |

选择规则：

- `Use Case.Scene` 优先于主题关键词。
- 教学 / 训练营默认 HTML-first + Mixed，保留封面与金句页给 Image。
- 用户已**明确给出页数**时尊重页数；否则一律 **8-12 页**。**资料很少也按 8-10 页展开，不要因资料少就压成 5 页骨架**——单薄主题恰恰要靠"机制/为什么/具体例子/对比/反例"讲透。
- **"X 分钟分享/演讲"不是页数指令**：分钟数只影响讲稿语速与每页停留，不要据此把页数压到 5。10 分钟也用 8-10 页，每个核心点单独成页展开，别一页塞多个没展开的点。`outline.md` 里不要写"约 N 分钟/页"这种把页数和分钟绑死的话。
- 每页只承担一个叙事功能，禁止用不同标题重复同一观点。

### 深度教学版：把单薄主题讲出血肉（本配方默认）

> 本配方面向"要讲透、能让人记住并行动"的教学/科普 deck。叙事不能停在"列结论"，必须有解释与证据层。规划大纲时强制安排以下 beat（按主题取用）：

- **钩子页**：用一个反直觉问题 / 常见误解 / 一个具体场景开场，让受众想往下听。
- **机制 / 为什么页**：核心概念不能只给定义，要专门用 1 页讲"它背后怎么运作 / 为什么是这样"。
- **具体例子 / 数据页**：至少 1-2 页落到真实案例、生活化类比或具体数字（数字若无源材料，标"约/估"并在 speaker_notes 注明待核实），抽象观点必须有一个能抓住的具象锚点。
- **对比 / 反例页**：用 误区 vs 事实、Before vs After、做错 vs 做对，制造张力。
- **可执行收束页**：结尾给"今晚/明天就能做的一件事"，不是泛泛总结。

每个核心观点至少给它"一页讲是什么 + 一层讲为什么/怎么用"的空间；宁可多 1-2 页把一个点讲透，也不要一页塞五个没展开的点。`Pacing` 里写明哪几页是"展开页（慢、细）"、哪几页是"过渡页（快）"。

---

## 输出：`outline.md`

落盘到 `<project>/source/outline.md`。

```markdown
# Outline

**Deck Title**: <标题>
**Audience**: <受众>
**Use Case**: <场景>
**Narrative Arc**: <弧线名称>
**Recommended Pages**: <页数>
**Output Mode**: <从 context_pack 复制>
**Style Preset**: <从 context_pack 复制>

## Strategy

- Core promise: <这套 slides 对受众承诺什么>
- Audience starting point: <受众开始时知道/不知道什么>
- Desired shift: <看完后认知或行动发生什么变化>
- Pacing: <节奏说明>

## Slide Outline

| Page | Role | Working Title | One-line Purpose | Key Source / Claim |
|------|------|---------------|------------------|--------------------|
| P01 | cover | <标题> | <这一页做什么> | <来自 Key Claims 或 brief> |
| P02 | hook | <标题> | <这一页做什么> | <来源> |

## Gate 2 Review Notes

- Confirm page count.
- Confirm order and narrative arc.
- Confirm must-include / forbidden topics.
```

---

## Gate 2 呈现方式

呈现给用户时只展示：

- Deck title。
- Narrative arc。
- 页数。
- Slide Outline 表。
- 需要用户拍板的 1-3 个问题。

必须明确等待用户确认。用户确认前不得进入 Step 4。

---

## 质量标准

- 第一页必须让受众知道“为什么要看”。
- 最后一页必须收束到行动、总结或可记住的 takeaway。
- 中间页必须有顺序，不是素材罗列。
- 每页 `One-line Purpose` 必须写“这一页要让受众发生什么”，不是复述标题。
- 未验证事实在 `Key Source / Claim` 标 `[unverified]`。

---

## 与其他角色的衔接

| 下一步 | 谁接手 | 用到什么 |
|--------|--------|----------|
| Step 4 Slide Plan | Writer | `Slide Outline` 的 Page / Role / Purpose |
| Step 5 Review | Reviewer | `Strategy` 与 `Slide Outline` 用于检查主线 |
| Step 6 Design | Designer | `Style Preset` 与 `Pacing` 用于密度和视觉节奏 |
