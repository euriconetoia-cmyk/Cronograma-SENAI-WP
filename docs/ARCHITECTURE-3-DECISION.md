# ADR: normalização ampla do banco

Status: adiada de forma intencional.

A especificação permite a normalização da arquitetura 3.0 somente quando houver benefício comprovado. A versão atual não dispõe de métricas de produção que indiquem que o modelo híbrido seja gargalo de desempenho ou inviabilize relatórios necessários.

Decisão: manter snapshots JSON e tabelas operacionais atuais nesta entrega, adicionando índices, transações e auditoria. Antes de normalizar, coletar métricas de volume, latência e necessidades de BI. Se a mudança for justificada, criar migração versionada, executar sobre cópia anonimizada de banco real e comparar desempenho antes e depois.
