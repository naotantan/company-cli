#!/bin/bash
set -e

# ─────────────────────────────────────────────
#  maestro インストールスクリプト
#  使い方: curl -fsSL https://raw.githubusercontent.com/naotantan/maestro/main/install.sh | bash
# ─────────────────────────────────────────────

REPO_URL="https://github.com/naotantan/maestro.git"
INSTALL_DIR="${MAESTRO_DIR:-$HOME/maestro}"
BOLD="\033[1m"
GREEN="\033[32m"
YELLOW="\033[33m"
RED="\033[31m"
RESET="\033[0m"

info()    { echo -e "${GREEN}[maestro]${RESET} $*"; }
warn()    { echo -e "${YELLOW}[warn]${RESET} $*"; }
error()   { echo -e "${RED}[error]${RESET} $*"; exit 1; }

echo ""
echo -e "${BOLD}┌────────────────────────────────────────┐${RESET}"
echo -e "${BOLD}│        maestro インストーラー          │${RESET}"
echo -e "${BOLD}└────────────────────────────────────────┘${RESET}"
echo ""

# ── Docker チェック ──────────────────────────
info "Docker の確認中..."
if ! command -v docker &>/dev/null; then
  error "Docker が見つかりません。https://docs.docker.com/get-docker/ からインストールしてください。"
fi
if ! docker info &>/dev/null; then
  error "Docker が起動していません。Docker Desktop を起動してから再実行してください。"
fi
info "Docker: OK"

# ── git チェック ─────────────────────────────
if ! command -v git &>/dev/null; then
  error "git が見つかりません。git をインストールしてから再実行してください。"
fi

# ── クローン / 更新 ──────────────────────────
if [ -d "$INSTALL_DIR/.git" ]; then
  info "既存のインストールを更新中: $INSTALL_DIR"
  git -C "$INSTALL_DIR" pull --ff-only
else
  info "maestro をクローン中: $INSTALL_DIR"
  git clone --depth 1 "$REPO_URL" "$INSTALL_DIR"
fi

cd "$INSTALL_DIR"

# ── .env 生成 ────────────────────────────────
if [ ! -f .env ]; then
  info ".env ファイルを生成中..."
  cp .env.example .env 2>/dev/null || cat > .env <<EOF
# maestro 環境変数
DATABASE_URL=postgresql://maestro:changeme@postgres:5432/maestro
POSTGRES_PASSWORD=changeme
API_KEY_SALT=$(LC_ALL=C tr -dc 'a-zA-Z0-9' < /dev/urandom 2>/dev/null | head -c 32 || echo "random-salt-please-change")
ENCRYPTION_KEY=$(LC_ALL=C tr -dc '0-9a-f' < /dev/urandom 2>/dev/null | head -c 64 || echo "0000000000000000000000000000000000000000000000000000000000000000")
NODE_ENV=production
EOF
  info ".env を生成しました（必要に応じて編集してください）"
else
  info ".env は既に存在します（スキップ）"
fi

# ── Docker Compose 起動 ──────────────────────
info "コンテナをビルド・起動中（初回は数分かかります）..."
docker compose up -d --build

# ── 起動待ち ─────────────────────────────────
info "API の起動を待機中..."
max=30
count=0
until curl -sf http://localhost:3000/health >/dev/null 2>&1; do
  count=$((count + 1))
  if [ $count -ge $max ]; then
    warn "API の起動確認がタイムアウトしました。docker compose logs api で確認してください。"
    break
  fi
  sleep 3
done

# ── 完了メッセージ ───────────────────────────
echo ""
echo -e "${GREEN}${BOLD}✓ maestro の起動が完了しました！${RESET}"
echo ""
echo -e "  ダッシュボード : ${BOLD}http://localhost:5173${RESET}"
echo -e "  API           : ${BOLD}http://localhost:3000${RESET}"
echo ""
echo -e "  停止コマンド  : ${BOLD}cd $INSTALL_DIR && docker compose down${RESET}"
echo -e "  再起動        : ${BOLD}cd $INSTALL_DIR && docker compose up -d${RESET}"
echo -e "  ログ確認      : ${BOLD}cd $INSTALL_DIR && docker compose logs -f${RESET}"
echo ""
