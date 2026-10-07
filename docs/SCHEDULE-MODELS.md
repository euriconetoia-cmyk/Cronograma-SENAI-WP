# Modelos de Cronograma

O Schedule Engine 2.0 utiliza presets de regras. O modelo define defaults, mas cada curso pode sobrescrever regras sem duplicar o motor.

## Técnico

Preserva o fluxo anterior: carga EaD calculada por divisor, encontros presenciais derivados da CH presencial e sábado como dia padrão.

## Qualificação

É o fallback de compatibilidade para cursos antigos. Mantém cálculo EaD por divisor e encontros presenciais pela carga presencial.

## Distribuição Diária

O número de dias é calculado por `ceil(CH EaD / cargaDiaria)`. O valor padrão é 3 horas/dia e pode ser configurado por curso ou etapa.

## Aprendizagem

Permite UCs 100% EaD com momentos síncronos. A quantidade de síncronos pode ser definida por UC, sem transformar essas horas em CH presencial. O preset admite Prática Profissional na Empresa como etapa específica.

## Personalizado

Parte do comportamento compatível com Qualificação e permite sobrescrever carga diária, dias permitidos, presencial, síncrono e prática.

## Herança

A resolução segue: preset do modelo, configuração do curso e configuração da etapa. A configuração mais específica vence. Cursos existentes sem `modeloCronograma` são lidos como `qualificacao`.

## Eventos pedagógicos

O contrato suporta eventos: `estudo_ava`, `sincrono`, `presencial`, `web_aula`, `atendimento`, `atividade`, `recuperacao`, `pratica_empresa`, `matricula`, `postagem_notas`, `inicio_curso`, `fim_curso`, `inicio_modulo` e `fim_modulo`.
