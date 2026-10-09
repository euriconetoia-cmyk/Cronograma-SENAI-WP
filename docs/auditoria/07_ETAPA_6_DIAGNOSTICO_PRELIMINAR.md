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
