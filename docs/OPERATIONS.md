# Operação

## Saúde

A área administrativa e `GET /saude` apresentam versão do plugin, versão do schema, presença das tabelas, última e próxima execução do cron, revisão do catálogo e contagem de turmas. Segredos não são exibidos.

## Cron e notificações

O hook `cronograma_ead_diario` registra sua última execução. Para produção com exigência de horário previsível, recomenda-se cron real do servidor chamando o cron do WordPress ou solução equivalente. Falha de SMTP não deve reverter uma validação já commitada.

## Diagnóstico

1. Verificar a tela Saúde do Sistema.
2. Registrar o request ID exibido nas respostas REST quando aplicável.
3. Consultar a auditoria administrativa para operações sensíveis.
4. Verificar cron e SMTP.
5. Somente depois ativar logs técnicos, sem exibi-los publicamente.

## Contas

Desativar uma conta encerra as sessões e remove o usuário das notificações internas. Nunca envie senha manualmente. O fluxo administrativo envia um link temporário para o e-mail cadastrado e não revela o token ao operador.
