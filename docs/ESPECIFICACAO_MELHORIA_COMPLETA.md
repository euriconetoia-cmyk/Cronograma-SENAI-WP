# Especificação de Melhoria Completa do Sistema Cronogramas EaD

## 1. Objetivo

Esta especificação define o plano completo de evolução do sistema Cronogramas EaD para transformá-lo em uma aplicação WordPress institucional mais segura, previsível, auditável, testável e preparada para manutenção contínua.

O trabalho deve ser executado em fases sequenciais. Nenhuma fase pode ser considerada concluída sem evidência de testes e sem o cumprimento integral dos critérios de aceite. A fase seguinte só pode começar depois que a fase anterior estiver validada.

O escopo inclui plugin WordPress, tema, API REST, frontend React e TypeScript, banco de dados, autenticação, autorização, notificações, importação e exportação, regras de calendário, observabilidade, testes, CI/CD, documentação e procedimentos de implantação.

## 2. Estado atual verificado

A auditoria foi feita sobre o pacote do projeto recebido em 05/10/2026, commit identificado no repositório local como `168f37a v2.13.1: Equipe movida para Configurações`.

Validações executadas antes da elaboração desta especificação:

| Verificação | Resultado | Evidência |
| --- | --- | --- |
| Sintaxe PHP do plugin | Aprovado | Todos os arquivos PHP passaram em `php -l` |
| Sintaxe PHP do tema | Aprovado | Todos os arquivos PHP passaram em `php -l` |
| Controle de revisão otimista | Confirmado | Uso de `rev` e atualização condicionada por revisão |
| Separação de visibilidade por unidade | Confirmado | `pode_ver()` verifica unidades vinculadas |
| Link de redefinição de senha retornado pela API | Confirmado | `get_password_reset_key()` e endpoint `/acessos/{uid}/link` |
| Editor WordPress com acesso de equipe | Confirmado | `administrator` e `editor` recebem `CAP_EDIT` |
| Usuários inativos potencialmente incluídos em e-mails | Confirmado | consultas de destinatários não filtram `ce_inativo` |
| Validação de data apenas por expressão regular | Confirmado | `data_ok()` aceita apenas o formato textual |
| PHP soma dias úteis sem feriados | Confirmado | `somar_uteis()` considera somente sábado e domingo |
| Frontend trata feriados de forma diferente | Confirmado | `workday()` recebe conjunto de feriados |
| Alerta de feriado em sábado é suprimido | Confirmado | condição exclui sábado e domingo |
| Postagem de notas ignora feriados | Confirmado | chamada `workday(..., null)` |
| Versão validada é salva antes da transição da turma | Confirmado | `salvar_versao()` ocorre antes de `atualizar()` |
| Importação altera catálogo antes de concluir turmas | Confirmado | `salvar_catalogo()` executa antes do loop de turmas |
| Testes E2E existentes | Confirmado | `tests/e2e.mjs`, `tests/avisos.mjs`, `tests/acessos.mjs` |
| Build TypeScript no ambiente atual | Não executado | projeto usa pnpm, indisponível no ambiente; registry npm também indisponível |
| E2E contra WordPress real | Não executado neste ambiente | suíte requer WordPress e MariaDB ativos em `127.0.0.1:8099` |

A impossibilidade de executar build e E2E neste ambiente não autoriza publicação. Esses testes são definidos nesta especificação como portões obrigatórios de release.

## 3. Regra de execução por portões

Toda fase deve obedecer à seguinte sequência:

1. Criar branch específica.
2. Registrar estado inicial e testes de baseline.
3. Implementar somente o escopo da fase.
4. Executar testes unitários e estáticos.
5. Executar build do frontend.
6. Executar testes E2E em WordPress e MariaDB reais.
7. Executar testes negativos de segurança relacionados à fase.
8. Revisar diff para identificar mudanças acidentais.
9. Atualizar documentação e changelog.
10. Gerar evidências de teste.
11. Somente após todos os critérios passarem, fazer merge e iniciar a fase seguinte.

Qualquer falha bloqueia o avanço.

## 4. Estratégia de versões

