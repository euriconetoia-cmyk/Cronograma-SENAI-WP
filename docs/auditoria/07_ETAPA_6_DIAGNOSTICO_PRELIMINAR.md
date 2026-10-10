# Etapa 6: Performance e otimização. Diagnóstico preliminar

Data: 2026-10-09
Repositório: euriconetoia-cmyk/Cronograma-SENAI-WP
Branch: release/2.21.0-modelos
Estado: EM ANDAMENTO. Sem alterações no código de produção.

## Escopo e método
Leitura estática inicial de ui/package.json, ui/vite.wp.config.ts, ui/src/lib/store.tsx, ui/src/pages/Inicio.tsx e includes/class-service.php, class-db.php e class-store.php do plugin. As observações abaixo são evidências de código, não resultados de benchmark ou homologação no WordPress.

## Evidências verificadas
- PERF-001: class-service.php, bootstrap(): carrega catálogo via Store::get(), lista turmas via DB::listar(), consulta versões vigentes via DB::vigentes() e serializa as turmas. O custo depende dos volumes reais. Investigar tamanho e tempo de resposta por perfil.
- PERF-002: class-db.php, listar(): SELECT * das turmas, com filtro por unidade quando aplicável; não há paginação nessa operação. Há índices de unidade, status e suas combinações. Medir EXPLAIN e payload antes de propor paginação ou novos índices.
- PERF-003: ui/src/lib/store.tsx, update(): clonagem via JSON.parse(JSON.stringify()), comparações por JSON.stringify e buscas find() em arrays de turmas. Custo potencial cresce com a quantidade de registros e frequência de edição. Medir React Profiler com datasets representativos.
- PERF-004: ui/src/pages/Inicio.tsx: requisição api.atividade() no efeito dependente de d.turmas; alterações das turmas podem disparar nova requisição. Separadamente, o dashboard usa vários filters sobre a coleção por unidade/status. Confirmar frequência real e custo em dados volumosos.
- PERF-005: ui/src/lib/store.tsx: avisos consultados ao entrar, a cada 60 segundos se a página estiver visível, e ao recuperar visibilidade. Medir chamadas concorrentes por usuário e impacto no servidor.
- PERF-006: ui/vite.wp.config.ts: build WordPress em arquivo app.js IIFE, com inlineDynamicImports=true, cssCodeSplit=false e chunkSizeWarningLimit=6000. Não há split de chunks nesse alvo. Medir tamanho transferido, parse, execução e cache antes de recomendar alteração.
- PERF-007: class-store.php: catálogo salvo como JSON com MAX_BYTES=2097152; save() serializa a estrutura e usa transient de 10 segundos como lock. Medir latência e concorrência; testes de falhas e atualização concorrente pertencem também às Etapas 7 e 8.
- PERF-008: class-service.php, bootstrap(): chama sincronizar_feriados_automaticos() para perfil equipe antes de montar a resposta. Avaliar possibilidade de I/O externo, frequência e cache por instrumentação.
- PERF-009: class-db.php: consulta de vigentes agrega versões por turma usando MAX(versao), com chave única (turma_id,versao). Medir custo com histórico extenso.

## Pendências obrigatórias da Etapa 6
1. Coletar baseline de build: bytes brutos/gzip/brotli, dependências de maior peso e tempo de inicialização.
2. Medir API REST: número de solicitações no login e navegação, p50/p95 e tamanho do bootstrap para equipe e unidade.
3. Testar 10, 100, 500 e 1000 turmas ou cargas compatíveis com a realidade, usando dados sintéticos isolados, com tamanho de catálogo conhecido.
4. Inspecionar SQL por EXPLAIN, especialmente listar turmas, vigentes, histórico e avisos; não acessar dados pessoais de produção para testes.
5. Medir comportamento de avisos e atividade com múltiplas sessões; confirmar invalidação, debounce e cache.
6. Testar edição de cronograma longo, digitação, tabela extensa, visualização mobile, CPU limitada e 200%/400% zoom.
7. Medir sincronização regional de feriados quando API externa responde, falha ou sofre timeout.
8. Registrar evidência, ambiente, reprodução, impacto e recomendação para cada achado; priorizar somente depois de concluir também Banco e Testes.

## Critérios para encerramento
Etapa 6 somente concluída com baseline reproduzível, testes de carga e interface, resultados por cenário, gargalos comprovados, recomendações e riscos de regressão documentados.

## Restrições
Não refatorar ou alterar comportamento antes das etapas 7, 8, matriz P0-P3 e plano de implementação; não inventar metas de desempenho. Este arquivo é um registro intermediário, não homologação e não release.


