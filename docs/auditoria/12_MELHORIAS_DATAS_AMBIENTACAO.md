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

## Implementação técnica — complementação em 09/10/2026
- Recálculo: `simularRecalculoPeriodo` determina viabilidade mantendo durações e feriados, retrocede a partir da data final e distribui folgas entre etapas intermediárias quando cabíveis. O botão **Recalcular cronograma até o término** executa prévia, verifica conflitos, pede confirmação e recalcula encontros presenciais e síncronos.
- Persistência: as etapas podem armazenar `inicioPlanejado`; o PHP passa a validar o formato/data em `Cronograma_EAD_Store::sanitize_turma`. Mudança no início da turma limpa marcos calculados, mas preserva a Ambientação manual.
- Ambientação: criação automática em cursos novos como etapa `intro` com CH zero, regularização em lote de cursos antigos mediante confirmação, data manual no cronograma, preservação no recálculo e exclusão da soma curricular.
- Regressões: `tests/end-date-ambientacao.mjs` testa os cinco modelos, carga horária integral e limites de intervalo; `tests/catalog-contract.php` verifica a sanitização e a rejeição de datas inválidas.
- Limite funcional: o redistribuidor conservador não compacta duração pedagógica, não muda horas, não resolve intervalos inviáveis e pode deixar folgas explícitas. Deve apresentar impedimento, não falsificar término.
- **Homologação:** mudanças implementadas em desenvolvimento; somente marcar como validadas após CI verde e testes operacionais em staging com cursos reais e exportação final. Nenhum deploy de produção foi feito.

## Novidade — dias de encontros configuráveis por turma (todos os modelos)
- Causa: o preset de Qualificação usa sábado como dia permitido para presencial, tornando inválidos encontros agendados em dias úteis quando a turma segue outra organização.
- Solução: na aba Dados da turma, painel **Dias permitidos nesta turma**, configurar separadamente presencial, síncrono e estudo EaD usando seletores de domingo a sábado. A personalização é salva em `personalizarCronograma` e `configuracaoCronograma`, campos já aceitos pelo backend; os defaults do curso são mantidos quando a turma não personaliza.
- O botão **Restaurar dias do curso** remove apenas as escolhas semanais da turma, sem apagar outras regras customizadas; não se permite lista vazia.
- Ao alterar os dias, datas de encontros já digitadas podem exigir recálculo ou correção manual; as alterações nos dias não são autorização para sobrescrever datas automaticamente.
- Teste `tests/schedule-profiles.mjs` amplia a validação para os cinco modelos e garante que o curso original não é alterado.
- Homologação visual e regressão completa ainda dependem do CI da alteração e de testes em WordPress/staging.