| Versão planejada | Tema principal |
| --- | --- |
| 2.14.0 | Security Hardening |
| 2.15.0 | Data Integrity e Calendar Engine |
| 2.16.0 | Backup, Restore e Auditoria |
| 2.17.0 | Observabilidade e Operação |
| 2.18.0 | Qualidade, CI/CD e Supply Chain |
| 2.19.0 | UX, Resiliência e Acessibilidade |
| 3.0.0 | Evolução arquitetural e dados estruturados |

Não é obrigatório publicar cada fase separadamente em produção. A numeração serve também para organizar branches, changelog, migrações e marcos de validação.

# FASE 0. BASELINE, AMBIENTE DE TESTES E PROTEÇÃO DO TRABALHO

## 5. Objetivo

Criar uma base reproduzível de desenvolvimento e testes antes de alterar regras de negócio ou segurança.

## 6. Entregas

1. Definir versões suportadas de PHP, WordPress, MariaDB, Node e pnpm.
2. Criar ambiente local reproduzível com WordPress e MariaDB.
3. Criar dados de teste previsíveis.
4. Executar a suíte existente antes das alterações.
5. Criar tag de baseline da versão atual.
6. Gerar backup do banco e do código.
7. Registrar comportamento esperado das rotas principais.

## 7. Arquivos novos ou alterados

`README.md`

`tests/LEIA-ME.txt`

`docker-compose.yml` ou equivalente, caso o projeto adote Docker.

`.nvmrc` ou configuração equivalente.

`package.json`, se for necessário fixar package manager e engines.

## 8. Testes obrigatórios

1. `php -l` em todos os arquivos PHP.
2. Instalação limpa do frontend usando lockfile.
3. `pnpm lint`.
4. `pnpm build:wp`.
5. `pnpm build:preview`.
6. Execução de `tests/e2e.mjs`.
7. Execução de `tests/acessos.mjs`.
8. Execução de `tests/avisos.mjs`.
9. Ativação e desativação do plugin em WordPress limpo.
10. Validação de instalação do tema.

## 9. Critério de aceite

Todos os testes devem passar no baseline ou qualquer falha preexistente deve ser documentada antes de iniciar a Fase 1.

# FASE 1. SECURITY HARDENING E MENOR PRIVILÉGIO

## 10. Objetivo

Eliminar os riscos de maior severidade relacionados a contas, privilégios, recuperação de senha e operações administrativas.

## 11. Separação de capabilities

Substituir a concentração de funções em `cronograma_ead_editar` por capabilities específicas.

Capabilities propostas:

| Capability | Finalidade |
| --- | --- |
| `cronograma_ead_ver` | Visualizar dados permitidos |
| `cronograma_ead_editar_turmas` | Editar turmas |
| `cronograma_ead_validar` | Validar cronogramas da própria unidade |
| `cronograma_ead_validar_em_nome` | Validar em nome de uma unidade |
| `cronograma_ead_gerir_catalogo` | Cursos, pessoas, unidades e feriados |
| `cronograma_ead_gerir_acessos` | Criar e alterar usuários do sistema |
| `cronograma_ead_exportar` | Exportar backup |
| `cronograma_ead_importar` | Importar backup |
| `cronograma_ead_configurar` | Alterar configurações globais |
| `cronograma_ead_auditar` | Consultar trilha administrativa completa |

## 12. Remoção do acesso automático do Editor

Alterar `class-roles.php` para que o papel nativo `editor` não receba capacidades administrativas do sistema.

O papel `administrator` pode manter capabilities completas por decisão institucional, mas deve existir papel próprio para administração operacional do Cronogramas EaD.

A atualização deve remover capabilities previamente adicionadas a Editores existentes, não apenas deixar de adicioná-las em novas instalações.

## 13. Recuperação de senha

Alterar `class-accounts.php` e a rota correspondente para que o token de redefinição de senha nunca seja devolvido ao cliente.

Novo comportamento:

1. Operador solicita envio de acesso.
2. Backend valida a autorização.
3. Backend gera o token.
4. Backend envia o link diretamente ao e-mail cadastrado.
5. API retorna somente sucesso ou erro de entrega.
6. Token e URL nunca entram no JSON de resposta, log da aplicação ou interface administrativa.

Reduzir o prazo do link para uma janela institucional definida, preferencialmente entre 1 e 4 horas.

## 14. Rate limiting

Criar limitação de frequência para operações sensíveis:

