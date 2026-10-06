# REST API

Namespace: `cronograma-ead/v1`.

As rotas usam autenticação WordPress por cookie e `X-WP-Nonce`. As respostas da aplicação usam `Cache-Control: no-store` e `X-Cronograma-Request-Id`.

Rotas principais:

- `GET /bootstrap`: dados permitidos ao usuário.
- `POST /catalogo`: alteração de catálogo, capability específica.
- `POST /turmas`: criação.
- `POST /turmas/{id}`: edição com revisão.
- `POST /turmas/{id}/acao`: transições de fluxo.
- `GET /turmas/{id}/historico`: histórico autorizado por objeto.
- `GET /atividade`: atividade filtrada por visibilidade.
- `GET|POST /acessos`: gestão de contas.
- `POST /acessos/{uid}/link`: envia link temporário somente ao e-mail cadastrado. A resposta não contém token ou URL.
- `GET /exportar`: backup completo.
- `POST /importar`: simulação ou importação transacional.
- `GET /saude`: diagnóstico protegido.
- `GET /auditoria?limit=100`: trilha administrativa protegida por `cronograma_ead_auditar`.

Toda operação sobre uma turma deve revalidar a visibilidade e a permissão do objeto no Service, ainda que a rota já possua capability.
