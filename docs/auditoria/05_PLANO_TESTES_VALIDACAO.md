# 05 — Plano de testes e validação

Projeto: Cronogramas EaD — Unidigit@l / SENAI
Data: 09/10/2026
Estado: plano. Nenhum dos cenários abaixo é declarado aprovado por este documento.

## Regra de evidência
Para cada cenário registrar: ID, SHA, ambiente (sem credenciais), dataset, procedimento, resultado esperado, resultado observado, duração, logs sanitizados, executor e data. PASS apenas com evidência; caso contrário NÃO EXECUTADO/BLOQUEADO/FALHOU.

## Matriz
| ID | Área | Cenário e expectativa | Ambiente |
|---|---|---|---|
| T-001 | Build | pnpm install, typecheck, build:wp; pacote reproduzível | Runner isolado |
| T-002 | PHP | php -l, PHPCS, PHPStan | Runner isolado |
| T-003 | Contratos | calendar, catalog, perfis e cinco modelos | Runner isolado |
| T-004 | Segurança estática | checks existentes e dependências atualizadas | Runner isolado |
| T-005 | E2E | Fluxo completo solicitado→validado→reaberto; versões e histórico | WordPress descartável |
| T-006 | Autorização | perfis equipe/unidade/consulta; acesso cruzado sempre bloqueado | WordPress descartável |
| T-007 | Atividade | Teste corrigido falha diante de item não autorizado e aprova retorno correto | WordPress descartável |
| T-008 | Concorrência turma | Duas edições com mesma rev: uma persiste, outra recebe 409 | WordPress descartável |
| T-009 | Concorrência catálogo | Duas edições de curso/feriados/unidade não geram perda silenciosa | WordPress descartável |
| T-010 | Backup | Exportação checksum, simulação, restauração e consistência pós-rollback | Banco descartável |
| T-011 | Backup negativo | Arquivo inválido/corrompido/grande e falhas intermediárias | Banco descartável |
| T-012 | Feriados | Nacional/estadual/municipal por fonte e localidade, cache frio/quente | Staging |
| T-013 | Integração | API externa offline, timeout, resposta inválida, revalidação IBGE | Staging |
| T-014 | Sessão | Expiração durante edição, dados não desaparecem silenciosamente | Staging |
| T-015 | Performance | p50/p95 e tamanho de bootstrap para equipe/unidade | Staging |
| T-016 | SQL | EXPLAIN + consultas por operação com volume representativo | Banco sintético |
| T-017 | React | Profiler de edições, filtros e cronogramas longos | Browser automatizado |
| T-018 | Mobile | Larguras móveis, teclado e zoom 200%/400% | Browser |
| T-019 | WCAG | Contraste, foco, teclado, nomes acessíveis, tipos textuais de feriados | Browser e revisão humana |
| T-020 | Exportação | Cinco modelos e formatos existentes sem alteração de conteúdo | Staging |
| T-021 | Deploy | ZIP íntegro e procedimento de rollback restaurado com sucesso | Staging |

## Comandos de referência (na raiz do repositório)
- `bash tests/php-syntax.sh`
- `cd ui && pnpm install --frozen-lockfile && pnpm typecheck && pnpm build:wp`
- `node tests/calendar-contract.mjs`
- `php tests/catalog-contract.php`
- `bash tests/release-gate.sh` apenas em ambiente configurado para seus efeitos.
- Revisar CI de .github/workflows/ci.yml e test-package.yml pelo SHA e anexar resultados reais.

## Precauções
O arquivo tests/e2e.mjs cria e altera turmas, salva catálogo e executa restauração. Nunca rodar em produção. Dados de teste exclusivamente sintéticos. Não divulgar senhas, cookies, nonces, dados pessoais ou secrets. Executar T-011 com snapshot comprovadamente restaurável.

## Status inicial
T-001 a T-021: NÃO EXECUTADO NESTA CONTINUIDADE.


## Evidência real de CI — rodada 09/10/2026

Branch SHA: `18b223b16f3c3daa7dd97ba452300abd548eeefd`.
Execução do workflow CI #172: https://github.com/euriconetoia-cmyk/Cronograma-SENAI-WP/actions/runs/37969376473
Job release-gate: 113951775650. Resultado: **failure**.