| Operação | Limite inicial sugerido |
| --- | --- |
| Novo link de acesso | 3 por usuário alvo por hora |
| E-mail de teste | 5 por operador por hora |
| Criação de usuário | 20 por operador por hora |
| Importação | 5 tentativas por operador por hora |

A implementação pode usar transients ou camada de infraestrutura, desde que tenha chave por ação e usuário autenticado.

## 15. Usuários inativos

Garantir que usuário marcado com `ce_inativo`:

1. Não consiga autenticar.
2. Tenha sessões existentes invalidadas.
3. Não receba notificações do sistema.
4. Não apareça como destinatário elegível.
5. Não possa executar operações via sessão previamente criada.

Alterar `emails_unidade()` e `emails_equipe()` para excluir contas inativas.

## 16. Rotas REST com permissões específicas

Substituir callbacks genéricos por callbacks por operação.

Exemplos:

`can_view_bootstrap`

`can_create_turma`

`can_edit_turma`

`can_manage_catalog`

`can_manage_accounts`

`can_export`

`can_import`

`can_view_audit`

A autorização de objeto deve continuar sendo revalidada na camada de serviço. A proteção da rota não substitui `pode_ver()` e demais verificações por unidade.

## 17. Testes obrigatórios da Fase 1

1. Editor WordPress não acessa funções administrativas do Cronogramas EaD.
2. Administrador continua operando conforme política definida.
3. Equipe consegue apenas ações correspondentes às capabilities recebidas.
4. Consulta nunca cria, edita, valida, importa ou exporta.
5. Coordenador da Unidade A não acessa objeto da Unidade B.
6. Auxiliar sem permissão de validação não valida.
7. Usuário inativo perde sessões imediatamente.
8. Usuário inativo não recebe e-mail.
9. Endpoint de novo acesso não devolve URL, chave ou token.
10. Operador não consegue reconstruir o link pela resposta da API.
11. Rate limit responde adequadamente após atingir o limite.
12. Nonce inválido falha.
13. Sessão expirada falha.
14. Requisição anônima falha.

## 18. Critério de aceite da Fase 1

Nenhuma conta com privilégio inferior pode realizar operação superior alterando URL, ID, JSON ou chamada direta à REST API. Nenhum token de redefinição pode ser exposto ao operador.

# FASE 2. VALIDAÇÃO E CONTRATOS DE DADOS

## 19. Objetivo

Impedir dados impossíveis, payloads excessivos e estruturas inesperadas de entrarem no banco.

## 20. Validação real de datas

Substituir `data_ok()` baseada somente em regex por validação de calendário real.

Casos que devem falhar:

`2026-02-30`

`2026-02-31`

`2026-13-10`

`2026-00-10`

`2026-04-31`

Casos válidos devem incluir anos bissextos.

## 21. Schema formal de turma

Criar allowlist completa para payload de turma.

Definir para cada campo:

| Propriedade | Definição necessária |
| --- | --- |
| Tipo | string, inteiro, booleano, array ou objeto |
| Obrigatório | sim ou não |
| Tamanho máximo | limite definido |
| Formato | quando aplicável |
| Enum | quando aplicável |
| Sanitização | função utilizada |
| Permissão | quais perfis podem modificar |

`merge_equipe()` não deve aceitar arbitrariamente todo o objeto recebido.

## 22. Limites de payload

Limites iniciais sugeridos:

| Dado | Limite |
| --- | --- |
| JSON de uma turma | 256 KB |
| Observação | 2.000 caracteres |
| Motivo | 2.000 caracteres |
| Ressalva | 2.000 caracteres |
| Nome | 160 caracteres |
| Ambiente | 190 caracteres |
| Identificador | 64 caracteres |
| Encontros por item | 40, mantendo limite atual |

Os limites finais devem ser confirmados com exemplos reais antes do release.

## 23. Integridade referencial de aplicação

Validar obrigatoriamente:

1. `cursoId` existe quando necessário.
2. `unidadeId` existe.
3. IDs de pessoas referenciadas existem quando obrigatórios.
4. IDs de itens pertencem ao curso correspondente.5. Feriados de unidade referenciam unidade válida.
6. Status informado externamente não pode sobrescrever metadados de fluxo.

## 24. Testes obrigatórios da Fase 2

