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
