# Registro de validação E2E — rodada 182

Data: 09/10/2026

## Execução observada

GitHub Actions: https://github.com/euriconetoia-cmyk/Cronograma-SENAI-WP/actions/runs/37970106625
SHA: 987c294ad13f345a08fcaed8bccc2f42b224022a
Na última consulta, execução **em andamento**, release-gate em andamento, PHPCS e PHPStan concluídos com sucesso.

## Diagnóstico adicional confirmado por inspeção de código

O teste tests/e2e.mjs verifica a página anônima procurando a expressão antiga `Entre com seu usuário`. Porém class-shortcode.php implementa um gateway de login institucional com `ce-login-gateway`, o título Cronogramas EaD e instrução para usar usuário ou e-mail institucional. Assim, a asserção textual está desatualizada. Isso explica a falha reportada pela rodada 178 sem, por si, indicar que o acesso anônimo está liberado.

**Teste recomendado:** exigir resposta HTTP 200, presença da marcação `ce-login-gateway`, instrução de autenticação e ausência da configuração autenticada `CRONOGRAMA_EAD`. Não afrouxar a checagem para simples status 200.

## Estado

Uma tentativa de atualizar o arquivo de teste encontrou bloqueio da ferramenta de escrita; o arquivo `tests/e2e.mjs` **não foi alterado neste avanço**. A correção deve ser aplicada por edição segura e o CI deve ser executado novamente antes de considerar a etapa concluída.