Adicionar testes para payload inválido, campo extra, ID malformado, data impossível, conteúdo muito longo, array excessivo, curso inexistente, unidade inexistente e tentativa de modificar metadados protegidos.

## 25. Critério de aceite da Fase 2

Nenhum payload fora do contrato é persistido parcial ou integralmente.

# FASE 3. CALENDAR ENGINE ÚNICO

## 26. Objetivo

Eliminar divergências entre frontend e backend na interpretação de dia útil, feriado, férias e prazos.

## 27. Fonte única de regras

Definir formalmente os conceitos:

1. Dia útil.
2. Feriado nacional.
3. Feriado local.
4. Ponto facultativo.
5. Férias.
6. Dia não letivo.
7. Regra de sábado letivo.
8. Regra de domingo.

Não reutilizar implicitamente a mesma lista para finalidades diferentes sem decisão de negócio.

## 28. Correções obrigatórias

1. Backend deve considerar feriados na soma de prazos quando a regra exigir.
2. Frontend e backend devem produzir a mesma data para o mesmo conjunto de entradas.
3. Feriado em sábado deve gerar alerta quando houver encontro nesse sábado.
4. Postagem de notas deve receber o conjunto correto de dias não úteis em vez de `null`, conforme regra institucional aprovada.
5. Reabertura e envio para validação devem usar o mesmo serviço de calendário.

## 29. Testes de contrato de calendário

Criar um arquivo de casos compartilhados ou fixtures equivalentes contendo no mínimo 50 cenários.

Exemplos:

1. Sexta mais 1 dia útil sem feriado.
2. Sexta mais 1 dia útil com segunda feriado.
3. Véspera de feriado local.
4. Sábado que é feriado e possui encontro.
5. Ano bissexto.
6. Virada de mês.
7. Virada de ano.
8. Período de férias.
9. Dois feriados consecutivos.
10. Feriado exclusivo de uma unidade.

O mesmo conjunto esperado deve ser validado no PHP e no TypeScript.

## 30. Critério de aceite da Fase 3

Para todas as fixtures, PHP e frontend devem gerar resultados idênticos.

# FASE 4. TRANSAÇÕES E INTEGRIDADE DO BANCO

## 31. Objetivo

Garantir que ações compostas ocorram integralmente ou não ocorram.

## 32. Validação transacional

A operação de validar deve ser atômica.

Sequência prevista:

1. Iniciar transação.
2. Confirmar revisão atual.
3. Atualizar estado da turma com trava otimista.
4. Gravar snapshot da versão.
5. Gravar log obrigatório.
6. Commit.
7. Somente depois do commit, disparar e-mail e aviso assíncrono ou tolerante a falha.

Se qualquer operação de banco falhar antes do commit, executar rollback.

Não deixar snapshot de versão se a turma não for efetivamente validada.

## 33. Índices e unicidade

Avaliar e implementar:

`UNIQUE (turma_id, versao)` em versões.

Índice `(unidade_id, status)`.

Índice `(status, prazo)`.

Índice para consultas de atividade por turma e data.

As alterações devem ocorrer por migração versionada.

## 34. Testes obrigatórios da Fase 4

1. Duas validações simultâneas.
2. Falha forçada ao inserir versão.
3. Falha forçada ao atualizar turma.
4. Revisão antiga retorna 409.
5. Nenhuma versão fantasma é criada.
6. Log e estado permanecem consistentes após rollback.

## 35. Critério de aceite da Fase 4

Banco permanece consistente em concorrência e falhas simuladas.

# FASE 5. BACKUP, IMPORTAÇÃO E RESTAURAÇÃO SEGURA

## 36. Objetivo

Transformar o backup em mecanismo confiável e reversível.

## 37. Novo formato de backup

Estrutura mínima:

```json
{
  "format": "cronogramas-ead",
  "schemaVersion": 3,
  "applicationVersion": "2.16.0",
  "generatedAt": "ISO-8601",
  "siteId": "identificador",
  "checksum": "sha256",
  "catalogo": {},
  "turmas": []
}
```

## 38. Fluxo de importação

1. Receber arquivo.
2. Validar tamanho.
3. Validar JSON.
4. Validar formato e schema version.
5. Validar todos os registros sem alterar banco.
6. Gerar relatório de simulação.
7. Exigir confirmação.
8. Gerar backup automático do estado atual.
9. Iniciar transação.
10. Importar catálogo e turmas.
11. Registrar auditoria.
12. Commit.
13. Retornar relatório final.