Resultados confirmados no log:
- Instalação de Composer e dependências PHP: SUCCESS.
- PHPCS: SUCCESS.
- PHPStan: SUCCESS.
- Dentro do release gate: `pnpm lint` concluiu com 0 erros e 21 avisos.
- Dentro do release gate: `pnpm typecheck` FALHOU com exit code 2.
- `ui/src/lib/mock.ts:70:14`: objeto mockApi não implementa `municipios`, `feriadosLocal`, `feriadosConfig` e `salvarFeriadosConfig`, exigidos pelo tipo Api.
- `ui/src/pages/Cronograma.tsx:293:124` e `:293:138`: TS18048, `a.ref` possivelmente indefinido.
- Empacotamento e passos seguintes do release gate: NÃO ALCANÇADOS; não marcar como aprovados.

**Status revisado**:
- T-001: FALHOU parcialmente. Instalação e lint passaram; typecheck falhou; build WP não foi alcançado neste job.
- T-002: PARCIAL. PHPCS/PHPStan passaram, mas PHP syntax separado não está demonstrado pelo registro aqui.
- T-003 a T-021: sem aprovação demonstrada por este job; conferir execuções próprias antes de alterar estado.

**Próxima ação de correção:** abrir alteração isolada para alinhar API mock e tratar a.ref com guarda/narrowing seguro; reexecutar CI. Não usar non-null assertion sem provar invariantes. Os 21 avisos de lint devem ser catalogados separadamente, sem confundir com erros de compilação.


## Seguimento CI — execução #178 (09/10/2026)
- SHA testado: `6d38128ef84e9d07b988056889505210bc42d257`
- GitHub Actions: https://github.com/euriconetoia-cmyk/Cronograma-SENAI-WP/actions/runs/37969783329
- Resultado: **FALHOU**, agora durante E2E. PHPCS, PHPStan e fases anteriores do release gate foram superadas; erros anteriores de TypeScript não reapareceram.
- Erro fatal: `tests/e2e.mjs:24` acessa `turmas[0].cursoId` quando o bootstrap da instalação recém-configurada traz zero turmas. Trata-se de pré-condição inválida no teste, não prova de defeito na criação de turmas.
- Falha adicional reportada pelo teste: `página do cronograma pede login`. Hipótese de divergência de texto/status da página anônima; **permanece sem resolução e não deve ser ignorada**.
- Commit `0009a377e1cce3a774adab5a506f6dc03bfd774e`: teste passou a escolher o curso no catálogo do bootstrap, com pré-condição explícita; removida a tautologia `||true` da autorização da atividade e substituída por checagem de turma permitida. Não altera código de produção.
- Nova execução do CI e investigação da página anônima: PENDENTES. A correção não implica homologação nem gate aprovado.


## Resultado confirmado — CI #188 (09/10/2026)
- SHA de execução: `8b1109f15b0522fcca25fc75e2383eca13623e8d`.
- URL: https://github.com/euriconetoia-cmyk/Cronograma-SENAI-WP/actions/runs/37970606486
- Job `release-gate`: **SUCCESS**. Etapas de instalação, PHPCS, PHPStan, `tests/release-gate.sh`, empacotamento e upload de artefatos: **SUCCESS** segundo resumo de jobs da API GitHub.
- Artefatos publicados: `cronograma-ead-2.21.0-rc1` (ID 11636096411) e `validation-evidence` (ID 11635152999). Não houve inspeção de conteúdo ou teste de implantação desses artefatos nesta atualização.
- **Escopo da aprovação:** testes efetivamente executados pelo release gate e checks do pipeline, na revisão específica. Não comprova concorrência de catálogo, rollback sob falha injetada, cenários de escala/performance ou homologação institucional completa.
- Estado: bloqueio de CI da etapa inicial resolvido; iniciar ensaios direcionados à integridade (T-009, T-010 e T-011), mantendo staging e banco descartável.


## Continuidade de homologação — 09/10/2026
- CI #306: passo `Execute full release gate` concluiu com sucesso, abrangendo o ensaio automatizado de falhas de transação e rollback. No momento consultado, ainda havia etapas de empacotamento em execução; não declarar release distribuído.
- Teste `tests/modelos-cronograma.mjs` ampliado no commit `0ea8e63ee2bec6adf4a3c86ada600c81811c657d` para incluir explicitamente o quinto modelo, **Personalizado**, além de Técnico, Qualificação, Distribuição Diária e Aprendizagem.
- A suíte ainda depende de CI do novo commit; cobertura matemática/contratual não equivale à homologação visual, de exportação ou dos casos reais de todas as unidades.
- Testes T-012 a T-021 exigem dados representativos e/ou validação em staging; permanecem abertos. Não executar operação destrutiva em produção.


