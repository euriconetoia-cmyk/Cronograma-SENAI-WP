# 04 — Plano de implementação incremental

Projeto: Cronogramas EaD — Unidigit@l / SENAI
Data: 09/10/2026
Referências: 02_ESPECIFICACAO_TECNICA_MELHORIAS.md, 03_MATRIZ_PRIORIZACAO.md e auditorias preliminares 07–09.
Estado: PLANO PROVISÓRIO. Sem implementação ou homologação nesta atualização.

## Governança
Responsável técnico, revisor e homologador: a designar em cada PR. Não presumir que os autores das auditorias aprovam mudanças de produção.
Todas as mudanças devem entrar em PR de escopo pequeno, partindo da branch release/2.21.0-modelos ou de branch de correção dedicada, e ser submetidas a revisão e testes.
A branch de release não será publicada em produção sem gate de aceitação, backup testado e plano de rollback.

## Portões obrigatórios
- G0 — baseline: registrar SHA, node/pnpm/PHP/WP, ambiente, status real de CI, artefatos de build, tempos e volumes. Não confundir inspeção estática com benchmark.
- G1 — integridade: reproduzir concorrência de catálogo, falhas de backup e restaurar base sintética com verificação de snapshots.
- G2 — priorização: reclassificar P1 provisórios com evidência, aprovar contratos canônicos e aceitar mudanças de arquitetura.
- G3 — implementação: cada pacote em PR isolado, CI verde comprovado, teste que falha antes e passa depois quando possível.
- G4 — homologação: validar fluxos funcionais, isolamento por unidade, cinco modelos, feriados regionais, WCAG pertinente, regressões e métricas antes/depois.
- G5 — distribuição: gerar ZIP versão identificada, checksum e roteiro de implantação/reversão; registrar aprovação do homologador.

## Ordem de execução proposta

| Onda | Pacote | Dependência | Intervenção | Evidência de aceite |
|---|---|---|---|---|
| 0 | Instrumentação | Nenhuma | Medições não invasivas em ambiente isolado; coletar CI | Logs, tempos e baseline |
| 1 | A (TEST-001) | Fixtures E2E | Corrigir asserção tautológica e criar caso negativo | Teste reprova vazamento simulado e aprova escopo válido |
| 2 | B (DB-007/FUN-009) | G1 | Endurecer persistência do catálogo somente se risco reproduzido | Sem perda silenciosa em duas sessões, conflitos 409 |
| 3 | C (DB-004/FUN-010) | G1 | Corrigir rollback/contrato de backup se defeito confirmado | Falhas injetadas não corrompem estado |
| 4 | D (SEC-001/002/006) | Matriz de acesso/modelo de ameaça | Ajustar capabilities e armazenamento de secrets conforme avaliação | Perfis autorizados, segredo protegido |
| 5 | E (ARC-001/002) | Contrato aprovado | Unificar regras PHP/TS e testar cinco modelos | Contratos consistentes e exportações preservadas |
| 6 | G (FUN feriados) | Fontes homologadas | Corrigir integrações e resiliência | Casos nacionais/UF/município reproduzíveis |
| 7 | F (PERF) | Baseline + gargalo comprovado | Otimizações seletivas; não reestruturar sem ganho demonstrado | Antes/depois sem regressão |
| 8 | H (UX) | Critérios WCAG e protótipo | Melhorias sem descaracterizar fluxo institucional | Teclado, contraste, responsividade, leitor de tela |
| 9 | Release candidate | G0–G4 | Package, regressão, documentação e reversão | G5 aprovado |

## Regras de cada tarefa
1. Referenciar ID da matriz e causa demonstrada.
2. Criar cenário mínimo reprodutível, preferencialmente teste de regressão.
3. Alterar o menor conjunto de arquivos possível.
4. Rodar lint/typecheck/contratos e testes relacionados, além de CI completo antes de merge.
5. Comparar funcionamento e dados antes/depois.
6. Documentar risco, migração (se aplicável), rollback e evidência.
7. Não marcar 'concluído' sem saída real de testes.

## Riscos e medidas
- Corrida de catálogo: não alterar estrutura de persistência sem simulação de escrita simultânea e falhas parciais.
- Backup: nunca executar E2E destrutivo contra produção; usar WordPress e banco descartáveis.
- Feriados: nunca declarar todos os estados homologados sem fonte e evidência por UF.
- Bundling: o app WP é IIFE único; validar carregamento real antes de propor divisão de chunks.
- Modelo de cronograma: os cinco modelos devem manter geração/exportação estáveis.
- Segurança: não imprimir secrets nos logs de build ou auditoria.

## Critério de conclusão geral
Todos os P0/P1 confirmados resolvidos ou formalmente aceitos com justificativa; gates e testes executados; revisão de acessibilidade e segurança; rollback exercitado; nova versão com pacote e hash verificáveis.

## Próximo passo concreto
Executar G0 em runner/ambiente acessível e complementar relatórios com números reais. Em paralelo, preparar caso negativo para TEST-001 sem executar testes destrutivos em produção.
