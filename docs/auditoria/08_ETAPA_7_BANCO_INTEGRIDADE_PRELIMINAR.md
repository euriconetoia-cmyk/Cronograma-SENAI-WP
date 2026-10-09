# Etapa 7 — Banco e integridade — inspeção inicial

Data: 09/10/2026
Branch: release/2.21.0-modelos
Estado: diagnóstico inicial, sem alterações de código.

## Evidências em class-db.php
- DB-001: tabelas turmas, versoes, log e audit usam índices explícitos. turmas tem chave primária (id), índices por unidade/status e status/prazo; versoes possui UNIQUE (turma_id,versao). Não há baseline de EXPLAIN ou cardinalidades.
- DB-002: atualizar() executa UPDATE ... WHERE id = %s AND rev = %d, com incremento da revisão e validação por rows_affected. É proteção otimista de concorrência na turma; revisar separadamente a atomicidade da atualização do catálogo.
- DB-003: excluir() apaga registro da turma e deliberadamente preserva histórico e versões. Verificar política de retenção, referências órfãs e semântica de restauração antes de mudar.
- DB-004: limpar_para_restauracao() exclui avisos, logs, versões e turmas. Sua segurança depende da transação e das validações na rotina chamadora. Necessários testes de falha e rollback.
- DB-005: restaurar_turma() recompõe status, versão e revisão, mas preenche criado_em e atualizado_em com data atual. Verificar se os requisitos do backup exigem datas de criação originais e fidelidade histórica; não afirmar perda sem comparar o contrato do formato.
- DB-006: vigentes() consulta última versão via agrupamento MAX(versao), com UNIQUE(turma_id,versao). Avaliar EXPLAIN para volume alto.
- DB-007: class-store.php usa duas opções WordPress para JSON do catálogo e revisão, com transient como trava. A verificação de revisão e as duas gravações são operações distintas; investigar corridas entre requisições e falhas parciais. Não assumir atomicidade garantida pelo transient.

## Pontos de prova necessários
1. EXPLAIN para listar, vigentes, atividade e histórico; medir linhas examinadas, índices utilizados e tempo.
2. Teste concorrente com duas sessões editando a mesma turma e o mesmo catálogo.
3. Testes de falha em cada etapa de restauração, verificando transação, rollback, tabelas e metadados.
4. Inspeção de integridade de referências entre turma, curso, unidade, usuário e versões.
5. Análise de retenção de registros órfãos e impacto no histórico/auditoria.

## Limites
Não foram executados bancos de dados, requisições reais, testes de concorrência ou migrações. Nenhum defeito operacional foi confirmado nesta etapa. Não mudar esquema até conclusão da auditoria.