## Cobertura de dias úteis com implementação real
- CI #328 concluído com `success`, incluindo release gate e empacotamento; permanecem pendentes validações manuais e desempenho.
- Commits `6882c9d88ae19767ed1f9e3d9e746038edb996b5` e `4872b388930cb195c2aed943744b5c0faff090e4`: `tests/calendar-contract.mjs` deixa de usar sua própria cópia da função `workday` e passa a importar a função real de `ui/src/lib/schedule.ts`, com carregamento TypeScript no release gate.
- A cobertura verifica o cálculo com as fixtures existentes. Não constitui homologação de feriados estaduais/municipais por fontes oficiais nem validação visual por unidade.


## Contrato do calendário — feriado aplicável versus não aplicável
- Commit `67c43072fd6405f52f016993703a2fff8cd6ee55`: quatro cenários adicionais executam o `workday` real com e sem feriado aplicado ao calendário da turma, comprovando que uma data presente no conjunto bloqueia o dia útil e que uma data ausente não o bloqueia.
- Esses casos usam datas sintéticas, **não homologam** cadastro/seleção territorial por UF ou município, nem confirmam feriados oficiais de Goiás. T-012 continua aberto até integração e dados locais serem validados em staging.
- CI nº 338 estava em andamento no último acompanhamento; o novo commit demanda uma execução independente.


## Teste de isolamento territorial de calendário
- Commit `07a5004a3f5ddade1d291c173a725d2bf0b2ff0b`: valida `feriadosDaTurma()` real com feriado geral e feriados restritos às unidades A/B; verifica que cada calendário exclui feriados de outra unidade e que `workday()` usa o conjunto filtrado.
- Teste sintético de escopo por `unidadeId`; **não comprova** a origem correta de feriados nacionais, estaduais/municipais nem cobertura por UF e município. A homologação das fontes e dos calendários territoriais no staging permanece aberta.
- Executar CI do commit e manter status `pendente` até a evidência do pipeline.


## Resiliência de cache de feriados regionais — 09/10/2026
- Commit `b98e6a0cd9a7924f935b762d38673128cd59afda`: respostas regionais completas mantêm cache de sete dias; respostas com avisos por falha de integração, indisponibilidade ou ausência de chave municipal passam a ter TTL de quinze minutos. Isso evita manter por uma semana um calendário incompleto após falha temporária.
- Commit `69b47ff14b60b09dcf2a7c270d64b25b0a4dcff1`: verificação estática no release gate protege a regra de cache reduzido.
- Trata-se de resiliência técnica, não confirmação do conteúdo das fontes externas. Ainda exige teste dinâmico com provedores offline/timeout e homologação de fontes por UF e município.


## CI #352 — falha PHPStan corrigida
- CI #346: `success`.
- CI #352: `failure` no PHPStan: `Constant MINUTE_IN_SECONDS not found` (classe de serviço), após introdução do cache regional de 15 minutos.
- Correção do PHP em `2166d80123b31039228175f685e11b3dd15dfb1f`: `15 * 60` segundos, sem dependência dessa constante no escopo de análise estática.
- Teste estático alinhado em `6eba3f188c01f01a2bee911d87e6b05accd597ce`.
- O CI do código corrigido deve ser confirmado antes de considerar a correção validada; homologação de feriados estaduais e municipais ainda pendente.


## Proteção contra respostas inválidas de APIs regionais
- Commits `820441f1`, `d941ced`, `6f11f17`: consultas estaduais e municipais com HTTP 200 e corpo JSON inválido passam a produzir avisos de degradação, em vez de serem interpretadas silenciosamente como calendário completo.
- A regra existente de TTL reduzido (15 minutos) aplica-se a essas respostas, permitindo recuperação após indisponibilidade. Teste estático acrescentado no commit `8970fe6`.
- **Pendente:** executar CI com as novas alterações e simular respostas HTTP via teste dinâmico controlado. Esta validação não comprova dados oficiais nem homologação em staging.


## E2E com provedores regionais simulados — 09/10/2026
- Commit `f0e1838b6d516ba733c8c0c778e35727ac838663`: teste WordPress/WP-CLI usando `pre_http_request` para simular HTTP 200 com JSON inválido tanto na consulta estadual quanto municipal. Usa unidade sintética, chave artificial, cache nacional sintético e bloqueia qualquer consulta de rede não reconhecida.
- O teste exige dois avisos, nenhum feriado regional inventado, TTL de no máximo quinze minutos para resposta degradada e reutilização de cache no segundo acesso.
- Commit `1e83a5f16ff47bb38ac9258bdb7c09baf139d984`: integração ao release gate com WordPress descartável, sem redes externas reais.
- CI desta alteração ainda a verificar. Não comprova casos de timeout real, qualidade das fontes oficiais, seleção de município real ou staging.


