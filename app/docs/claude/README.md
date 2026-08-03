# Pacote de execução para Claude Code

Estes documentos convertem a arquitetura de `docs/supabase` em tarefas implementáveis de ponta a ponta.

## Como usar

### Execução completa

Abra Claude Code na raiz do projeto e envie o conteúdo de [00 — Prompt mestre](./00-prompt-mestre.md). O `CLAUDE.md` da raiz será carregado como regra permanente.

### Execução com checkpoints

Para maior controle, envie uma fase por vez:

1. [Política de secrets](./01-politica-de-secrets.md)
2. [Fundação Supabase](./02-fundacao-supabase.md)
3. [Auth, organizações e RLS](./03-auth-organizacoes-rls.md)
4. [Storage e assets](./04-storage-assets.md)
5. [Domínio, planos e créditos](./05-dominio-planos-creditos.md)
6. [Jobs, OpenAI, imagens e vídeo](./06-jobs-e-ia.md)
7. [Planejamento e publicação](./07-planejamento-publicacao.md)
8. [Billing, admin, templates e prompts](./08-billing-admin.md)
9. [Migração do frontend](./09-migracao-frontend.md)
10. [Testes, CI/CD e deploy](./10-testes-deploy.md)
11. [Auditoria final de segurança](./11-auditoria-seguranca.md)
12. [Runbook operacional](./12-runbook-operacional.md)

## O que o Claude pode fazer autonomamente

- analisar e modificar o workspace;
- instalar dependências necessárias;
- criar migrations, funções, repositories e testes;
- executar Supabase local;
- criar documentação e arquivos de exemplo sem valores reais;
- preparar scripts e pipelines;
- implantar em staging quando o projeto/credenciais já estiverem configurados e o usuário autorizar.

## O que exige intervenção/autorização

- criar ou escolher projetos remotos Supabase;
- inserir secrets reais no Dashboard/CLI;
- escolher gateway de pagamento;
- contratar/obter API server-to-server do Higgsfield;
- criar apps Meta e conceder permissões sociais;
- aplicar migration destrutiva em produção;
- ativar cobrança, publicar conteúdo real ou fazer go-live.

## Regra de credenciais

Nunca cole uma chave em uma conversa com Claude. Insira-a diretamente no Supabase Dashboard em **Edge Functions → Secrets** ou em um arquivo temporário fora do repositório, criado e controlado por você. Claude deve trabalhar apenas com os nomes das variáveis.

## Resultado esperado

Ao fim, o mock é substituído por adapters Supabase, mantendo a arquitetura de use cases. Auth, marca, conteúdo, mídia, créditos, agenda, IA, templates, prompts, billing e admin persistem. Jobs são assíncronos, auditáveis e idempotentes.

## Documentação base

- [Arquitetura Supabase](../supabase/01-arquitetura.md)
- [Modelo de dados](../supabase/02-modelo-de-dados.md)
- [Auth/RLS/Storage](../supabase/03-auth-rls-storage.md)
- [Rotinas e filas](../supabase/04-rotinas-filas-webhooks.md)
- [Integrações de IA](../supabase/05-integracoes-ia.md)
- [Blueprint SQL](../supabase/09-blueprint-sql.md)

