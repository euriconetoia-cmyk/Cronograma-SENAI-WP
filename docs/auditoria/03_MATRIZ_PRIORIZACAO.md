# 03 — Matriz de priorização P0–P3 (provisória)

Projeto: Cronogramas EaD — Unidigit@l / SENAI
Data: 09/10/2026
Branch de auditoria: release/2.21.0-modelos

## Regras de classificação
P0: exploração crítica ou perda concreta de dados, com evidência.
P1: risco relevante de integridade/segurança, falha funcional grave ou fragilidade de teste que impede comprovação da proteção necessária.
P2: degradação potencial, arquitetura, UX, resiliência e otimização sem gravidade confirmada.
P3: ajustes de polimento e melhorias opcionais.

**IMPORTANTE:** Esta é a matriz inicial de TRIAGEM, não a matriz definitiva. Severidade proposta não é prova de defeito operacional. Não existem incidentes P0 confirmados nas evidências disponíveis. As etapas 6, 7 e 8 ainda exigem execução de testes e medições.

| Ordem | ID | Prioridade provisória | Evidência e impacto possível | Confirmação | Validação para decisão |
|---|---|---|---|---|---|
| 1 | DB-007 | P1 provisório | Revisão do catálogo e payload persistidos em opções distintas; transient de lock não garante exclusão mútua atômica entre requests | Risco estrutural demonstrado; falha ainda não reproduzida | Duas gravações simultâneas, crash entre updates, restauração e integridade |
| 2 | DB-004 | P1 a confirmar | Limpeza de registros durante restauração depende de transação e tratamento de erro da camada chamadora | Dependência de fluxo identificada; falha não confirmada | Falhas injetadas em restauração e rollback completo |
| 3 | TEST-001 | P1 para confiabilidade do gate | Assert de atividade inclui `|| true` e não verifica a propriedade | Defeito do TESTE confirmado; nenhuma falha de autorização da aplicação demonstrada | Remover tautologia em etapa de implementação, fortalecer fixture e reproduzir teste capaz de falhar |
| 4 | SEC-001 | P1 a confirmar | Configuração de API municipal utiliza permissão de catálogo, não permissão específica de configuração | Achado herdado da auditoria anterior | Matriz por perfil e teste de autorização |
| 5 | SEC-002 / SEC-006 | P1 a confirmar | Chave municipal em opção do WordPress; backup sem confidencialidade específica | Arquitetura registrada no documento de continuidade | Modelo de ameaça, proteção de chaves e cópias |
| 6 | ARC-001/002 | P1 a confirmar | Divergência entre regras UNIT_ITEM PHP e TS identificada na auditoria anterior | Divergência do contrato descrita no documento-base | Teste contratual e casos de edição por unidade |
| 7 | FUN-004 | P1 a confirmar | Cobertura estadual/municipal ainda sem homologação completa | Lacuna de evidência documentada | Casos por UF/município, fontes e datas oficiais |
| 8 | FUN-009 | P1 a confirmar | Concorrência de catálogo sem prova de integridade | Lacuna de teste | Dois editores e revisão otimista |
| 9 | FUN-010 | P1 a confirmar | Backup grande/corrompido não homologado | Lacuna de teste | Limites, checksum, rollback |
| 10 | DB-003 / DB-005 | P2 | Exclusão mantém versões e log; restore recompõe timestamps | Comportamento de código observado, adequação depende do contrato | Política de retenção e fidelidade temporal |
| 11 | PERF-001/002/006 | P2 | Bootstrap completo e bundle único | Código confirmado; lentidão não medida | Tamanho transferido, timings, EXPLAIN, p50/p95 |
| 12 | PERF-003/004/005 | P2 | Clonagens e comparações React, refetch de atividade e polling | Comportamento de código observado, impacto não medido | React Profiler, Network e testes com carga |
| 13 | PERF-008/010 | P2 | Sincronização no bootstrap com cache de 12h; atividade com consultas por turma distinta | Caminho de código confirmado; custo não medido | Cache frio/quente e contagem SQL |
| 14 | PERF-007/009/011/012 | P2 | JSON de 2MB, consulta das versões, política de cache cliente e build WP | Limites/padrões de código observados | Medições e compatibilidade WordPress |
| 15 | SEC-003/004/005/007/008 | P1–P2 a confirmar | CSP, 2FA, brute force, headers e dependências | Dependências de infraestrutura e lacunas de auditoria | Testes de configuração, WAF e dependências |
| 16 | FUN-001/002/003/005/006/007/008 | P2 | Dashboard regional, fallback IBGE, health check, cinco modelos, SMTP, erros e sessão | Testes parciais / homologação pendente | Casos de uso e ambiente real controlado |
| 17 | UX-001 | P2 | Calendário depende de cores sem identificação textual suficiente | Problema registrado na auditoria anterior | WCAG 2.2 AA, leitura por teclado e leitor de tela |
| 18 | ARC-003/004/005 | P2 | Service extenso, catálogo híbrido, store concentrada | Dívida arquitetural registrada | Testes de regressão e perfilamento antes da refatoração |
| 19 | UX-POLIMENTO | P3 | Melhorias cosméticas que não afetem operação ou acessibilidade | A selecionar depois de homologação | Revisão de design system |

## Bloqueios e critérios de passagem
- Antes de executar mudanças: concluir baseline de performance, inspeção SQL e teste em staging com evidência; revisar os itens P1 a confirmar.
- Antes de tocar o fluxo de catálogo e backup: snapshot validado, ambiente isolado, casos negativos, plano de rollback e testes de integridade.
- Antes de release: garantir testes de segurança/concorrência, migração e rollback se houver mudança de persistência, revisão por perfil/unidade, contrato dos cinco modelos, fluxos de feriados e WCAG pertinentes.
- Prioridades devem ser reclassificadas com base em probabilidade, consequência e evidência, sem transformar hipótese em defeito confirmado.

## Próximo documento
02_ESPECIFICACAO_TECNICA_MELHORIAS.md: traduzir itens confirmados em critérios de aceite objetivos; hipóteses continuam condicionadas a testes.