## 39. Políticas

1. Nunca importar silenciosamente dados inválidos.
2. Diferenciar erro, ignorado e atualizado.
3. Não sobrescrever turma validada sem fluxo explícito de restauração administrativa.
4. Importação deve ter capability própria.
5. Avaliar reautenticação ou 2FA para importação completa.

## 40. Testes obrigatórios da Fase 5

Arquivo truncado, JSON inválido, checksum inválido, versão futura, versão antiga migrável, turma inválida, falha na metade da importação, conflito de revisão, catálogo inválido, backup com milhares de registros e rollback integral.

## 41. Critério de aceite da Fase 5

Nenhuma importação parcial pode permanecer após falha.

# FASE 6. AUDITORIA E RASTREABILIDADE

## 42. Objetivo

Registrar ações sensíveis suficientes para investigação e governança.

## 43. Eventos administrativos obrigatórios

Registrar ao menos:

1. Criação de usuário.
2. Alteração de perfil.
3. Alteração de unidades vinculadas.
4. Ativação e desativação.
5. Solicitação de novo link de acesso.
6. Mudança de capabilities administrativas.
7. Exportação.
8. Importação.
9. Mudança de catálogo.
10. Exclusão ou arquivamento.
11. Validação normal.
12. Validação em nome da unidade.
13. Reabertura.
14. Falha de importação.
15. Ações bloqueadas por autorização, em nível adequado de segurança.

## 44. Campos recomendados

`event_id`

`request_id`

`user_id`

`user_name`

`action`

`entity_type`

`entity_id`

`result`

`reason`

`created_at`

IP e user agent somente se aprovados pela política de privacidade e retenção.

## 45. Validação em nome da unidade

Exigir justificativa não vazia e registrar explicitamente que a ação ocorreu em representação da unidade.

## 46. Retenção

Definir tempo de retenção para logs e versões, com documentação operacional e aderência às políticas institucionais de privacidade.

## 47. Critério de aceite da Fase 6

Toda ação administrativa sensível deve poder ser reconstruída pela trilha de auditoria sem depender apenas de e-mail.

# FASE 7. NOTIFICAÇÕES E AGENDAMENTO CONFIÁVEL

## 48. Objetivo

Garantir que e-mails e lembretes sejam entregues somente aos destinatários corretos e que o processamento seja observável.

## 49. Mudanças

1. Filtrar usuários inativos.
2. Validar e-mails antes de envio.
3. Registrar resultado do envio.
4. Evitar duplicação por chave idempotente.
5. Separar falha de e-mail de falha da operação principal.
6. Não fazer rollback de uma validação já commitada apenas porque SMTP falhou.
7. Criar rotina de reenvio controlado.

## 50. Cron

Para produção, preferir cron real do servidor ou Action Scheduler, caso o projeto precise de garantia operacional superior ao WP Cron dependente de tráfego.

## 51. Critério de aceite da Fase 7

Lembretes não duplicam, usuários inativos não recebem mensagens e falha no SMTP não corrompe estado do sistema.

# FASE 8. HARDENING DO WORDPRESS E INFRAESTRUTURA

## 52. Objetivo

Reduzir superfície de ataque fora do código da aplicação.

## 53. Configuração recomendada

1. `DISALLOW_FILE_EDIT` ativo em produção.
2. Avaliar `DISALLOW_FILE_MODS` conforme estratégia de deploy.
3. `WP_DEBUG` desativado em produção.
4. `WP_DEBUG_DISPLAY` desativado.
5. HTTPS obrigatório.
6. Cookies seguros conforme ambiente.
7. Chaves e salts únicos.
8. Nenhuma credencial ou segredo no Git.
9. Backups externos do banco.
10. Atualizações controladas e homologadas.

## 54. Autenticação multifator

Tornar 2FA obrigatório para contas administrativas, equipe com gestão de acessos, importação, exportação e validação em nome da unidade, caso a infraestrutura WordPress adotada permita essa política.

## 55. Headers

Planejar CSP após remover dependências incompatíveis com política restritiva.

Avaliar:

`Content-Security-Policy`

`X-Content-Type-Options`

