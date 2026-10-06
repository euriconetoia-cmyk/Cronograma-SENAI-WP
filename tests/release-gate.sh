#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

bash tests/php-syntax.sh
php tests/unit-rules.php
node tests/calendar-contract.mjs
node tests/security-static.mjs

command -v pnpm >/dev/null || { echo 'BLOQUEIO: pnpm não instalado.' >&2; exit 20; }
(
  cd ui
  pnpm install --frozen-lockfile
  pnpm lint
  pnpm typecheck
  pnpm build:wp
  pnpm build:preview
  pnpm audit --audit-level high
)

# O bundle deve ser tão recente quanto qualquer fonte da UI.
latest_src=$(find ui/src -type f -printf '%T@\n' | sort -nr | head -1)
bundle=$(stat -c '%Y' plugin-cronograma-ead-core/assets/app.js)
awk -v src="$latest_src" -v b="$bundle" 'BEGIN { if (b+0 < src+0) exit 1 }' || { echo 'BLOQUEIO: assets/app.js está desatualizado.' >&2; exit 21; }

command -v docker >/dev/null || { echo 'BLOQUEIO: Docker não instalado.' >&2; exit 22; }
docker compose up -d db wordpress
IDS="$(bash tests/setup-wp.sh | tail -1)"
node tests/e2e.mjs "$IDS"
node tests/acessos.mjs "$IDS"
node tests/avisos.mjs "$IDS"

echo 'RELEASE GATE: APROVADO'
