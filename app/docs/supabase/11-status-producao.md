# 11 — Estado de produção e pendências externas

Atualizado em **1º de agosto de 2026** para o projeto Supabase `djddjdjoarrwjiwqsnoa` e o frontend `https://lumipost-ai.vercel.app`.

## O que já está ativo

| Área | Estado | Observação |
| --- | --- | --- |
| Supabase Auth | Ativo | Email/senha e callback OAuth reais; sessão gerenciada pelo cliente oficial e Redux sem JWT. |
| Banco e RLS | Ativo | 25 tabelas, 8 migrations, isolamento por organização, registros financeiros imutáveis e buckets privados. |
| Créditos | Ativo | Saldo autoritativo no Postgres, débito atômico e sincronização Realtime para o Redux. |
| Agendamento manual | Ativo | Cobra exatamente 2 créditos e cria job/conteúdo na mesma transação idempotente. |
| Edge Functions | Ativo | 18 funções implantadas; separação entre JWT, assinatura Stripe e segredo do worker. |
| Worker de publicação | Ativo | `pg_cron` executa a cada minuto; segredo no Vault; teste autenticado retornou HTTP 200. |
| Vercel | Ativo | Produção usa URL, publishable key e modo Supabase. |
| Templates | Ativo | 728 JSONs com IDs únicos persistidos no catálogo e no Storage privado. |
| Login Google | Código e callbacks prontos | Falta cadastrar Client ID/secret do Google no provedor do Supabase. |
| Stripe | Código pronto | Falta cadastrar credenciais, Price IDs e endpoint de webhook na conta Stripe do proprietário. |
| Meta/Instagram | Código pronto | Falta criar/configurar o app Meta, escolher uma versão suportada do Graph API e concluir permissões/App Review. |
| Análise da identidade | Código pronto | Falta `OPENAI_API_KEY`; a chamada usa `store: false` e saída estruturada validada. |

## Segredos ainda exigidos

Insira diretamente em **Supabase → Edge Functions → Secrets**. Nunca envie esses valores pelo chat e nunca use prefixo `VITE_`:

- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `STRIPE_PRICE_MONTH`
- `STRIPE_PRICE_YEAR`
- `STRIPE_PRICE_CREDITS_50`
- `STRIPE_PRICE_CREDITS_150`
- `STRIPE_PRICE_CREDITS_400`
- `META_INSTAGRAM_APP_ID`
- `META_INSTAGRAM_APP_SECRET`
- `META_GRAPH_VERSION`
- `OPENAI_API_KEY`

O Google OAuth não usa Edge Function Secret. Cadastre o Client ID e o Client
Secret diretamente em **Authentication → Sign In / Providers → Google**. No
Google Cloud, a URI autorizada do cliente deve ser:

```text
https://djddjdjoarrwjiwqsnoa.supabase.co/auth/v1/callback
```

As URLs de retorno da aplicação já estão permitidas no Supabase:

```text
https://lumipost-ai.vercel.app/auth/callback
http://localhost:5173/auth/callback
```

Os demais segredos internos e URLs do ambiente já foram configurados. O token temporário usado apenas para implantar as funções foi revogado após o deploy.

## Endpoints externos

```text
Stripe webhook
https://djddjdjoarrwjiwqsnoa.supabase.co/functions/v1/billing-webhook

Meta OAuth redirect
https://djddjdjoarrwjiwqsnoa.supabase.co/functions/v1/meta-oauth-callback
```

## Estado da revisão de segurança

- Security Advisor do Supabase: **0 erros**.
- Security Advisor: **1 aviso**, referente à proteção de senhas vazadas disponível apenas no plano Pro do Supabase.
- As RPCs públicas agora são `SECURITY INVOKER`. Operações privilegiadas ficam em `app_private`, fora do schema exposto, com execução limitada a `authenticated`, `search_path` vazio e validação de `auth.uid()`/organização.
- Senha mínima: 8 caracteres; rotação de refresh token e reautenticação para troca de senha estão ativas.
- Funções financeiras de concessão/consumo por serviço aceitam somente `service_role`.
- Buckets são privados; o worker emite URL assinada curta apenas na hora da publicação.
- Nenhuma revisão permite prometer ausência absoluta de vulnerabilidades. Antes de ativar dinheiro real e App Live, execute os cenários adversariais do runbook 10 e configure monitoramento/alertas.

## Verificações executadas

```text
TypeScript: aprovado
ESLint: aprovado
Vitest: 3 arquivos / 11 testes aprovados
Vite production build: aprovado
Deno check das Edge Functions: aprovado
Funções Supabase: 18 ACTIVE
Endpoint protegido sem JWT: HTTP 401
Worker com segredo inválido: HTTP 401
Worker com segredo correto: HTTP 200
Vercel /entrar: smoke test aprovado
Catálogo remoto: 728/728 templates
Contas Auth com workspace: 1/1 (backfill idempotente aplicado)
```

O `npm audit` ainda sinaliza o advisory de CSRF no modo RSC do React Router. Esta aplicação é uma SPA Vite cliente e não usa RSC nem Server Actions; a versão pública mais recente de `react-router-dom` continua afetada pelo intervalo do advisory. Acompanhe o release corrigido e atualize quando existir, sem aplicar o downgrade forçado sugerido pelo npm.