`Referrer-Policy`

`Strict-Transport-Security`

`Permissions-Policy`

## 56. Scripts inline

Mover scripts inline existentes no tema e login para arquivos enfileirados sempre que viável, facilitando CSP mais forte.

## 57. Fontes externas
Avaliar self-host das fontes ou uso de font stack do sistema para reduzir dependência externa e simplificar CSP e privacidade.

## 58. Critério de aceite da Fase 8

Checklist de hardening aprovado em staging e reproduzível na produção.

# FASE 9. OBSERVABILIDADE E SAÚDE DO SISTEMA

## 59. Objetivo

Permitir diagnóstico sem inspeção manual do banco ou código.

## 60. Tela Saúde do Sistema

Exibir pelo menos:

| Indicador | Informação |
| --- | --- |
| Plugin | versão atual |
| Schema do banco | versão |
| Frontend | build/version |
| Banco | conectividade |
| Tabelas | existência e migrações |
| Cron | última e próxima execução |
| E-mail | último teste e último erro |
| REST | disponibilidade |
| Backup | última exportação administrativa, se registrada |
| Erros | falhas recentes relevantes |

Não exibir segredos.

## 61. Request ID

Adicionar identificador de requisição às operações críticas para correlacionar frontend, REST e logs.

## 62. Critério de aceite da Fase 9

Uma falha comum deve poder ser diagnosticada pela tela e logs sem ativar debug público.

# FASE 10. QUALIDADE DE CÓDIGO E SUPPLY CHAIN

## 63. Objetivo

Automatizar verificações para impedir regressões.

## 64. Ferramentas PHP

Adicionar:

1. PHP_CodeSniffer.
2. WordPress Coding Standards.
3. PHPStan ou ferramenta equivalente.

## 65. Frontend

Pipeline obrigatório:

1. Instalação pelo lockfile.
2. TypeScript sem erro.
3. Lint sem erro bloqueante.
4. Build WordPress.
5. Build preview.
6. Testes unitários do calendar engine.

## 66. Dependências

1. Dependabot ou equivalente.
2. Auditoria periódica de dependências.
3. Atualizações sempre em branch e staging.
4. Lockfile obrigatório.
5. Package manager explicitamente fixado em `package.json`.

## 67. Git hygiene

Remover caches rastreados, inclusive `.parcel-cache`.

Ampliar `.gitignore` conforme necessidade:

`.parcel-cache/`

`.cache/`

`coverage/`

`.env`

`.env.*`

Preservar somente arquivos de ambiente de exemplo sem segredo.

## 68. CI/CD

Pipeline mínimo para Pull Request:

1. PHP syntax.
2. PHPCS.
3. PHPStan.
4. Instalação frontend.
5. Lint.
6. TypeScript.
7. Build.
8. Testes unitários.
9. Testes E2E em ambiente WordPress efêmero.
10. Auditoria de dependências.
11. Empacotamento do plugin e tema.

## 69. Critério de aceite da Fase 10

Pull Request com teste obrigatório falhando não pode ser integrado à branch principal.

# FASE 11. RESILIÊNCIA DO FRONTEND E UX OPERACIONAL

## 70. Objetivo

Reduzir perda de trabalho, ambiguidades de estado e erros de operação.

## 71. Autosave

Exibir estados inequívocos:

`Salvando`

`Salvo`

`Alterações pendentes`

`Sem conexão`

`Erro ao salvar`

`Conflito detectado`

## 72. Cenários obrigatórios

1. Internet cai durante edição.
2. API retorna 500.
3. API retorna 409.
4. Nonce expira.
5. Sessão expira.
6. Usuário volta a ficar online.
7. Duas abas editam a mesma turma.
8. Usuário tenta fechar página com alterações não persistidas.

## 73. Acessibilidade

Executar revisão de teclado, foco, labels, contraste, mensagens de erro, modais e tabelas.

## 74. Critério de aceite da Fase 11

O usuário sempre consegue distinguir estado salvo de estado pendente e recebe caminho seguro para resolver conflito.

# FASE 12. BANCO E ARQUITETURA 3.0

## 75. Objetivo

Preparar o produto para dashboards, relatórios, volume maior e integrações futuras sem reconstrução imediata de tudo.

## 76. Estratégia híbrida

