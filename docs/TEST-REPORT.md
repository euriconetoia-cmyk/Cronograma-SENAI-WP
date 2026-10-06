# Relatório de validação do candidato 2.19.0

Data: 06/10/2026

Baseline: commit local `168f37a`, versão 2.13.1.

Branch de trabalho: `improvement/full-hardening`.

## Resultado executivo

O código-fonte das melhorias previstas foi implementado no candidato 2.19.0. Os portões que podem ser executados sem dependências externas estão aprovados. A promoção para produção permanece bloqueada até executar build React, lint, auditoria de dependências e E2E contra WordPress e MariaDB reais.

A existência desse bloqueio é intencional. Nenhum item não executado é tratado como aprovado.

## Testes executados e aprovados

| Teste | Resultado |
| --- | --- |
| `bash tests/php-syntax.sh` | Aprovado |
| `php tests/unit-rules.php` | Aprovado |
| Contrato PHP de calendário | 50 fixtures aprovadas |
| `node tests/calendar-contract.mjs` | 50 fixtures aprovadas |
| `node tests/security-static.mjs` | 14 verificações aprovadas |
| `node --check tests/e2e.mjs` | Sintaxe aprovada |
| `node --check tests/acessos.mjs` | Sintaxe aprovada |
| `node --check tests/avisos.mjs` | Sintaxe aprovada |
| `git diff --check` | Aprovado |
| JSON de `ui/package.json` e `composer.json` | Aprovado |
| YAML de `docker-compose.yml` | Aprovado |
| YAML de `.github/workflows/ci.yml` | Aprovado |

## Verificações estáticas de segurança aprovadas

1. Editor nativo perde capabilities do sistema.
2. Resposta de recuperação de senha não contém link.
3. Expiração do reset é duas horas.
4. Auditoria possui endpoint protegido.
5. REST utiliza callbacks de capability por operação.
6. Fonte React não oferece cópia do token de reset.
7. Payload de turma possui limite de tamanho.
8. Operações críticas usam transações.
9. Importação possui pré-validação e simulação.
10. Usuário inativo é removido das notificações.
11. Exportador e apagador de privacidade do WordPress estão integrados.
12. Feriado em sábado não é suprimido.
13. Postagem de notas não ignora feriados.
14. Não existe endpoint REST com permissão pública por `__return_true`.

## Testes bloqueados pelo ambiente atual

### Build e lint do frontend

Bloqueado porque `pnpm` não está instalado e o ambiente não consegue resolver `registry.npmjs.org`. A tentativa de consultar o registry retornou `EAI_AGAIN`.

Comandos obrigatórios no CI ou staging:

```sh
cd ui
corepack enable
corepack prepare pnpm@10.17.1 --activate
pnpm install --frozen-lockfile
pnpm lint
pnpm typecheck
pnpm build:wp
pnpm build:preview
pnpm audit --audit-level high
```

Consequência: o `plugin-cronograma-ead-core/assets/app.js` presente no pacote continua sendo o bundle anterior e não pode ser considerado artefato de release. O fonte em `ui/src` é a referência atual e deve gerar um novo bundle antes de instalação em produção.

### E2E WordPress e MariaDB

Bloqueado porque Docker, MariaDB/MySQL e uma instância WordPress de teste não estão disponíveis neste ambiente.

O repositório contém `docker-compose.yml` e `tests/setup-wp.sh` para tornar o teste reproduzível. O CI executa:

```sh
docker compose up -d db wordpress
IDS="$(bash tests/setup-wp.sh | tail -1)"
node tests/e2e.mjs "$IDS"
node tests/acessos.mjs "$IDS"
node tests/avisos.mjs "$IDS"
```

## Situação por fase

| Fase | Implementação | Validação disponível | Situação de release |
| --- | --- | --- | --- |
| 0 Baseline | Concluída | PHP e estrutura aprovados | E2E/build pendentes |
| 1 Segurança | Concluída | 14 checks estáticos | E2E pendente |
| 2 Contratos de dados | Concluída | PHP/unitário aprovado | E2E pendente |
| 3 Calendar Engine | Concluída | 50 cenários PHP + JS | Aprovada no nível disponível |
| 4 Transações | Concluída | Sintaxe/estática | Banco real pendente |
| 5 Backup e restauração | Concluída | Pré-validação estática | Banco real pendente |
| 6 Auditoria | Concluída | Sintaxe/estática | E2E pendente |
| 7 Notificações | Concluída | Sintaxe/estática | SMTP/E2E pendentes |
| 8 Hardening | Código e documentação concluídos | Revisão estática | Staging pendente |
| 9 Observabilidade | Concluída | Sintaxe/estática | E2E pendente |
| 10 CI/CD | Pipeline criado | YAML aprovado | Execução remota pendente |
| 11 UX e resiliência | Fonte concluído | Revisão estática | Build/browser pendentes |
| 12 Arquitetura 3.0 | Decisão registrada | Condição de normalização não comprovada | Adiada conforme especificação |
| 13 Privacidade | Concluída | Sintaxe/estática | E2E WordPress pendente |
| 14 Documentação | Concluída | Arquivos conferidos | Release depende dos portões anteriores |

## Decisão de produção

NÃO APROVADO PARA PRODUÇÃO neste ambiente.

Para aprovação final são obrigatórios: novo `assets/app.js` produzido pelo build atual, lint e TypeScript sem erros, auditoria de dependências, E2E em WordPress/MariaDB, teste de backup e rollback em staging e verificação de SMTP/cron conforme a infraestrutura de destino.
