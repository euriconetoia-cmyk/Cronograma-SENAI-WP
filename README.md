# Cronogramas EaD

Sistema institucional WordPress para criação, acompanhamento, validação, versionamento e exportação de cronogramas EaD. A aplicação é formada por plugin WordPress, tema próprio e frontend React/TypeScript.

## Componentes

- `plugin-cronograma-ead-core`: regras de negócio, REST API, banco, permissões, usuários, notificações, auditoria e integração WordPress.
- `theme-cronograma-ead-theme`: apresentação institucional e integração visual.
- `ui`: aplicação React/TypeScript compilada para `plugin-cronograma-ead-core/assets/app.js`.
- `tests`: contratos de calendário, verificações estáticas e testes E2E contra WordPress/MariaDB.
- `docs`: arquitetura, segurança, operação, implantação, backup e demais documentos de manutenção.

## Desenvolvimento local

Pré-requisitos recomendados: Docker Compose, Node 22, pnpm 10, PHP 8.2 ou superior e Composer 2.

1. Copie `.env.example` para `.env` se desejar alterar as configurações locais.
2. Execute `docker compose up -d db wordpress`.
3. Execute `bash tests/setup-wp.sh`. O comando imprime no final o JSON com IDs das páginas criado pelo plugin.
4. Execute os testes E2E usando esse JSON conforme `docs/TESTING.md`.

## Frontend

```sh
cd ui
corepack enable
pnpm install --frozen-lockfile
pnpm lint
pnpm typecheck
pnpm build:wp
pnpm build:preview
```

O bundle de produção deve ser recompilado antes de um release. Alterações em `ui/src` não podem ser publicadas usando um `assets/app.js` antigo.

## Qualidade

```sh
bash tests/php-syntax.sh
php tests/unit-rules.php
node tests/calendar-contract.mjs
node tests/security-static.mjs
composer install
composer phpcs
composer phpstan
```

O pipeline de CI repete essas verificações e executa os E2E em WordPress e MariaDB reais.

## Segurança

O sistema utiliza capabilities por operação, autorização por objeto e unidade, nonces REST, revisão otimista, transações nas operações críticas, recuperação de senha sem exposição do token, rate limiting, auditoria administrativa e isolamento de usuários inativos.

Consulte `docs/SECURITY.md`, `docs/PERMISSIONS.md` e `docs/DEPLOYMENT.md` antes de implantação.
