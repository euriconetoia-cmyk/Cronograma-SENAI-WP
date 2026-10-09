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
