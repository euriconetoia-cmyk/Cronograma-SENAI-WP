<?php
define( 'ABSPATH', __DIR__ );
define( 'CRONOGRAMA_EAD_TESTING', true );
if ( ! class_exists( 'WP_Error' ) ) { class WP_Error { public $code; public $message; public $data; public function __construct($c,$m,$d=array()){ $this->code=$c;$this->message=$m;$this->data=$d; } } }
function is_wp_error($v){ return $v instanceof WP_Error; }
function wp_json_encode($v){ return json_encode($v); }
function sanitize_text_field($v){ return trim(strip_tags((string)$v)); }
require_once __DIR__ . '/../plugin-cronograma-ead-core/includes/class-rules.php';
require_once __DIR__ . '/../plugin-cronograma-ead-core/includes/class-store.php';
function c_ok($cond,$m){ if(!$cond){fwrite(STDERR,"FAIL: $m\n");exit(1);} }

$base = array(
  'pessoas'=>array(), 'feriados'=>array(), 'unidades'=>array(array('id'=>'u1','nome'=>'Unidade','cidade'=>'Goiânia','estado'=>'GO','codigoIbge'=>'5208707')),
  'cursos'=>array(array(
    'id'=>'c1','nome'=>'Aprendizagem','modeloCronograma'=>'aprendizagem','chTotal'=>22,'nota'=>'',
    'regras'=>array('hEncontro'=>8,'webDias'=>10,'webHora'=>'15h','postDias'=>3,'horario'=>'08h'),
    'configuracaoCronograma'=>array('sincrono'=>array('ativo'=>true,'modo'=>'quantidade','diasPermitidos'=>array(1,2,3,4,5),'duracaoHoras'=>2),'praticaProfissional'=>true),
    'modulos'=>array(array('id'=>'m1','nome'=>'Módulo','itens'=>array(array('id'=>'i1','tipo'=>'uc','nome'=>'UC','ch'=>22,'pres'=>0,'div'=>2,'sincronos'=>5),array('id'=>'p1','tipo'=>'pratica','nome'=>'Prática','ch'=>0,'pres'=>0,'div'=>3))))
  ))
);
$clean = Cronograma_EAD_Store::sanitize_payload($base);
c_ok(!is_wp_error($clean),'valid multimodel catalog rejected');
c_ok($clean['cursos'][0]['modeloCronograma']==='aprendizagem','model not preserved');
c_ok($clean['cursos'][0]['modulos'][0]['itens'][0]['sincronos']===5,'sync count not preserved');

$bad=$base; $bad['cursos'][0]['modeloCronograma']='inventado';
c_ok(is_wp_error(Cronograma_EAD_Store::sanitize_payload($bad)),'invalid model must be rejected');

$bad=$base; $bad['cursos'][0]['configuracaoCronograma']['sincrono']['diasPermitidos']=array(1,9);
c_ok(is_wp_error(Cronograma_EAD_Store::sanitize_payload($bad)),'invalid weekday must be rejected');

echo "OK catalog-contract: multimodel catalog validation\n";

$regional = $base;
$regional['unidades'][0]['estado']='GO';
$regional['unidades'][0]['cidade']='Goiânia';
$regional['unidades'][0]['codigoIbge']='5208707';
$regional['cursos'][0]['modalidade']='ead';
$cleanRegional = Cronograma_EAD_Store::sanitize_payload($regional);
c_ok(!is_wp_error($cleanRegional),'valid UF/modalidade rejected');
c_ok($cleanRegional['unidades'][0]['estado']==='GO','UF not preserved');
c_ok($cleanRegional['unidades'][0]['cidade']==='Goiânia','city not preserved');
c_ok($cleanRegional['unidades'][0]['codigoIbge']==='5208707','IBGE code not preserved');
c_ok($cleanRegional['cursos'][0]['modalidade']==='ead','EaD modality not preserved');

