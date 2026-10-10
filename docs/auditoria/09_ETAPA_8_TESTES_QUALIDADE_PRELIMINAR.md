# Etapa 8 — Testes e qualidade — levantamento preliminar

Data: 09/10/2026
Branch: release/2.21.0-modelos
Estado: inspeção estática, sem execução de testes.

## Pipeline existente
- .github/workflows/ci.yml: push na release/main/master e pull_request, PHP 8.2, Composer, PHPCS, PHPStan, release-gate e pacote; publica artefatos de evidência quando aplicável.
- .github/workflows/test-package.yml: build:wp, PHP syntax, testes de calendário, catálogo, perfis e modelos, teste estático de segurança e ZIP de teste com unzip -t.
- A existência desses passos não comprova resultados de execuções recentes.

## Achado de eficácia de teste
- TEST-001 (confirmado no código de teste): em tests/e2e.mjs, a asserção para atividade da unidade usa `at.j.atividade.every(x=>x.turmaId===ID||true)`. O `||true` torna esse predicado sempre verdadeiro. Consequência: não valida o filtro pretendido. Proposta futura: reescrever o teste com expectativa verificável e fixture compatível; não corrigido nesta etapa.
- TEST-002 (escopo de cobertura): o mesmo teste contém um teste separado de não vazamento de turma entre unidades, que não sofre do problema acima. Portanto, TEST-001 não demonstra por si só falha da autorização da API.
- TEST-003 (falta de evidência): não há neste diagnóstico logs de CI recentes, métricas de bundle, relatório de cobertura nem ambiente WordPress executado. Não afirmar testes aprovados na revisão corrente.

## Plano de execução
1. Conferir status por commit SHA e anexar links de logs dos dois workflows.
2. Executar PHP lint, PHPCS, PHPStan, build do frontend, contratos e gates automatizados num runner configurado.
3. Executar E2E em instalação isolada de WordPress e banco descartável. O teste e2e altera catálogo, cria turmas e executa restauração, não deve rodar em produção.
4. Acrescentar validação de concorrência do catálogo, backup corrompido/grande, sessão expirada, sincronização de feriados e escopo regional.
5. Registrar evidências de comportamento com perfil equipe, unidade e consulta, incluindo acessibilidade e responsividade.
6. Antes de release, reparar testes incapazes de detectar regressões e executar nova bateria completa.

## Limite e estado
Não houve execução de testes neste turno. A Etapa 8 segue aberta e nenhuma nova versão está homologada.
