#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
bash tests/release-gate.sh
rm -rf dist
mkdir -p dist
zip -qr "dist/cronograma-ead-core-2.19.0.zip" plugin-cronograma-ead-core -x '*/.DS_Store' '*.log'
zip -qr "dist/cronograma-ead-theme-1.4.0.zip" theme-cronograma-ead-theme -x '*/.DS_Store' '*.log'
echo 'Pacotes gerados em dist/. Eles só são criados quando todos os portões passam.'
