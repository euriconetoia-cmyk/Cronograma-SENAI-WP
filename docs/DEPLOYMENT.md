# Implantação

## Ambientes

Utilizar desenvolvimento, staging/homologação e produção. Alterações de schema, dependências, importações e hardening devem passar por staging.

## WordPress em produção

Recomendações mínimas no `wp-config.php` e infraestrutura:

```php
define('DISALLOW_FILE_EDIT', true);
define('WP_DEBUG', false);
define('WP_DEBUG_DISPLAY', false);
```

Avaliar `DISALLOW_FILE_MODS` quando atualizações forem feitas exclusivamente por pipeline. Exigir HTTPS, cookies seguros, salts únicos e segredos fora do Git. Aplicar HSTS apenas quando todo o domínio estiver corretamente em HTTPS.

2FA deve ser exigido para contas administrativas e operações de alto impacto por plugin corporativo, IdP ou camada equivalente aprovada pela instituição.

## Headers

Avaliar em staging `Content-Security-Policy`, `X-Content-Type-Options`, `Referrer-Policy`, `Strict-Transport-Security` e `Permissions-Policy`. A CSP precisa considerar a configuração dinâmica do frontend e qualquer integração legítima do WordPress.

## Release

1. Todos os testes estáticos aprovados.
2. Dependências instaladas pelo lockfile.
3. Lint e TypeScript aprovados.
4. `pnpm build:wp` executado e `assets/app.js` atualizado.
5. E2E aprovado em WordPress e MariaDB reais.
6. Auditoria de dependências sem vulnerabilidade crítica conhecida.
7. Backup e rollback testados.
8. Pacote do plugin e tema gerados a partir do mesmo commit.
