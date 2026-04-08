FROM node:20-slim AS builder
WORKDIR /app

# pnpm インストール
RUN npm install -g pnpm

# 依存関係コピー
COPY package.json pnpm-lock.yaml* pnpm-workspace.yaml ./
COPY scripts/ ./scripts/
COPY .env.example ./.env.example
COPY packages/shared/package.json ./packages/shared/
COPY packages/adapters/package.json ./packages/adapters/
COPY packages/db/package.json ./packages/db/
COPY packages/api/package.json ./packages/api/
COPY packages/ui/package.json ./packages/ui/

# 依存インストール
RUN pnpm install --frozen-lockfile

# sharp ネイティブバイナリを明示的にインストール（pnpm postinstall がスキップされる場合の対策）
RUN node /app/node_modules/.pnpm/sharp@0.32.6/node_modules/sharp/install/libvips.js 2>/dev/null || true

# ソースコードコピー
COPY packages/shared ./packages/shared
COPY packages/adapters ./packages/adapters
COPY packages/db ./packages/db
COPY packages/api ./packages/api
COPY tsconfig.base.json ./

# ビルド
RUN pnpm --filter @maestro/shared build
RUN pnpm --filter @maestro/adapters build
RUN pnpm --filter @maestro/db build
RUN pnpm --filter @maestro/api build

# 本番イメージ
FROM node:20-slim
RUN apt-get update && apt-get install -y --no-install-recommends git postgresql-client curl ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /app

# ビルダーのモノレポnode_modulesをそのままコピー（pnpmのリンク構造を保持）
COPY --from=builder /app ./

EXPOSE 3000
CMD ["node", "packages/api/dist/index.js"]
