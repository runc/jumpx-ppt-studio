# Jumpx Slides · 单机应用镜像（Phase 5）
# 一镜像跑齐三进程：langgraph dev(:2024) + recipe_api(:2025) + vite(:5180)。
# 基于 Playwright 官方 Python 镜像（自带 chromium 运行时依赖），补 CJK 字体 + Node。
# noble = Ubuntu 24.04，自带 Python 3.12（deepagents 需 ≥3.11）。

FROM mcr.microsoft.com/playwright/python:v1.49.0-noble

# CJK 字体（中文 deck 渲染必需）+ Node 20（跑 vite）+ unzip（拉 skill 用）
RUN apt-get update && apt-get install -y --no-install-recommends \
      fonts-noto-cjk fonts-noto-color-emoji curl ca-certificates unzip && \
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash - && \
    apt-get install -y --no-install-recommends nodejs && \
    apt-get clean && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# —— 构建时拉 ai-slide-producer skill 的固定版本，烤进镜像（镜像自包含，部署不再依赖宿主 repo）——
# SKILL_URL：skill 发布 zip 的 URL（GitHub release / R2 / 任意静态托管）；顶层应为 ai-slide-producer/。
# 用 --build-arg SKILL_URL=... 传入；版本由该 URL 指向的具体 release 决定（建议带 tag，如 v0.2.0）。
ARG SKILL_URL
RUN test -n "$SKILL_URL" || (echo "❌ 必须传 --build-arg SKILL_URL=<skill release zip 的 URL>"; exit 1); \
    echo "拉取 skill: $SKILL_URL" && \
    curl -fsSL "$SKILL_URL" -o /tmp/skill.zip && \
    mkdir -p /skill && unzip -q /tmp/skill.zip -d /skill && rm /tmp/skill.zip && \
    test -f /skill/ai-slide-producer/SKILL.md || (echo "❌ zip 顶层不是 ai-slide-producer/"; exit 1)
# skill 源固定指向镜像内路径（覆盖 setup_workspace 的默认同级定位）
ENV JX_SKILL_SRC=/skill/ai-slide-producer

# —— Python 依赖（先单独 COPY 以利缓存）——
COPY backend/requirements.txt backend/requirements.txt
RUN pip install --no-cache-dir -r backend/requirements.txt && \
    pip install --no-cache-dir uvicorn && \
    python -m playwright install --with-deps chromium

# —— 前端依赖 ——
COPY frontend/app/package.json frontend/app/package-lock.json frontend/app/
RUN cd frontend/app && npm install --no-audit --no-fund

# —— 源码 ——
COPY backend backend
COPY frontend frontend
COPY docker/entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

EXPOSE 5180
ENTRYPOINT ["/entrypoint.sh"]
