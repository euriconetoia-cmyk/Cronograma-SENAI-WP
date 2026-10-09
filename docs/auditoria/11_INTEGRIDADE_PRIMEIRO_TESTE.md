# Integridade: revisão do fluxo de persistência e primeiro teste executável

Data: 09/10/2026
Branch: release/2.21.0-modelos

## Evidência estática verificada
1. `Cronograma_EAD_Store::save()`: usa transient de 10 segundos como sinal de bloqueio, confere revisão com `get_option`, persiste o JSON do catálogo e depois a revisão via duas chamadas `update_option`. Não verifica os retornos dessas chamadas. **Risco:** atualização parcial e interleaving de gravadores; requer reprodução em WordPress.
2. `Cronograma_EAD_Service::importar()`: grava cópia pré-importação e chama `Cronograma_EAD_DB::begin()` sem verificar se a transação começou. Depois persiste catálogo e atualiza as tabelas SQL. Em falhas de limpeza ou inserção chama `rollback()` e `restore_snapshot()`. Há mecanismo de compensação, mas a atomicidade integral entre opções e tabelas não foi demonstrada.
3. `Cronograma_EAD_DB::begin/commit/rollback()`: executa START TRANSACTION, COMMIT e ROLLBACK via wpdb. O comportamento real depende do engine/infraestrutura e falhas de execução.
4. O E2E existente exercita simulação de backup, restauração completa e verificação de estado, mas não injeta erro em cada ponto nem simula gravadores simultâneos.

## Incremento implementado
- `tests/catalog-integrity.php`: teste isolado com opções/transients simulados; cobre primeira gravação, conflito de revisão obsoleta, segunda gravação e leitura consistente. **Não representa teste concorrente nem WordPress real.**
- `tests/release-gate.sh`: inclui o novo contrato antes do build/WordPress E2E.
- Commits: `577c6038`, `3b2f4c4`.

## Pendências para encerramento da Etapa 7
- Ver resultado do novo CI e corrigir quaisquer problemas reais do teste isolado.
- Adicionar testes com duas sessões simultâneas no WordPress descartável.
- Fazer injeção controlada de falha em update_option/limpeza/insert/commit; conferir estado final e rollback.
- Examinar referências, índices EXPLAIN e volumes no banco.
- Definir correção de persistência só após decidir o contrato de atomicidade, proteção contra escrita simultânea e estratégia de migração.

Estado: **Etapa 7 em andamento; testes destrutivos e concorrência ainda não executados.**


## Ampliação de teste — concorrência REST

- Commit `ff83045c92c5b2a281f12fcacc3050d821ea9306` acrescenta ao `tests/e2e.mjs` um ensaio de duas chamadas `POST catalogo` simultâneas, partindo da mesma revisão, usando o banco WordPress descartável do CI.
- Critérios: exatamente uma operação HTTP 200; a outra deve ser rejeitada com HTTP 409 (revisão) ou 503 (bloqueio); a revisão final deve subir apenas uma unidade; o catálogo final deve corresponder à escrita aceita.
- Limites: duas requisições em `Promise.all` não garantem colisão no instante crítico. Testes repetidos/controle de barreira, falhas de update_option e rollback continuam pendentes. Nenhum resultado desta ampliação foi constatado no momento da escrita.
- CI #194: `release-gate` aprovado na inspeção de passos; processo de empacotamento ainda em progresso naquela consulta. URL https://github.com/euriconetoia-cmyk/Cronograma-SENAI-WP/actions/runs/37971117930.


## Resultados e extensão — 09/10/2026

- CI #198 executado e concluído com **SUCCESS** (GitHub Actions run ID 37971384534). O release-gate, o empacotamento e upload de evidências passaram. Link: https://github.com/euriconetoia-cmyk/Cronograma-SENAI-WP/actions/runs/37971384534.
- O ensaio REST de duas gravações concorrentes foi incluído no gate aprovado. Resultado é limitado ao cenário e à repetição do runner, não constitui prova de serialização sob carga sustentada.
- Commit `2b5f8ad85da5e514c82204472601e5010989a504`: cenário negativo de restauração por token inválido. Verifica HTTP 409 e igualdade de catálogo, revisão e turmas antes/depois. **Novo cenário ainda não possui CI aprovado nesta atualização.**
- Permanecem bloqueados para aprovação final: falha de banco após escrita parcial; rollback com falha de transação; concorrência com barreiras, retries e cargas; verificação de histórico e versões durante restauração; EXPLAIN e baseline.


