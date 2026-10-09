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