Manter snapshots JSON para histórico, mas avaliar normalização de entidades operacionais:

`ce_turmas`

`ce_turma_itens`

`ce_encontros`

`ce_cursos`

`ce_unidades`

`ce_pessoas`

`ce_versoes`

`ce_log`

`ce_avisos`

## 77. Condição para normalização

A normalização só deve ocorrer se houver benefício comprovado para consultas, dashboard, integrações ou desempenho. Não realizar migração apenas por preferência arquitetural.

## 78. Migrações versionadas

Toda alteração de schema deve ter:

1. Identificador de migração.
2. Versão de origem.
3. Versão de destino.
4. Operação de upgrade.
5. Teste com cópia de banco real anonimizada.
6. Plano de rollback ou restauração.

## 79. Critério de aceite da Fase 12

Dados históricos e operacionais continuam íntegros após upgrade e consultas principais mantêm ou melhoram desempenho.

# FASE 13. PRIVACIDADE, RETENÇÃO E CICLO DE VIDA

## 80. Objetivo

Formalizar o tratamento dos dados mantidos pelo plugin.

## 81. Pontos obrigatórios

1. Identificar dados pessoais armazenados.
2. Definir motivo operacional para cada dado.
3. Definir política de retenção.
4. Definir comportamento de desinstalação.
5. Documentar backup e descarte.
6. Avaliar integração aos mecanismos nativos de exportação e apagamento de dados do WordPress.
7. Garantir que logs não armazenem senhas, tokens ou conteúdo secreto.

## 82. Uninstall

Manter dados por padrão pode continuar sendo uma decisão, desde que documentada. Se houver opção de remoção, ela deve exigir confirmação explícita e procedimento seguro.

## 83. Critério de aceite da Fase 13

Existe política documentada e comportamento técnico compatível com ela.

# FASE 14. DOCUMENTAÇÃO FINAL E ENTREGA

## 84. Documentos obrigatórios

Criar ou atualizar:

`README.md`

`docs/ARCHITECTURE.md`

`docs/SECURITY.md`

`docs/PERMISSIONS.md`

`docs/DATABASE.md`

`docs/API.md`

`docs/BACKUP-RESTORE.md`

`docs/DEPLOYMENT.md`

`docs/TESTING.md`

`docs/OPERATIONS.md`

`docs/INCIDENT-RESPONSE.md`

`CHANGELOG.md`

## 85. Matriz de permissões final

A documentação deve declarar explicitamente quem pode ver, editar, validar, gerenciar usuários, alterar catálogo, importar, exportar e administrar o sistema.

## 86. Evidências finais

A entrega final deve conter:

1. Código fonte.
2. Plugin empacotado.
3. Tema empacotado.
4. Relatório de testes.
5. Relatório de segurança.
6. Resultado dos testes E2E.
7. Resultado dos testes de dependência.
8. Lista de migrações aplicadas.
9. Changelog.
10. Instruções de instalação, atualização e rollback.

# 87. Matriz mínima de testes de segurança

| Código | Cenário | Resultado esperado |
| --- | --- | --- |
| SEC-001 | Anônimo chama bootstrap | Negado |
| SEC-002 | Consulta cria turma | Negado |
| SEC-003 | Consulta altera turma | Negado |
| SEC-004 | Coordenador A acessa turma B | Negado |
| SEC-005 | Coordenador altera campo da equipe | Ignorado ou negado conforme contrato |
| SEC-006 | Auxiliar valida sem permissão | Negado |
| SEC-007 | Editor WordPress tenta administrar sistema | Negado |
| SEC-008 | Usuário inativo usa sessão anterior | Negado |
| SEC-009 | Usuário inativo recebe notificação | Não recebe |
| SEC-010 | Link de senha solicitado | Resposta não contém token ou URL |
| SEC-011 | Nonce inválido | Negado |
| SEC-012 | Revisão antiga salva dados | HTTP 409 |
| SEC-013 | ID de outra unidade em URL | Negado |
| SEC-014 | Payload com campo não permitido | Rejeitado ou descartado por schema |
| SEC-015 | Payload acima do limite | Rejeitado |
| SEC-016 | Importação sem capability | Negado |
| SEC-017 | Exportação sem capability | Negado |
| SEC-018 | Tentativas excessivas de reset | Rate limit |