## Ensaio de timeout e indisponibilidade regional
- Commit `27732e6fab02b63f49ec5d642fda49bc3270c347`: o teste `holiday-provider-degraded.php` passa a simular `WP_Error('http_request_failed')` nas consultas estadual e municipal, além de HTTP 200 com JSON inválido.
- Critério: duas requisições interceptadas, dois avisos de falha, nenhum feriado regional inventado e expiração do cache em até 15 minutos.
- São testes sintéticos em WordPress descartável; não comprovam confiabilidade de provedor real, confirmação de feriado oficial ou homologação por município. Resultado do CI ainda pendente.


## Início da etapa PERF — baseline reproduzível de artefatos
- Commit `dfc18ff24b4759f430a2a393aa7fa7a64bf63a46`: script de baseline do bundle WordPress e preview, em bytes, bytes gzip e SHA-256, usando artefatos efetivamente gerados no runner.
- Commit `905da84dbcc1df99325eaba6e5b76af6ec036a98`: execução do baseline após os builds no release gate. O output precisa ser recolhido e comparado entre SHAs para servir de evidência.
- Essas métricas não substituem testes de p50/p95, volume SQL com EXPLAIN, React Profiler, rede ou navegador; T-015 a T-017 continuam abertos.


## Baseline HTTP local sintético
- Commit `c1f01a1ceea1680148bcdc4e5163c2e1976ebf1e`: sonda HTTP anônima com 8 requisições sequenciais aos caminhos `/` e `/?rest_route=/` do WordPress descartável. Registra mínimo, mediana, p95 amostral e máximo em milissegundos, sem armazenar credenciais.
- Commit `66b667c33776233950d95732a1546b0c416ce5a8`: integrado ao gate após a criação das fixtures WP, antes dos testes E2E.
- **Interpretação:** p95 com oito amostras sequenciais não estima a experiência em produção, nem testa operações autenticadas, tempo SQL ou desempenho de geração de cronogramas. São números comparativos iniciais do runner; staging e testes de carga/SQL continuam pendentes.


## Navegação acessível de menus — etapa UX
- Commit `306f1643a47fc12dc8b2db2ea5abc15823e7b471`: menus de conta e de navegação móvel passam a responder à tecla Escape enquanto estão abertos, com remoção dos listeners quando fecham.
- Commit `563143f6421a0887ab439293f97583f423f93944`: gate estático confere a existência das duas ações de fechamento.
- Ainda não há homologação manual de foco, leitor de tela, responsividade e WCAG. Resultados de CI novos devem ser consultados antes de declarar aprovação.


## UX: retorno de foco ao fechar menus
- Commit `85695f097a75d8e97f8a154297ed690684a04f88`: ao pressionar Escape nos menus de conta e navegação móvel, fecha o menu e devolve o foco ao botão que o abriu.
- Commit `048aa17e4d98b6ab58381496229543417998b833`: gate estático exige fechamento e retorno de foco em ambos os casos.
- Testes manuais em navegador/leitor de tela e resultado CI permanecem necessários para homologação de acessibilidade.


## UX móvel — área segura do dispositivo
- Commit `683d184e3e80c7ad73f814d468229e41c40bdf34`: barra de navegação inferior considera `env(safe-area-inset-bottom)` para não aproximar excessivamente os controles da área reservada a gestos do sistema operacional.
- Commit `3dcb00bb0abc60991a771ee0a31b5b5656a5ab61`: teste estático de regressão do espaçamento da área segura.
- A verificação visual em celulares reais, com e sem área de gestos, continua pendente; não declarar homologação antes dessa validação.


## Etapa 9 — Integridade de artefatos para release candidate
- Commit `a7fc2118b323b78c3d2586cc2a186bd42948f2ae`: o empacotador produz `dist/SHA256SUMS` com checksums SHA-256 dos ZIPs do plugin e do tema e valida cada entrada com `sha256sum -c` antes de concluir.
- Esta mudança não publica release nem implanta produção. A aprovação do pipeline, a disponibilidade dos artefatos, rollback real de staging, revisão de segurança e aceites de homologação (G4/G5) continuam obrigatórios.