$hibrido=$regional; $hibrido['cursos'][0]['modalidade']='semipresencial';
c_ok(!is_wp_error(Cronograma_EAD_Store::sanitize_payload($hibrido)),'hybrid modality rejected');

$legado=$regional; $legado['cursos'][0]['modalidade']='presencial';
$cleanLegado=Cronograma_EAD_Store::sanitize_payload($legado);
c_ok(!is_wp_error($cleanLegado) && $cleanLegado['cursos'][0]['modalidade']==='semipresencial','legacy presencial modality must migrate to hybrid');

$badUf=$regional; $badUf['unidades'][0]['estado']='XX';
c_ok(is_wp_error(Cronograma_EAD_Store::sanitize_payload($badUf)),'invalid UF must be rejected');

$badIbge=$regional; $badIbge['unidades'][0]['codigoIbge']='123';
c_ok(is_wp_error(Cronograma_EAD_Store::sanitize_payload($badIbge)),'invalid IBGE code must be rejected');

$badCidade=$regional; $badCidade['unidades'][0]['cidade']='';
c_ok(is_wp_error(Cronograma_EAD_Store::sanitize_payload($badCidade)),'empty city must be rejected');

$badMod=$regional; $badMod['cursos'][0]['modalidade']='telepatia';
c_ok(is_wp_error(Cronograma_EAD_Store::sanitize_payload($badMod)),'invalid modality must be rejected');

echo "OK UF and modality contract\n";

$turma = array(
  'id'=>'t1','cursoId'=>'c1','nome'=>'Turma','unidadeId'=>'u1','inicio'=>'2026-03-02','evento'=>'',
  'monitorId'=>'','tutorId'=>'','coordId'=>'','profId'=>'','ambiente'=>'','itens'=>array(
    'i1'=>array('eventos'=>array(array('tipo'=>'pratica_empresa','d'=>'2026-06-01','fim'=>'2026-06-30','h'=>'08h','duracaoHoras'=>4,'titulo'=>'Prática')))
  )
);
$ct = Cronograma_EAD_Store::sanitize_turma($turma);
c_ok(!is_wp_error($ct),'valid pedagogical event rejected');
c_ok($ct['itens']['i1']['eventos'][0]['tipo']==='pratica_empresa','event type not preserved');

$bad_t=$turma; $bad_t['itens']['i1']['eventos'][0]['tipo']='evento_inventado';
c_ok(is_wp_error(Cronograma_EAD_Store::sanitize_turma($bad_t)),'unknown pedagogical event type must be rejected');
$bad_t=$turma; $bad_t['itens']['i1']['eventos'][0]['d']='2026-02-31';
c_ok(is_wp_error(Cronograma_EAD_Store::sanitize_turma($bad_t)),'invalid pedagogical event date must be rejected');

echo "OK pedagogical-event contract\n";


$turma_cfg = $turma;
$turma_cfg['personalizarCronograma'] = true;
$turma_cfg['configuracaoCronograma'] = array(
  'aprendizagem'=>array(
    'faseIntensivaDiasUteis'=>10,
    'diasIntensivos'=>array(1,2,3,4,5),
    'diasAtendimentoRegular'=>array(3),
    'horarioWebaula'=>'13:30 às 17:00'
  )
);
$ct = Cronograma_EAD_Store::sanitize_turma($turma_cfg);
c_ok(!is_wp_error($ct),'valid turma schedule override rejected');
c_ok($ct['personalizarCronograma']===true,'turma personalization flag not preserved');
c_ok($ct['configuracaoCronograma']['aprendizagem']['diasAtendimentoRegular'][0]===3,'turma aprendizagem override not preserved');

$bad_cfg = $turma_cfg;
$bad_cfg['configuracaoCronograma']['aprendizagem']['diasAtendimentoRegular']=array(8);
c_ok(is_wp_error(Cronograma_EAD_Store::sanitize_turma($bad_cfg)),'invalid turma weekday override must be rejected');

echo "OK turma schedule override contract\n";
