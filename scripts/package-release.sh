#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
bash tests/release-gate.sh
rm -rf dist
mkdir -p dist/plugin dist/theme
cp -R plugin-cronograma-ead-core dist/plugin/cronograma-ead-core
cp -R theme-cronograma-ead-theme dist/theme/cronograma-ead-theme
(cd dist/plugin && zip -qr ../cronograma-ead-core-2.20.0.zip cronograma-ead-core -x '*/.DS_Store' '*.log')
(cd dist/theme && zip -qr ../cronograma-ead-theme-1.4.0.zip cronograma-ead-theme -x '*/.DS_Store' '*.log')
unzip -t dist/cronograma-ead-core-2.20.0.zip >/dev/null
unzip -t dist/cronograma-ead-theme-1.4.0.zip >/dev/null
echo 'Pacotes gerados em dist/. Eles só são criados quando todos os portões passam.'
