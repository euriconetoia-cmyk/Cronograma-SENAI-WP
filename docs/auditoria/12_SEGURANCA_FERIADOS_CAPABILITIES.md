# Segurança — permissão da configuração de feriados (SEC-001)

Data: 09/10/2026
Branch: release/2.21.0-modelos

## Evidências
- `Cronograma_EAD_Roles::CAP_CONFIG` existe, mas é concedida apenas ao administrador no mapeamento padrão; a equipe operacional recebe `CAP_CATALOG`, não `CAP_CONFIG`.
- As duas rotas `GET/POST /feriados/config` eram protegidas por `can_manage_catalog`, embora tratem a configuração da integração e de credencial municipal.
- A rota `/saude` já empregava `can_configure`.

## Alterações aplicadas
- Commit `80085c74543ac8f483213dfb508409b5e1ee7d96`: `/feriados/config` exige `can_configure` em GET e POST.
- Commit `ed5102437e86a1047b43b8e089cc2800647a0b0c`: asserção adicional em `tests/security-static.mjs`, exigindo a permissão específica nas duas operações.

## Critérios de aceite / limitações
- Administrador com CAP_CONFIG pode consultar e salvar a configuração.
- Equipe operacional com CAP_CATALOG, sem CAP_CONFIG, deve receber HTTP 403 nessas duas rotas. Isso é uma **mudança intencional de permissões** e precisa ser comunicado e homologado.
- Rotas de consulta de feriados locais e municípios permanecem sob CAP_CATALOG; não foram alteradas neste incremento.
- O teste estático não substitui E2E por perfis; o CI do commit novo precisa ser aprovado.
- Revisar UX da página Feriados: usuários sem CAP_CONFIG não devem ver formulário de configuração indisponível sem orientação.

## Infraestrutura CI
O CI #206 falhou devido a limite de `docker compose pull` (HTTP toomanyrequests / Docker Hub unauthenticated pull rate limit). PHPCS, PHPStan, TypeScript e builds de frontend passaram; E2E não iniciou. Não classificar isso como regressão de aplicativo.

Estado: segurança de rota **implementada**; E2E e homologação de permissões **pendentes**.


## Homologação por perfis — incremento seguinte
- CI #212: **SUCCESS**, com PHPCS, PHPStan, release-gate, empacotamento e upload de artefatos aprovados. URL: https://github.com/euriconetoia-cmyk/Cronograma-SENAI-WP/actions/runs/38002754809.
- Commit `35e70237d39550075bb3eaf5957010095caa53eb`: adicionada cobertura E2E no WordPress descartável para GET de configuração pelo administrador (200), rejeição GET/POST para coordenador, auxiliar e consulta (403), e rejeição para equipe operacional com CAP_CATALOG sem CAP_CONFIG (403). Não envia chave real; utiliza valor vazio nos testes de operações proibidas.
- **Validação ainda pendente:** CI desse novo commit. O teste não cobre edição bem-sucedida pelo administrador nem revogação de acesso durante a sessão; devem ser testados separadamente em banco descartável.
- Compatibilidade: a equipe operacional deixa de ter permissão para consultar a configuração; a interface deve refletir o bloqueio e informar quando é necessária intervenção administrativa.
