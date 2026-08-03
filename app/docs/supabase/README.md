# Lumipost.ai com Supabase — guia de implementação

Este conjunto de documentos descreve como transformar a SPA mockada atual em um SaaS persistente, com autenticação, banco, arquivos, créditos, geração de conteúdo e publicação agendada.

Para executar esta arquitetura com Claude Code, use o [pacote de implementação ponta a ponta](../claude/README.md) e as regras permanentes do `CLAUDE.md` na raiz do projeto.

Data da revisão técnica: **1º de agosto de 2026**. Preços, nomes de modelos e limites de provedores mudam; confirme-os antes de contratar ou colocar em produção.

## Decisão recomendada

- **Frontend:** manter React, Vite, TypeScript, Redux Toolkit e React Router.
- **Fonte de verdade:** Supabase Postgres. Redux passa a ser cache e estado de interface, não banco.
- **Autenticação:** Supabase Auth.
- **Arquivos:** Supabase Storage privado com URLs assinadas.
- **Operações sensíveis:** Supabase Edge Functions.
- **Trabalhos assíncronos:** Supabase Queues (`pgmq`) + workers idempotentes.
- **Agendamentos recorrentes:** Supabase Cron (`pg_cron`).
- **Texto e planejamento:** OpenAI API, começando por `gpt-5-mini` para volume e custo controlado.
- **Imagem:** GPT Image 2 em qualidade baixa/média, sempre atrás de um adaptador substituível.
- **Vídeo:** adaptador `VideoGenerationProvider`; Higgsfield somente após confirmar acesso comercial/programático adequado. A documentação pública oficial encontrada oferece MCP/CLI, mas não um contrato HTTP público estável para integração direta no backend do SaaS.
- **Publicação social:** outro adaptador, inicialmente Meta/Instagram. Tokens nunca ficam no navegador.
- **Pagamentos:** Supabase não processa pagamentos. Usar Stripe, Mercado Pago ou Pagar.me por adaptador e webhook assinado.

## Ordem de leitura

1. [Arquitetura](./01-arquitetura.md)
2. [Modelo de dados](./02-modelo-de-dados.md)
3. [Auth, RLS e Storage](./03-auth-rls-storage.md)
4. [Rotinas, filas e webhooks](./04-rotinas-filas-webhooks.md)
5. [IA: OpenAI e Higgsfield](./05-integracoes-ia.md)
6. [API e Edge Functions](./06-api-edge-functions.md)
7. [Custos, segurança e observabilidade](./07-custos-seguranca-observabilidade.md)
8. [Plano de migração](./08-roadmap-implementacao.md)
9. [Blueprint SQL inicial](./09-blueprint-sql.md)
10. [Deploy real com Meta e Stripe](./10-deploy-meta-stripe.md)
11. [Estado de produção e pendências externas](./11-status-producao.md)

## Limites de responsabilidade

O cliente pode consultar e editar dados normais usando `supabase-js`, desde que protegidos por RLS. As ações abaixo devem passar obrigatoriamente por Edge Function ou worker:

- conceder, reservar, consumir, estornar ou comprar créditos;
- chamar OpenAI, Higgsfield, pagamento ou rede social;
- alterar papéis de usuário, planos e preços;
- assinar URLs de objetos de terceiros;
- confirmar uma semana inteira de forma atômica;
- publicar, reprocessar ou cancelar itens da fila;
- processar webhooks.

## Fontes oficiais consultadas

- [Supabase: Row Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security)
- [Supabase: gerenciamento de usuários](https://supabase.com/docs/guides/auth/managing-user-data)
- [Supabase: Storage e controle de acesso](https://supabase.com/docs/guides/storage/security/access-control)
- [Supabase: Queues](https://supabase.com/docs/guides/queues)
- [Supabase: Cron](https://supabase.com/docs/guides/cron)
- [Supabase: Edge Functions](https://supabase.com/docs/guides/functions)
- [Supabase: secrets de Edge Functions](https://supabase.com/docs/guides/functions/secrets)
- [OpenAI: GPT-5 mini](https://developers.openai.com/api/docs/models/gpt-5-mini)
- [OpenAI: GPT Image 1 mini](https://developers.openai.com/api/docs/models/gpt-image-1-mini)
- [OpenAI: guia de geração de imagens](https://developers.openai.com/api/docs/guides/image-generation)
- [Higgsfield: integração MCP oficial](https://higgsfield.ai/claude-ai-video-generator)
- [Higgsfield: termos que abrangem API, MCP e CLI](https://higgsfield.ai/terms-of-use-agreement)
