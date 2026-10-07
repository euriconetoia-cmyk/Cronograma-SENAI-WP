# Schedule Engine Multimodelo

## Objetivo

Evoluir o Cronogramas EaD para aceitar, no mesmo núcleo, os quatro formatos institucionais já identificados: Técnico, Qualificação, Distribuição Diária e Aprendizagem. A mudança deve preservar os cronogramas existentes e permitir novos perfis sem duplicação de lógica.

## Princípios

1. O motor recebe regras, não condicionais espalhadas por tipo de curso.
2. Cursos antigos sem perfil explícito continuam com comportamento equivalente ao atual.
3. Modalidade, modelo de cronograma e regra de execução são conceitos distintos.
4. Momentos síncronos são independentes da carga presencial.
5. Prática profissional é uma etapa explícita.
6. Dias permitidos são configuráveis por tipo de evento.
7. Feriados e bloqueios continuam sendo respeitados pelo motor.
8. O sistema mantém o campo `enc` por compatibilidade e acrescenta eventos pedagógicos genéricos.

## Perfis

- `tecnico`: EaD sequencial, encontros presenciais derivados da CH presencial, sábado como padrão de encontro.
- `qualificacao`: EaD sequencial, encontros presenciais opcionais e sábado como padrão compatível.
- `distribuicao_diaria`: distribuição por carga diária e dias letivos permitidos.
- `aprendizagem`: EaD sequencial, momentos síncronos independentes da CH presencial e suporte a prática profissional.
- `personalizado`: regras definidas integralmente no curso.

## Modelo de dados

`Curso.modeloCronograma` identifica o preset. `Curso.configuracaoCronograma` armazena regras resolvíveis de distribuição, presencial, síncrono, AVA e prática. `Item.configuracaoCronograma` permite sobrescrever regras por UC. `ItemTurma.eventos` guarda eventos pedagógicos, mantendo `enc` para compatibilidade com versões antigas.

## Eventos pedagógicos

Tipos iniciais: estudo AVA, síncrono, presencial, webaula, atendimento, atividade, recuperação, prática empresa, matrícula, postagem de notas e marcos de início/fim.

## Compatibilidade

Um curso sem `modeloCronograma` é normalizado para `qualificacao` com encontros presenciais aos sábados e cálculo EaD pelo divisor já existente. Nenhuma migração destrutiva é necessária.

## Interface

Cadastro de curso recebe seletor de modelo e configurações progressivas. Cada UC recebe quantidade e duração de síncronos, dias permitidos e marcação de prática quando aplicável. A tela do cronograma exibe eventos de instrução de forma compatível com a grade atual e passa a aceitar síncronos mesmo com CH presencial zero.

## Critérios de aceite

1. Os quatro presets produzem configuração válida.
2. Técnico e Qualificação preservam o comportamento de encontros presenciais por CH.
3. Distribuição Diária calcula dias pela carga diária do perfil.
4. Aprendizagem gera síncronos com CH presencial zero.
5. Dias permitidos controlam sugestões e verificações.
6. Prática profissional não entra como UC comum na soma de UCs, mas pode ter carga própria.
7. Dados antigos continuam calculando sem alteração manual.
8. Testes automatizados cobrem os quatro modelos e regressão do comportamento legado.
