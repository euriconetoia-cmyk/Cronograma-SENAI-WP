# Banco de dados

## Schema

A versão de schema atual é 3.

Principais tabelas com prefixo do WordPress:

- `ce_turmas`: estado operacional da turma e revisão otimista.
- `ce_versoes`: snapshots das versões validadas, com unicidade por turma e versão.
- `ce_log`: histórico funcional da turma.
- `ce_avisos`: notificações internas.
- `ce_audit`: auditoria administrativa e request ID.

## Integridade

Validação de cronograma ocorre em transação. Estado da turma, snapshot e histórico precisam concluir juntos. Falha anterior ao commit provoca rollback. E-mail é processado depois do commit e não altera a integridade da operação.

Importação também é transacional depois da pré-validação completa. Catálogo e turmas não devem permanecer parcialmente importados em caso de erro.

## Migrações

`Cronograma_EAD_DB::VERSION` controla a evolução. Mudanças futuras devem manter upgrade versionado, backup prévio e teste de staging. Downgrade destrutivo automático não é permitido.
