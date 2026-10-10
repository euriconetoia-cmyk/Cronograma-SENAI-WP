#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
FILE="plugin-cronograma-ead-core/assets/app.js"
test -s "$FILE" || { echo "BLOQUEIO: bundle WordPress ausente"; exit 1; }
echo "BASELINE DE ARTEFATOS (bytes; não é benchmark de navegador ou servidor)"
for f in "$FILE" ui/dist-single/index.html; do
  if test -f "$f"; then
    bytes="$(wc -c < "$f" | tr -d ' ')"
    gzip_bytes="$(gzip -c -n "$f" | wc -c | tr -d ' ')"
    sha="$(sha256sum "$f" | cut -d ' ' -f 1)"
    printf '%s | bytes=%s | gzip_bytes=%s | sha256=%s\n' "$f" "$bytes" "$gzip_bytes" "$sha"
  fi
done
echo "NOT MEASURED: navegador p50/p95, SQL EXPLAIN, tempo servidor e React Profiler."