## Correção incremental: transação de importação — 09/10/2026
- CI #202 (https://github.com/euriconetoia-cmyk/Cronograma-SENAI-WP/actions/runs/37978404973) aprovado integralmente, incluindo o cenário de confirmação inválida do backup; PHPCS, PHPStan, release-gate e empacotamento concluídos com sucesso.
- Identificação: `Cronograma_EAD_Service::importar()` executava `Cronograma_EAD_DB::begin()` sem inspecionar retorno; se START TRANSACTION falhasse, haveria risco de continuar a escrita sem garantia transacional.
- Correção `a10e4fdbca3c627d77bc080575bfbfd76461ef70`: abortar a operação com HTTP 500 e mensagem de erro antes de alterar o catálogo caso o início da transação falhe.
- **Pendente:** verificar CI do commit de correção e desenvolver injeção efetiva de falha de START TRANSACTION e de erros intermediários de DB/opções. Esta alteração não prova que restauração inteira é atômica em todos os modos.


## Teste adicional: adulteração de backup e checksum
- Commit `b74e92796fb9998b53fa19a9f2d11b02d6a0bd28` adiciona ao E2E a alteração sintética do nome de um curso **após** a exportação, sem recalcular o checksum. Simulação de importação deve responder HTTP 422 com erro de checksum; catálogo, revisão e turmas devem permanecer idênticos.
- Fluxo validado estaticamente: `preparar_importacao()` calcula o checksum normalizado e o compara antes de efetuar a importação; o novo teste amplia a verificação de comportamento no ambiente WordPress descartável.
- CI #230: https://github.com/euriconetoia-cmyk/Cronograma-SENAI-WP/actions/runs/38003473675 — estava em fila na consulta. CI #222 e #226 ainda em andamento. Não há aprovação confirmada deste novo teste.
- Pendência prioritária: simular falhas transacionais intermediárias; validar atomicidade de options e dados SQL; registrar métricas de volume e tempo. Sem mudança em produção.


## Correção prioritária: restauração com revisão obsoleta — 09/10/2026
- GitHub CI #222, #226 e #230: todos os jobs `release-gate` concluídos com **SUCCESS**, confirmados na API de jobs. Incluem revisão de interface, ciclo da credencial sintética e rejeição de backup adulterado.
- Código inspecionado: antes da correção, `Cronograma_EAD_Service::importar()` usava a revisão corrente do servidor ao restaurar um backup `full-state`, ignorando `body.rev`. Isso poderia sobrescrever mudanças posteriores à simulação do operador.
- Correção `53da3708b015f2de6f067a68b3a24f86f8796a2a`: conferir `body.rev` contra revisão atual **antes** de criar backup pré-importação e começar transação; retornar conflito 409 caso divergente. Todas as modalidades passam a usar a revisão enviada no `Store::save`.
- Teste `96815212f64e015cd6cb00b62a800bdcc1c0b693`: tentativa de restauração `full-state` com revisão obsoleta exige 409 e nenhuma alteração de turmas, catálogo ou revisão no WordPress descartável.
- **Pendente:** aprovação do novo CI, teste de alteração concorrente no intervalo entre verificação e escrita, e injeção de falhas de transação/rollback.


## Proteção do histórico na restauração — 09/10/2026
- CI #236: job release-gate concluído com **SUCCESS**, confirmando o cenário de rejeição de revisão obsoleta.
- Achado: o retorno de `Cronograma_EAD_DB::salvar_versao()` durante `fullRestore` não era verificado. Uma falha de INSERT de histórico podia resultar em importação considerada bem-sucedida sem a versão esperada.
- Correção `c383297fe413305fed785cad90a837e308ce18bc`: se salvar o snapshot de versão falhar, efetuar rollback SQL, restaurar catálogo anterior e retornar erro 500.
- Contrato estático `ca3a37aea0cf7d39311f299ec99248fa89802d00`: exige verificar o retorno de `salvar_versao()` e presença de tratamento explícito.
- **Pendente:** CI dos commits; teste injetando falha de INSERT na tabela de versões, testes de restauração com múltiplas versões e prova de rollback sob diferentes engines SQL.