# 88. Matriz mínima de testes funcionais

| Código | Cenário | Resultado esperado |
| --- | --- | --- |
| FUN-001 | Criar solicitação | Estado correto |
| FUN-002 | Iniciar elaboração | Estado correto || FUN-003 | Enviar para validação | Prazo correto |
| FUN-004 | Unidade editar campos permitidos | Persistência correta |
| FUN-005 | Unidade tentar campo proibido | Não altera |
| FUN-006 | Validar | Snapshot e estado consistentes |
| FUN-007 | Reabrir | Nova versão e prazo corretos |
| FUN-008 | Concorrência | 409 sem perda silenciosa |
| FUN-009 | Histórico | Sequência correta |
| FUN-010 | Exportar | Backup válido |
| FUN-011 | Simular importação | Nenhuma mutação |
| FUN-012 | Importar | Atomicidade |
| FUN-013 | Falha SMTP | Operação principal preservada |
| FUN-014 | Feriado local | Prazo correto |
| FUN-015 | Feriado sábado com encontro | Alerta gerado |
| FUN-016 | Postagem de nota | Calendário institucional respeitado |

# 89. Matriz mínima de testes de datas

Devem existir testes automatizados para datas válidas e inválidas, viradas de mês e ano, bissexto, finais de semana, feriados nacionais, locais e períodos de férias.

# 90. Política de regressão

Antes de cada merge executar novamente toda a suíte crítica das fases anteriores. A aprovação de uma fase não elimina sua verificação nas fases seguintes.

Exemplo: depois de concluir importação, continuar executando testes de autorização, calendário e concorrência.

# 91. Política de rollback

Toda versão que altera banco deve possuir backup e procedimento de restauração testado em staging antes da publicação.

Não executar downgrade destrutivo automaticamente.

# 92. Definição de pronto para produção

O sistema só deve ser considerado pronto para produção institucional quando:

1. Todas as fases classificadas como P0 e P1 estiverem concluídas.
2. Suíte PHP estiver aprovada.
3. Build TypeScript estiver aprovado.
4. Lint estiver aprovado.
5. E2E estiver aprovado em WordPress e MariaDB reais.
6. Matriz de segurança estiver aprovada.
7. Testes de concorrência estiverem aprovados.
8. Backup e restauração estiverem testados.
9. Staging estiver aprovado.
10. Procedimento de rollback estiver documentado.
11. Não existirem vulnerabilidades críticas conhecidas nas dependências usadas no release.
12. Permissões e política de contas estiverem documentadas.

# 93. Ordem de implementação consolidada

A ordem obrigatória será:

Fase 0, baseline e ambiente.

Fase 1, segurança e privilégios.

Fase 2, contratos e validação de dados.

Fase 3, calendário.

Fase 4, transações e integridade.

Fase 5, backup e restauração.

Fase 6, auditoria.

Fase 7, notificações.

Fase 8, hardening de infraestrutura.

Fase 9, observabilidade.

Fase 10, CI/CD e qualidade.

Fase 11, resiliência e UX.

Fase 12, arquitetura 3.0 quando justificada.

Fase 13, privacidade e retenção.

Fase 14, documentação e entrega.

# 94. Regra para execução assistida do projeto

Ao implementar esta especificação, o trabalho deve seguir continuamente de uma fase aprovada para a próxima, sem solicitar confirmação entre passos técnicos rotineiros. Deve haver interrupção somente quando surgir decisão de negócio não dedutível do sistema, risco de perda de dados que exija autorização explícita, credencial externa necessária, ou limitação técnica que impeça validar corretamente o resultado.

Antes de entregar uma versão, devem ser apresentados apenas resultados que já tenham sido testados no nível aplicável. Itens não executáveis no ambiente disponível devem ser marcados claramente como bloqueados e não podem ser apresentados como aprovados.

# 95. Resultado esperado

Ao final, o projeto deve possuir segurança baseada em menor privilégio, autorização por operação e objeto, recuperação de senha sem exposição de token, dados validados por contrato, calendário consistente entre backend e frontend, operações críticas transacionais, importação reversível, auditoria administrativa, notificações idempotentes, observabilidade, pipeline de qualidade, testes de regressão e documentação suficiente para manutenção por outra equipe sem depender do conhecimento informal dos desenvolvedores atuais.