# Resposta a incidentes

## Conta possivelmente comprometida

1. Desativar o acesso afetado e revogar sessões.
2. Preservar logs e auditoria.
3. Identificar request IDs e operações recentes.
4. Revisar alterações de catálogo, usuários, exportações, importações e validações em nome de unidade.
5. Forçar recuperação de acesso por canal aprovado.
6. Avaliar credenciais administrativas e 2FA.

## Integridade de dados

1. Interromper operações de importação ou migração.
2. Preservar cópia do banco atual.
3. Identificar o último backup íntegro.
4. Reproduzir a falha em staging.
5. Restaurar apenas após confirmar impacto e procedimento.

## Exposição de segredo

Tokens de redefinição não devem estar em logs. Se qualquer segredo externo for exposto, rotacione-o na origem, invalide sessões relacionadas e revise o período de exposição.

Não apagar evidências antes da conclusão da análise e da aplicação da política institucional de retenção.
