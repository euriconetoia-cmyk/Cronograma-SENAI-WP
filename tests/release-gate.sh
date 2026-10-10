#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

bash tests/php-syntax.sh
php tests/unit-rules.php
php tests/catalog-contract.php
php tests/catalog-integrity.php
node --experimental-strip-types --experimental-specifier-resolution=node tests/calendar-contract.mjs
node --experimental-strip-types --experimental-specifier-resolution=node tests/schedule-profiles.mjs
node --experimental-strip-types --experimental-specifier-resolution=node tests/schedule-multimodel.mjs
node --experimental-strip-types --experimental-specifier-resolution=node tests/modelos-cronograma.mjs
node tests/security-static.mjs

command -v pnpm >/dev/null || { echo 'BLOQUEIO: pnpm não instalado.' >&2; exit 20; }
(
  cd ui
  pnpm install --frozen-lockfile
  pnpm lint
  pnpm typecheck
  pnpm build:wp
  pnpm build:preview
  pnpm audit --prod --audit-level high
)
cp ui/dist-wp/app.js plugin-cronograma-ead-core/assets/app.js
test -s plugin-cronograma-ead-core/assets/app.js || { echo 'BLOQUEIO: bundle WordPress não foi gerado.' >&2; exit 21; }
# Baseline reproduzível dos artefatos sem inferir métricas de navegação.
bash tests/performance-artifact-baseline.sh

command -v docker >/dev/null || { echo 'BLOQUEIO: Docker não instalado.' >&2; exit 22; }
docker compose up -d db wordpress
IDS="$(bash tests/setup-wp.sh | tail -1)"
# Latência HTTP anônima em WordPress descartável; dados do runner não representam produção.
node tests/performance-http-baseline.mjs
node tests/e2e.mjs "$IDS"
node tests/acessos.mjs "$IDS"
node tests/avisos.mjs "$IDS"
# Falha SQL deliberada somente no WordPress local de CI; verifica rollback integral.
docker compose run --rm -v "$ROOT/tests:/tmp/ce-tests:ro" wpcli --path=/var/www/html eval-file /tmp/ce-tests/restore-rollback.php
# Provedores estaduais/municipais simulados: bloqueia rede e verifica TTL do cache degradado.
docker compose run --rm -v "$ROOT/tests:/tmp/ce-tests:ro" wpcli --path=/var/www/html eval-file /tmp/ce-tests/holiday-provider-degraded.php

echo 'RELEASE GATE: APROVADO'