## Verificação de snapshot após recuperação — 09/10/2026
- Commit `1d19e027e5e1988e0aacd0fcf7ee0b2d2db5c35b`: acrescentado teste E2E que, depois de uma restauração full-state, consulta por REST a versão vigente que existia no backup e exige resposta HTTP 200.
- Esse cenário aumenta a cobertura de acessibilidade do histórico restaurado, mas **não** injeta falha de INSERT nem verifica rollback transacional sob erro de banco.
- CI #242 ainda em andamento na consulta precedente; aguardar nova execução ligada ao commit e inspecionar resultado.


## Contratos de restauração estendidos
- Commit `1e66bf91728003c95d9edf55694243aaaeaf4fe6`: testes E2E verificam que full-state restaura `rev`, `cursoId` e `unidadeId` de uma turma conforme o backup e que a revisão global do catálogo sobe exatamente uma unidade após restauração bem-sucedida.
- CI #242 e CI #246 permaneciam `in_progress` na última consulta e não foram classificados como aprovados nesta rodada. Novo commit requer CI independente.
- Limites: verificação de invariantes em caminho feliz; rollback após falha injetada e manutenção integral do log histórico permanecem pendentes.


## Verificação reforçada de snapshot de versão
- CI #242 e #246: **SUCCESS** verificados na API de jobs do GitHub Actions (09/10/2026). CI #250 ainda estava em execução na consulta.
- Commit `20a887e698fb87e069a84982b4e32159e9e2d7f7` reforça teste E2E após restauração: a versão consultada deve manter o número de versão vigente e um snapshot contendo turma, curso e unidade com os IDs originais. Evita falso positivo por apenas receber HTTP 200.
- Ainda não implementada injeção de erro SQL na tabela de versões nem teste destrutivo de rollback. Estes devem acontecer somente em banco de CI descartável.


## Ensaio de falha SQL controlada — 09/10/2026
- Novo teste `tests/restore-rollback.php`, commit `054772f08f3cd94bc13774c47287641309c5d44a`, protegido por verificação de WP-CLI e domínio local (`127.0.0.1`/`localhost`). Executa simulação com backup full-state, injeta SQL inválido somente no INSERT da tabela `ce_versoes`, exige erro de restauração e confere preservação do catálogo/revisão e tabelas `turmas`, `versoes`, `log` e `avisos`.
- O teste é executado depois dos E2E em WordPress descartável pelo `tests/release-gate.sh` (commit `c4ffe59dbd10d9b65d7f3fccc8d2f533f0388340`).
- **Pendente:** verificação pelo CI deste novo teste. Não foi executado localmente nesta rodada. Ainda são necessários ensaios de falha na limpeza, início/commit de transação e gravações de opções, com medições de recuperação.
- O CI #250 e #254 estavam `in_progress` no último acesso, sem conclusão confirmada; os resultados dos checks desses commits devem ser avaliados separadamente.


## Ensaio adicional: falha ao iniciar transação
- Commit `761e9de221443959c519f280a086f013dece4448`: ampliado `tests/restore-rollback.php` com injeção de erro SQL em `START TRANSACTION`. Critérios: importação devolve `WP_Error` código `transacao`, SQL inválido atingiu o ponto desejado e catálogo + tabelas não mudaram.
- O teste ocorre exclusivamente no WordPress descartável do Release Gate e não substitui avaliação de atomicidade sob concorrência real.
- CI #260 permanecia em progresso no último check; novo teste depende de nova execução após o commit. Pendentes falha no COMMIT, update_option parcial e homologação de múltiplos perfis.


## Ensaio adicional: falha no COMMIT (09/10/2026)
- Commit `d55b60f0cd9c5cce5814549f213405b35993532b`: estendido o teste isolado `tests/restore-rollback.php` para injetar SQL inválido em `COMMIT`, exigir erro de importação, confirmar que o gancho atingiu o comando e comparar catálogo e tabelas (`turmas`, `versoes`, `log`, `avisos`) com o estado anterior.
- Este cenário **ainda não foi aprovado pelo CI**. O teste depende do banco descartável; não usar em staging ou produção.
- CI #260 e #264 continuavam `in_progress` após a consulta. Não concluir a etapa de integridade antes da aprovação de cenário de histórico, START TRANSACTION e COMMIT.
