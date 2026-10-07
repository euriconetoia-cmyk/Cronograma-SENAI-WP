# Segurança

## Princípios

O sistema aplica menor privilégio, autorização em duas camadas e negação por padrão. Uma permissão na rota REST não substitui a validação de objeto e unidade na camada de serviço.

## Controles implementados

- Capabilities específicas para visualizar, editar, validar, gerenciar catálogo, acessos, importar, exportar, configurar e auditar.
- O papel nativo Editor do WordPress não recebe permissões administrativas do Cronogramas EaD.
- Tokens de redefinição de senha nunca são devolvidos no JSON da API nem exibidos para o operador.
- Links de acesso expiram em duas horas.
- Rate limiting para operações sensíveis.
- Usuários inativos têm autenticação bloqueada, sessões encerradas e são excluídos dos destinatários internos.
- REST API protegida por capabilities, autenticação WordPress e nonce.
- Sanitização, allowlists e limites de payload.
- Datas validadas como calendário real.
- Revisão otimista por `rev` para impedir sobrescrita silenciosa.
- Transações em validação e importação.
- Auditoria administrativa com request ID.
- Sem rota REST com `__return_true`.

## Controles de infraestrutura obrigatórios

Produção deve usar HTTPS, `DISALLOW_FILE_EDIT`, debug público desativado, salts exclusivos, backups externos, atualização controlada e proteção de login. 2FA deve ser obrigatório para administradores e operadores com gestão de acessos, importação, exportação ou validação em nome da unidade quando suportado pela infraestrutura adotada.

## CSP

Fontes externas estão desativadas por padrão e o script de bootstrap do tema foi movido para arquivo próprio. O shortcode ainda precisa disponibilizar configuração dinâmica ao frontend, portanto uma CSP restritiva deve ser validada em staging antes de ser aplicada. Não habilite uma política que quebre a aplicação.

## Incidentes

Nunca registrar senhas, chaves de redefinição ou tokens em logs. Em suspeita de comprometimento, revogar sessões, desativar a conta afetada, preservar auditoria, revisar eventos correlacionados pelo request ID e seguir `INCIDENT-RESPONSE.md`.