## Segunda rodada de auditoria estática (09/10/2026)

Arquivos adicionais inspecionados: ui/src/lib/api.ts, ui/vite.config.ts, ui/vite.single.config.ts; class-service.php nas regiões de atividade e sincronização de feriados.

### Detalhamento de evidências

**PERF-004: invalidação de atividade.** Em ui/src/pages/Inicio.tsx, o efeito que consulta api.atividade() depende de `[api, d.turmas]`. Em ui/src/lib/store.tsx, operações de edição substituem a coleção por um novo objeto. Existe, portanto, um caminho verificável para refetch de atividade após mudanças locais, mesmo sem alteração relevante no histórico. Diagnóstico de redundância potencial, ainda sem quantificação de chamadas.

**PERF-008: frequência e falhas da sincronização.** Em class-service.php, sincronizar_feriados_automaticos() verifica o transient cronograma_ead_auto_feriados_ok. Se ausente, consulta os anos atual e seguinte, e marca o transient por 12 horas. A operação pode ser executada no bootstrap da equipe após expiração do cache. Ponto de atenção adicional: o transient de sucesso é definido ao final mesmo se consultas externas falharem; investigar impacto no frescor dos feriados. Não confundir cache de 12 horas da sincronização com os caches das consultas individuais.

**PERF-010: atividade e consultas adicionais.** class-service.php::atividade() consulta até 80 entradas de log por DB::atividade(80) e, para cada turma distinta, consulta DB::get(turma_id) uma vez, guardando o resultado num cache local. O limite superior teórico dessa rotina é uma consulta do log e até 80 consultas por turma distinta, antes de considerar outras consultas de autenticação; o total real pode ser menor. Medir contagens SQL antes de otimizar. Não há cache persistente de autorização nessa função.

**PERF-011: visibilidade e política de cache HTTP.** ui/src/lib/api.ts usa fetch de mesma origem e nonce, com mensagens de erro de rede e sessão expirada; nesta camada não há cache explícito, deduplicação ou cancelamento de solicitações. Isso, isoladamente, não prova ausência de caching no WordPress ou na infraestrutura.

**PERF-012: variantes de build.** O build Vite padrão e o build WordPress são configurações distintas. A configuração do WordPress desabilita divisão de CSS e usa inlineDynamicImports para entregar app.js em IIFE único. Qualquer sugestão de lazy loading precisa primeiro verificar a compatibilidade do carregamento WordPress e dos scripts existentes.

### Roteiro de medição reproduzível

| Cenário | Instrumentação | Evidência mínima |
|---|---|---|
| Primeiro acesso equipe | Browser DevTools Network e PHP timings | Requests, payload bootstrap, duração e percentis de várias execuções |
| Primeiro acesso unidade | Mesma instrumentação, com perfil restrito | Payload e duração por escopo, sem vazamento de dados |
| Atividade após edição | Network + trilha de eventos | Número de GET atividade por ação; separar edição local de salvamento |
| 80 logs com turmas distintas | Query Monitor ou SAVEQUERIES controlado | SQL count e duração de DB::get por turma |
| Feriados com cache válido | Logs temporários de duração + Network | Tempo de bootstrap, chamadas externas |
| Feriados com cache expirado | Ambiente isolado, falha simulada da API | Tempo, erro, intervalo até nova tentativa e persistência de cache |
| Build WordPress | pnpm build:wp + contagem gzip/brotli | Peso do app.js e seu tempo de parse/execução |
| 10/100/500/1000 turmas sintéticas | Browser Profiler, medição REST e EXPLAIN | Tempo, memória, renderizações e custo SQL |

Não registrar p50/p95 ou limites de aceitação até coletar amostras reais e definir o ambiente. Para testes de API e escrita, usar staging e dados sintéticos.

### Hipóteses a validar na próxima coleta
1. Reduzir refetch de atividade sem apresentar histórico desatualizado.
2. Evitar consulta N+1 de atividade preservando filtros e autorização por unidade.
3. Separar sincronização de feriados do caminho crítico do bootstrap, com tratamento de falhas e atualização segura, somente se medição justificar.
4. Examinar estratégias de cache/paginação e custo de clonagem React, verificando compatibilidade com o fluxo de revisões e a experiência de edição.

### Estado atualizado
A auditoria estática evoluiu. Não foram realizados benchmarks, testes SQL EXPLAIN, perfis React, builds locais ou testes funcionais em WordPress. A Etapa 6 permanece ABERTA; não há aprovação para refatorar ou publicar release.
