# 02 — Especificação técnica de melhorias (versão inicial condicionada)

Projeto: Cronogramas EaD — Unidigit@l / SENAI
Data: 09/10/2026
Branch: release/2.21.0-modelos
Status: DRAFT — planejamento, sem autorização de alteração funcional ou release.

## Premissas
Fonte de priorização: docs/auditoria/03_MATRIZ_PRIORIZACAO.md.
Fontes técnicas: docs/auditoria/07_ETAPA_6_DIAGNOSTICO_PRELIMINAR.md, 08_ETAPA_7_BANCO_INTEGRIDADE_PRELIMINAR.md, 09_ETAPA_8_TESTES_QUALIDADE_PRELIMINAR.md e documento de continuidade do projeto.

Não presumir desempenho, gravidade, incidente, falha em produção, nem resultados de CI não coletados. Implementar em incrementos pequenos com testes antes/depois, staging isolado e rollback preparado.

## Pacote A — confiabilidade de testes (TEST-001)
**Motivo:** Assert em tests/e2e.mjs contém tautologia `x.turmaId===ID||true`.
**Requisito:** Substituir por teste com escopo verificável, conjunto conhecido de turmas pertencentes e não pertencentes à unidade; diferenciar retorno vazio de filtro autorizado; preservar os testes já existentes.
**Aceite:** Prova de que um retorno contendo turma não autorizada reprova o teste; retorno válido aprova; CI executa o teste no WordPress isolado.
**Regressão:** escopo por unidade, perfis consulta/equipe, atividade e histórico.
**Dependências:** fixture isolada e testes realmente executados.

## Pacote B — atomicidade e concorrência do catálogo (DB-007, FUN-009)
**Motivo:** JSON e revisão são persistidos em opções separadas, com transient usado como lock.
**Requisito condicional:** após reproduzir corridas/falhas, definir mecanismo de exclusão e atualização com garantias verificáveis; preservar contrato da API e conflitos HTTP 409.
**Aceite:** duas gravações concorrentes não causam perda silenciosa de alteração; falha após persistência parcial não deixa catálogo/revisão incoerentes; tentativa obsoleta produz 409; backup prévio/restauração testados.
**Regressão:** salvar cursos, pessoas, unidades e feriados; importação de backup; bootstrap; revisões.

## Pacote C — restauração segura (DB-004, FUN-010)
**Motivo:** limpeza e restauração abrangem turmas, avisos, versões e log.
**Requisito condicional:** validar escopo da transação real, compatibilidade de tabelas e a política de reversão da camada de serviço antes de alterar implementação.
**Aceite:** checksum, simulação e token conferidos; dados idênticos ao snapshot nos campos contratualmente protegidos; interrupções em cada fase preservam o estado anterior; operações não autorizadas bloqueadas.
**Regressão:** versões, histórico, permissões e auditoria.

## Pacote D — autorização e segredos (SEC-001, SEC-002, SEC-006)
**Requisito:** separar permissão de configurar integrações da permissão de catálogo, se confirmada a incompatibilidade; impedir exposição da chave em REST, logs e exportações; documentar estratégia de secrets e confidencialidade de backups.
**Aceite:** matriz de permissões positiva/negativa por perfil, segredo não recuperável por usuário sem permissão, backup cifrado ou proteção externa conforme modelo de ameaça aprovado.
**Dependências:** homologar infraestrutura; não mover secrets sem migração e fallback seguros.

## Pacote E — contratos do motor (ARC-001/002, FUN-005)
**Requisito:** estabelecer backend como fonte normativa dos campos editáveis, com testes de contrato cobrindo técnico, qualificação, distribuição diária, aprendizagem e personalizado.
**Aceite:** ambos os lados rejeitam/aceitam as mesmas operações; campos não autorizados nunca persistem; geração e exportação dos cinco modelos mantidas.
**Dependências:** definir contrato canônico antes de refatorar.

## Pacote F — performance (PERF-001 a PERF-012)
**Requisito condicional:** coletar baseline do build WP, bootstrap e operações de edição; otimizar somente gargalos medidos.
**Aceite:** comparar antes/depois nos mesmos datasets e ambiente; ausência de regressões em autorização, salvamento e renderização; métricas e resultados documentados. Metas só depois de baseline.
**Alternativas a avaliar:** agregação de consultas da atividade, invalidação de fetch por mudança significativa, memoização seletiva, menor payload e tratamento assíncrono da sincronização, se medições justificarem.

## Pacote G — feriados e integrações (FUN-001 a FUN-004, FUN-007, PERF-008)
**Requisito:** verificar feriados nacionais, estaduais e municipais por fonte/UF/município e resolver falhas sem dados incorretos.
**Aceite:** evidência real de cobertura, erro visível e recuperação quando indisponível, sem sobrescrever dado institucional; códigos IBGE validados.

## Pacote H — UX e acessibilidade (UX-001)
**Requisito:** indicação textual de tipo de feriado e revisão de contraste, teclado, foco, leitores de tela, zoom e reflow.
**Aceite:** critérios aplicáveis de WCAG 2.2 AA comprovados por testes manuais e automatizados; não mudar fluxo funcional sem aceite.

## Ordem proposta e gates
0. Concluir auditoria 6–8, medir baseline, executar CI e confirmar P1.
1. Corrigir confiabilidade de testes; definir fixtures e aprovação de segurança.
2. Resolver riscos reproduzidos de integridade e backup.
3. Resolver autorização, contratos e feriados.
4. Otimizar somente gargalos comprovados.
5. Melhorar acessibilidade e UX.
6. Homologar com perfis reais anonimizados, exportar ZIP de teste, revisar regressões, documentar rollback e só então planejar release.

## Evidências necessárias por mudança
ID, cenário reproduzível, arquivo/linha, evidência antes/depois, resultados de teste, impacto funcional, riscos, comandos de verificação, versão testada, aprovação e rollback.

## Não realizado
Nenhuma alteração no código do aplicativo, migração, build executado, teste real ou deploy. A especificação não declara Etapas 6–8 concluídas.
