import fs from 'node:fs';
let fails = 0;
const read = p => fs.readFileSync(p, 'utf8');
const checks = [];
const roles = read('plugin-cronograma-ead-core/includes/class-roles.php');
const accounts = read('plugin-cronograma-ead-core/includes/class-accounts.php');
const rest = read('plugin-cronograma-ead-core/includes/class-rest.php');
const service = read('plugin-cronograma-ead-core/includes/class-service.php');
const store = read('plugin-cronograma-ead-core/includes/class-store.php');
const privacy = read('plugin-cronograma-ead-core/includes/class-privacy.php');
const notify = read('plugin-cronograma-ead-core/includes/class-notify.php');
const ui = read('ui/src/pages/Acessos.tsx');
const schedule = read('ui/src/lib/schedule.ts');
const cronograma = read('ui/src/pages/Cronograma.tsx');
const integracoes = read('ui/src/pages/Integracoes.tsx');

checks.push([roles.includes("set_caps( get_role( 'editor' ), array() )"), 'Editor has Cronogramas capabilities stripped']);
checks.push([!accounts.match(/return\s+array\s*\([^)]*['\"]link['\"]/s), 'Password reset endpoint does not return link']);
checks.push([accounts.includes('2 * HOUR_IN_SECONDS'), 'Reset expiration hardened to 2 hours']);
checks.push([rest.includes("'/auditoria'") && rest.includes('can_audit'), 'Audit endpoint has dedicated permission']);
checks.push([rest.includes('can_manage_catalog') && rest.includes('can_manage_accounts') && rest.includes('can_import') && rest.includes('can_export'), 'REST uses operation-specific capability callbacks']);
checks.push([/['"]\/feriados\/config['"]/.test(rest) && /'callback'\s*=>\s*array\( __CLASS__, 'feriados_config' \), 'permission_callback'\s*=>\s*array\( __CLASS__, 'can_configure' \)/.test(rest) && /'callback'\s*=>\s*array\( __CLASS__, 'feriados_config_salvar' \), 'permission_callback'\s*=>\s*array\( __CLASS__, 'can_configure' \)/.test(rest), 'Holiday integration config GET and POST require dedicated configuration permission']);
checks.push([!ui.includes('Copiar só o link') && !ui.includes('cred.link'), 'Frontend does not expose reset link copying']);
checks.push([store.includes('256 * 1024') || store.includes('262144'), 'Turma payload has size limit']);
checks.push([service.includes('Cronograma_EAD_DB::begin()') && service.includes('Cronograma_EAD_DB::rollback()'), 'Critical service operations use transactions']);
checks.push([service.includes("'simular'") && service.includes('preparar_importacao'), 'Import supports preflight/simulation']);
checks.push([notify.includes('Cronograma_EAD_Accounts::inativo'), 'Inactive users are filtered from notifications']);
checks.push([privacy.includes('wp_privacy_personal_data_exporters') && privacy.includes('wp_privacy_personal_data_erasers'), 'WordPress privacy exporter/eraser integrated']);
checks.push([schedule.includes('if (hol.has(e.d))'), 'Holiday on Saturday is not suppressed']);
checks.push([!cronograma.includes('workday(x.d, R.postDias, null)'), 'Grade-posting calculation no longer ignores holidays']);
checks.push([!rest.includes("permission_callback' => '__return_true'"), 'No public REST permission callback']);
checks.push([integracoes.includes('semPermissao') && integracoes.includes('A configuração de credenciais é exclusiva dos administradores') && integracoes.includes('configurada === null'), 'Integrations page shows role restriction and loading state instead of editable form']);

for (const [ok, name] of checks) {
  console.log(`${ok ? 'OK' : 'FALHA'} ${name}`);
  if (!ok) fails++;
}
if (fails) process.exit(1);
console.log(`OK security-static: ${checks.length} checks`);
