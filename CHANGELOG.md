# Changelog

## 2.19.0 - Candidato de hardening

### Segurança
- Capabilities separadas por operação e remoção do acesso automático do Editor nativo.
- Recuperação de senha sem retorno de token ou URL ao operador.
- Expiração de link reduzida para duas horas.
- Rate limiting em ações sensíveis.
- Usuários inativos removidos de notificações e sessões revogadas.
- Callbacks REST específicos e endpoint de auditoria protegido.

### Integridade
- Validação real de datas, allowlist e limites de payload.
- Calendário consistente com feriados em backend e frontend.
- Correção de feriado em sábado e postagem de notas.
- Validação e snapshots em transação.
- Importação com pré-validação, simulação e rollback.
- Schema de banco versão 3, índices e auditoria administrativa.

### Operação
- Saúde do sistema e request ID.
- Integração de privacidade do WordPress.
- Fontes externas desativadas por padrão.
- Ambiente Docker e pipeline de CI.
- Documentação de segurança, implantação, operação, testes e incidentes.

### Observação de release
O bundle React precisa ser recompilado por `pnpm build:wp` e os E2E precisam passar em WordPress/MariaDB antes de promover esta versão a produção.
