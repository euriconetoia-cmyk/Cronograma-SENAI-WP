# Backup e restauração

## Formato

O formato atual usa `format=cronogramas-ead`, `schemaVersion=3`, versão da aplicação, timestamp, identificador do site, checksum SHA-256, catálogo e turmas.

## Importação segura

Antes da escrita o sistema valida JSON, versão, checksum quando presente, catálogo, todas as turmas e referências. A interface executa uma simulação que informa criações, atualizações e registros ignorados sem alterar o banco.

A simulação emite um token de confirmação vinculado ao conteúdo e ao usuário. A execução real exige esse token, capability de importação, revisão atual do catálogo e ocorre em transação. Antes da transação, o sistema guarda automaticamente uma cópia pré-importação no WordPress para recuperação operacional. Falha durante o processo provoca rollback.

Turmas em estados protegidos não são sobrescritas silenciosamente.

## Procedimento de produção

1. Fazer backup externo do banco e dos arquivos.
2. Executar simulação da importação.
3. Analisar o relatório.
4. Executar em staging quando o arquivo for amplo ou proveniente de versão diferente.
5. Importar em produção somente após validação.
6. Conferir auditoria, contagens e amostragem das turmas.

A restauração de banco deve seguir o procedimento da infraestrutura e nunca depender apenas do arquivo exportado pela aplicação.
