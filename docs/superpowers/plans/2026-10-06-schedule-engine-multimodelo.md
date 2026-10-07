# Schedule Engine Multimodelo Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox syntax for tracking.

**Goal:** Suportar Técnico, Qualificação, Distribuição Diária e Aprendizagem no mesmo motor configurável, preservando os dados existentes.

**Architecture:** Introduzir resolução centralizada de perfil em `scheduleProfiles.ts`, estender os tipos persistidos de forma opcional e adaptar `schedule.ts` para consumir regras resolvidas. A interface de Cursos expõe presets e sobrescritas por UC, enquanto o estado de turma ganha eventos pedagógicos genéricos compatíveis com `enc`.

**Tech Stack:** React 19, TypeScript 6, WordPress/PHP 8.2+, Node 22 para testes com type stripping.

**Spec:** `docs/superpowers/specs/2026-10-06-schedule-engine-multimodelo-design.md`

## Global Constraints

- Compatibilidade retroativa é obrigatória.
- Nenhuma migração destrutiva de dados.
- Síncrono não depende de CH presencial.
- Datas sugeridas respeitam dias permitidos e feriados.
- Os quatro modelos devem ter testes automatizados.

## Review Focus

- Curso legado sem `modeloCronograma` deve continuar gerando encontros aos sábados.
- Aprendizagem com `pres=0` e síncronos configurados deve gerar eventos síncronos.
- Distribuição diária deve ignorar `div` quando `cargaDiaria` estiver definida.
- Sobrescrita por UC deve ter prioridade sobre o preset do curso.
- Dias permitidos vazios devem cair em defaults seguros, nunca gerar loop infinito.

### Task 1: Perfis e resolução de configuração
- [ ] Criar testes falhando para presets, legado e sobrescritas.
- [ ] Criar `ui/src/lib/scheduleProfiles.ts`.
- [ ] Fazer os testes passarem.

### Task 2: Integrar perfis ao cálculo do cronograma
- [ ] Criar testes falhando para dias de estudo e quantidades de eventos.
- [ ] Adaptar `ui/src/lib/types.ts` e `ui/src/lib/schedule.ts`.
- [ ] Fazer os testes passarem e executar regressão de calendário.

### Task 3: Configuração no cadastro de cursos
- [ ] Adicionar modelo e regras no `Cursos.tsx`.
- [ ] Permitir configuração de síncronos por UC e prática profissional.
- [ ] Validar estaticamente os campos e defaults.

### Task 4: Eventos pedagógicos na turma e visualização
- [ ] Adicionar evento genérico ao estado da turma.
- [ ] Fazer Aprendizagem usar síncronos na grade mesmo com CH presencial zero.
- [ ] Ajustar verificações de dia permitido e feriado.

### Task 5: Contrato backend e validação
- [ ] Atualizar sanitização/allowlist PHP para os novos campos opcionais.
- [ ] Adicionar testes PHP de preservação/limpeza do contrato.
- [ ] Executar sintaxe PHP e testes existentes.

### Task 6: Fixtures dos quatro modelos e documentação
- [ ] Criar fixtures/testes de regressão dos quatro modelos.
- [ ] Atualizar arquitetura, testing e changelog.
- [ ] Executar toda a suíte disponível e empacotar fonte candidata.
