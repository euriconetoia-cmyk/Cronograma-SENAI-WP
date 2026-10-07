# Changelog

## 2.21.0-rc1 — Interface orientada por modelo

- Interface de cursos orientada ao modelo de cronograma.
- Badge visível para Técnico, Qualificação, Distribuição Diária, Aprendizagem e Personalizado.
- Campos incompatíveis ocultos por padrão e modo de configurações avançadas.
- Resumo das regras efetivas antes da matriz curricular.
- Herança de regras curso → turma → UC.
- Personalização opcional por turma sem alterar o curso-base.
- Cronograma e cálculos usam a configuração efetiva da turma.
- Backend valida e persiste somente sobrescritas conhecidas de cronograma da turma.
- Novos testes de herança e regressão dos perfis.


## 2.20.0-rc1 - Schedule Engine Multimodelo

### Modelos de cronograma
- Presets oficiais para Técnico, Qualificação, Distribuição Diária e Aprendizagem.
- Perfil `personalizado` para combinações futuras sem criar outro motor.
- Compatibilidade retroativa: cursos sem perfil explícito usam o comportamento legado de Qualificação.

### Motor de cálculo
- Distribuição Diária calcula os dias pela carga diária configurada.
- Aprendizagem aceita momentos síncronos independentes da carga presencial.
- Dias permitidos por tipo de evento substituem a suposição fixa de sábado.
- Sugestões síncronas podem seguir sequência de dias permitidos; encontros presenciais mantêm distribuição compatível.
- Prática profissional é uma etapa própria e compõe a carga total quando tiver CH informada.

### Aprendizagem profissional
- Atendimento em duas fases: intensiva em dias úteis consecutivos e regular em dias da semana selecionados.
- Quantidade de dias úteis da fase intensiva configurável.
- Dias da semana da fase intensiva e da fase regular configuráveis separadamente.
- Horário e duração padrão da webaula configuráveis.
- Datas de webaulas calculadas automaticamente com feriados.
- Nova aba "Webaulas síncronas" no cronograma, com UC, sequência, data, dia, horário e fase.
- Cenário de regressão baseado no modelo Assistente Administrativo Amazonas, com início em 14/10/2026, 23 dias úteis intensivos e transição para segunda e terça após 16/11/2026.

### Interface e exportação
- Cadastro do curso recebe seletor de modelo, carga diária e regras de síncrono.
- UC permite informar quantidade de momentos síncronos.
- Aprendizagem permite adicionar Prática Profissional na Empresa.
- Cronograma, cartões, linha do tempo e exportações reconhecem momentos presenciais e síncronos.

### Contratos e testes
- Backend aceita `sin` e eventos pedagógicos tipados, mantendo limites e datas válidas.
- Regressão automatizada dos quatro modelos.
- Novos testes de perfis, motor multimodelo e contrato do catálogo.

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
