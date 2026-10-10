# Requisitos adicionais antes da homologação — datas e Ambientação

## R01 — Recalcular a partir de início e término da turma
**Problema confirmado no código:** `fimManual` é persistido na turma, mas `compute(t, curso, feriados)` não utiliza esse campo. Alterar a data final apenas muda a indicação visual; não redistribui as UCs.

**Aceite obrigatório (ainda NÃO implementado):**
1. Botão explícito **Recalcular cronograma**, após definir início e término.
2. Simulação prévia sem alterar dados, com identificação de conflitos com feriados, limites de dias por modalidade, datas já fixadas e capacidade pedagógica.
3. Distribuir UCs **dentro** do intervalo solicitado quando matematicamente possível, preservando carga horária e regras específicas de cada um dos cinco modelos.
4. Quando impossível, exibir motivo e alternativas; não reduzir horas ou deslocar datas silenciosamente.
5. Pedir confirmação para substituir datas existentes de encontros/síncronos; salvar uma operação coerente com rollback/versão e validar término final.
6. Testes automatizados dos cinco modelos, feriados por unidade, datas impossíveis, início depois do término, conflitos de encontros e cenários sem folga.

## R02 — Ambientação manual fora da carga horária
**Implementação inicial:** commit `bf4251035007d9d3c63c4a82750c59549cbdb5fa` acrescenta Ambientação zero-hora ao criar curso e permite adicionar uma vez por curso existente. Usa tipo `intro`, já excluído da soma `sumUC` e `chTotal`.

**Aceite obrigatório (parcialmente implementado):**
1. Todo curso novo apresenta Ambientação; cursos existentes devem exibi-la uma vez, com migração ou regularização sem criar duplicatas.
2. Datas e descrição da Ambientação são **manuais**; não adicionar horas ao total, nem inferir duração automaticamente.
3. Ambientação aparece no cronograma e nas exportações, com indicação explícita de CH não computada.
4. Sem alterar automaticamente cursos e turmas homologados ou recalcular suas datas de forma inesperada.
5. Validar fontes de entrada, API PHP, backup/restauração e cinco formatos exportados, além da UI.

**Status:** implementação inicial, testes estáticos; falta contrato completo de calendário manual e migração de cursos existentes.

## Bloqueio de release
**Não aprovar G4/G5 nem publicar versão final** sem fechar R01 e R02, executar CI e homologar em staging. Os requisitos foram incluídos após início da etapa 9; portanto etapa 9 não está concluída.
