# Permissões

## Capabilities

| Capability | Uso |
| --- | --- |
| `cronograma_ead_ver` | Visualização permitida |
| `cronograma_ead_editar_turmas` | Edição de turmas |
| `cronograma_ead_validar` | Validação própria quando aplicável |
| `cronograma_ead_validar_em_nome` | Validação administrativa em nome da unidade |
| `cronograma_ead_gerir_catalogo` | Cursos, pessoas, unidades e feriados |
| `cronograma_ead_gerir_acessos` | Usuários do sistema |
| `cronograma_ead_exportar` | Exportação completa |
| `cronograma_ead_importar` | Importação completa |
| `cronograma_ead_configurar` | Configuração global e saúde |
| `cronograma_ead_auditar` | Trilha administrativa |

## Matriz operacional

| Perfil | Ver | Editar | Validar | Catálogo | Acessos | Exportar | Importar | Auditoria |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Consulta | Sim, unidade vinculada | Não | Não | Não | Não | Não | Não | Não |
| Auxiliar | Sim, unidade vinculada | Campos permitidos | Não | Não | Não | Não | Não | Não |
| Coordenador | Sim, unidade vinculada | Campos permitidos | Sim, quando marcado como validador | Não | Não | Não | Não | Não |
| Equipe | Sim, todas | Sim | Em nome da unidade conforme regra | Sim | Sim | Sim | Sim | Sim |
| Administrador | Sim | Sim | Sim | Sim | Sim | Sim | Sim | Sim |
| Editor WordPress | Não automaticamente | Não | Não | Não | Não | Não | Não | Não |

A autorização de objetos continua limitada pela unidade. Alterar IDs na URL ou no JSON não deve ampliar a visibilidade do usuário.
