# recipe_seed · 内置配方的「可改层」种子（入库）

锁定基座（`ai-slide-producer` skill）是**只读上游**，我们不改它。但内置配方的"性格"
（叙事深度、写作密度、讲稿厚度等可改层）是我们的产品默认，必须**可复现、可入库**。

`recipes.py::_seed_from_base` 在从 base skill 拷出一个内置配方后，会叠加这里
`recipe_seed/<rid>/` 的覆盖：

- `references/*.md` —— 覆盖同名 reference（仅限可改层文件，见 `recipes.EDITABLE`）。
- `manifest_overrides.json` —— 合并进 manifest 的展示/密度字段（白名单见 `recipes.META_FIELDS`）。

## default —— 深度教学版
把单薄主题讲出血肉：03-strategist 加深叙事 beat（机制/例子/对比/可执行收束）、
不因"X 分钟"压页数；05-writer 每个要点带支撑层、speaker_notes 写成 ≥150 字逐字口播稿；
density=2（详尽）。

> 运行时用户在配方页对 default 的进一步编辑仍写入 `workspace/recipes/default/`（运行态），
> 不回写这里。这里只是"开箱默认"。
