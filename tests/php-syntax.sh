#!/usr/bin/env bash
set -euo pipefail
find plugin-cronograma-ead-core theme-cronograma-ead-theme -type f -name '*.php' -print0 | xargs -0 -n1 php -l >/dev/null
echo "OK php-syntax"
