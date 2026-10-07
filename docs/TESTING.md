# Testes

## Testes locais independentes

```sh
bash tests/php-syntax.sh
php tests/unit-rules.php
node tests/calendar-contract.mjs
node tests/security-static.mjs
```

`calendar-contract.mjs` usa 50 fixtures que também são consumidas pelos testes PHP para garantir contrato equivalente de dias úteis.

## Frontend

```sh
cd ui
corepack enable
pnpm install --frozen-lockfile
pnpm lint
pnpm typecheck
pnpm build:wp
pnpm build:preview
pnpm audit --audit-level high
```

## E2E real

```sh
docker compose up -d db wordpress
IDS="$(bash tests/setup-wp.sh | tail -1)"
node tests/e2e.mjs "$IDS"
node tests/acessos.mjs "$IDS"
node tests/avisos.mjs "$IDS"
```

Os E2E validam autenticação, isolamento entre unidades, restrições por perfil, fluxo da turma, revisão 409, backup, acessos e avisos.

## Política de regressão

A suíte crítica inteira deve ser executada antes de cada merge. Nenhuma fase deixa de ser testada após sua aprovação.

## Regressão multimodelo

Executar:

```sh
php tests/catalog-contract.php
node --experimental-strip-types --experimental-specifier-resolution=node tests/schedule-profiles.mjs
node --experimental-strip-types --experimental-specifier-resolution=node tests/schedule-multimodel.mjs
node --experimental-strip-types --experimental-specifier-resolution=node tests/modelos-cronograma.mjs
```

O último teste é o portão funcional dos quatro modelos oficiais: Técnico, Qualificação, Distribuição Diária e Aprendizagem.
