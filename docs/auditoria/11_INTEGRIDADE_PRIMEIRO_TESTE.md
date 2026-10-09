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
