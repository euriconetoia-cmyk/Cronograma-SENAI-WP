#!/usr/bin/env bash
set -euo pipefail
BASE="http://127.0.0.1:${WP_PORT:-8099}"
WP="docker compose run --rm wpcli --path=/var/www/html"

for i in {1..60}; do
  if curl -fsS "$BASE/wp-admin/install.php" >/dev/null 2>&1 || curl -fsS "$BASE/" >/dev/null 2>&1; then break; fi
  sleep 2
done

$WP core is-installed >/dev/null 2>&1 || $WP core install \
  --url="$BASE" --title="Cronogramas EaD Teste" \
  --admin_user="${WP_ADMIN_USER:-admin}" \
  --admin_password="${WP_ADMIN_PASSWORD:-senha123}" \
  --admin_email="${WP_ADMIN_EMAIL:-admin@example.test}" --skip-email
$WP option update permalink_structure '/%postname%/'
$WP rewrite flush --hard
$WP plugin activate cronograma-ead-core
$WP theme activate cronograma-ead-theme

create_user(){
  local login="$1" email="$2" role="$3"
  if ! $WP user get "$login" --field=ID >/dev/null 2>&1; then
    $WP user create "$login" "$email" --user_pass=senha123 --role="$role" >/dev/null
  else
    $WP user update "$login" --user_pass=senha123 --role="$role" >/dev/null
  fi
}
create_user coord_itb coord_itb@example.test cronograma_ead_unidade
create_user aux_itb aux_itb@example.test cronograma_ead_unidade
create_user coord_luz coord_luz@example.test cronograma_ead_unidade
create_user consulta consulta@example.test cronograma_ead_consulta
create_user equipe2 equipe2@example.test cronograma_ead_equipe

uid(){ $WP user get "$1" --field=ID; }
$WP user meta update "$(uid coord_itb)" ce_unidades '["u_itb"]' --format=json >/dev/null
$WP user meta update "$(uid coord_itb)" ce_validador 1 >/dev/null
$WP user meta update "$(uid aux_itb)" ce_unidades '["u_itb"]' --format=json >/dev/null
$WP user meta delete "$(uid aux_itb)" ce_validador >/dev/null 2>&1 || true
$WP user meta update "$(uid coord_luz)" ce_unidades '["u_luz"]' --format=json >/dev/null
$WP user meta update "$(uid coord_luz)" ce_validador 1 >/dev/null
$WP user meta update "$(uid consulta)" ce_unidades '["u_itb"]' --format=json >/dev/null

$WP cron event run cronograma_ead_diario >/dev/null 2>&1 || true
$WP eval 'echo wp_json_encode(Cronograma_EAD_Pages::ids());'
