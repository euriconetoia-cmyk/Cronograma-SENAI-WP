# Arquitetura

## Visão geral

O sistema utiliza WordPress como camada de identidade, sessão, páginas e infraestrutura, um plugin como núcleo de domínio e uma SPA React/TypeScript como interface operacional.

Fluxo principal:

1. O WordPress autentica o usuário e determina suas capabilities.
2. O shortcode injeta o ponto de montagem da aplicação e os dados mínimos de bootstrap.
3. O frontend chama a REST API `cronograma-ead/v1` usando cookie autenticado e nonce WordPress.
4. A camada REST verifica a capability correspondente à operação.
5. A camada Service revalida autorização de objeto e unidade e aplica regras de negócio.
6. Store e DB sanitizam, validam e persistem os dados.
7. Alterações de turma usam revisão otimista por `rev`.
8. Ações críticas de validação e importação utilizam transação.

## Componentes de domínio

`class-roles.php` define o modelo de autorização.

`class-store.php` define contrato, sanitização e catálogo.

`class-rules.php` concentra regras puras, incluindo calendário.

`class-service.php` orquestra casos de uso.

`class-db.php` encapsula persistência, versões e auditoria.

`class-security.php` fornece request ID e rate limiting.

`class-notify.php` executa notificações e lembretes.

`class-privacy.php` integra os mecanismos de privacidade do WordPress.

## Decisão sobre arquitetura 3.0

A normalização ampla do JSON não foi executada nesta versão. A especificação condiciona essa mudança à existência de benefício comprovado para consulta, dashboard, integração ou desempenho. Sem métricas de produção que demonstrem gargalo, uma migração estrutural seria risco sem benefício mensurável. O desenho atual mantém entidades operacionais principais em tabelas e snapshots JSON para histórico. A normalização futura deve ser feita por migrações versionadas e teste com cópia anonimizada de dados reais.
