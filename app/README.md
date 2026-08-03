# Lumipost.ai

SaaS de planejamento, geração e publicação de conteúdo para redes sociais. React + Vite + TypeScript + Redux no frontend; Supabase (Postgres + Auth + Storage + Edge Functions) como backend; OpenAI para geração de texto/imagem; Stripe para cobrança; Meta Graph API para publicar no Instagram/Facebook.

> Documentação completa de arquitetura em [`docs/supabase/README.md`](docs/supabase/README.md), runbook de deploy em [`docs/supabase/10-deploy-meta-stripe.md`](docs/supabase/10-deploy-meta-stripe.md) e estado atual/pendências do projeto hospedado em [`docs/supabase/11-status-producao.md`](docs/supabase/11-status-producao.md). Este README resume **quais chaves você precisa e onde configurar cada uma**.

## Como rodar localmente

```bash
npm install
cp .env.example .env                              # preencha com os valores do seu projeto Supabase
cp supabase/functions/.env.example supabase/functions/.env  # só para supabase start local
npm run dev
```

Comandos úteis: `npm run build`, `npm run typecheck`, `npm run lint`, `npm run test`.

Se estiver rodando o Supabase localmente (`supabase start`), as portas e serviços ficam definidos em [`supabase/config.toml`](supabase/config.toml).

## Regra de ouro dos secrets

- O navegador só pode receber **duas** variáveis: `VITE_SUPABASE_URL` e `VITE_SUPABASE_PUBLISHABLE_KEY`. Nunca coloque uma chave secreta em algo prefixado com `VITE_`.
- Toda chave de provedor (OpenAI, Stripe, Meta) vive em **Supabase Edge Function Secrets**, nunca no `.env` do frontend, no Git ou na Vercel.
- `.env`, `.env.*` e `supabase/functions/.env` já estão no `.gitignore` — só os `*.env.example` (com placeholders) podem ser commitados.
- Detalhes e classificação completa de cada secret: [`docs/claude/01-politica-de-secrets.md`](docs/claude/01-politica-de-secrets.md).

## 1. Frontend (Vercel / `.env`)

| Variável | Onde conseguir | Onde configurar |
|---|---|---|
| `VITE_SUPABASE_URL` | Supabase Dashboard → **Project Settings → API** → Project URL | Vercel → Project → Settings → Environment Variables, e `.env` local |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Supabase Dashboard → **Project Settings → API** → chave `publishable`/`anon` | Vercel → Project → Settings → Environment Variables, e `.env` local |

São públicas por natureza (o browser precisa delas), protegidas por RLS — nunca a `secret`/`service_role` key aqui.

## 2. Backend (Supabase Edge Function Secrets)

Configure em **Supabase Dashboard → Edge Functions → Secrets**, ou via CLI a partir de um arquivo fora do repositório:

```bash
npx supabase secrets set --env-file <caminho-fora-do-workspace>
```

A lista de nomes (sem valores) fica documentada em [`supabase/functions/.env.example`](supabase/functions/.env.example). Detalhe de cada uma:

### 2.1 Supabase (automáticas)

| Variável | Necessário configurar? |
|---|---|
| `SUPABASE_URL`, `SUPABASE_ANON_KEY`/`SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SERVICE_ROLE_KEY`/`SUPABASE_SECRET_KEY` | **Não.** O runtime das Edge Functions já injeta essas automaticamente. Não precisa criar como secret. |

### 2.2 OpenAI — geração de texto e imagem

| Variável | Onde conseguir | Usada em |
|---|---|---|
| `OPENAI_API_KEY` | [platform.openai.com](https://platform.openai.com/api-keys) → API keys | `ai-weekly-plan`, `ai-content-generate`, `ai-content-preview`, `brand-analyze-instagram`, `admin-api` (teste de prompt) |
| `OPENAI_IDENTITY_MODEL` | nome do modelo, ex. `gpt-5.6-terra` | análise de identidade/marca |
| `OPENAI_CONTENT_MODEL` | nome do modelo, ex. `gpt-5.6-terra` | legendas, planejamento semanal |
| `OPENAI_IMAGE_MODEL` | nome do modelo, ex. `gpt-image-2` | geração de imagem |

`gpt-5-mini` e `gpt-image-1-mini` (valores antigos) têm desligamento anunciado pela OpenAI para o final de 2026 — `gpt-5.6-terra` e `gpt-image-2` são os substitutos oficiais. Verifique a linhagem/preço atual em [developers.openai.com/api/docs/pricing](https://developers.openai.com/api/docs/pricing) antes de configurar, esse catálogo muda rápido.

### 2.3 Stripe — cobrança

| Variável | Onde conseguir |
|---|---|
| `STRIPE_SECRET_KEY` | [dashboard.stripe.com](https://dashboard.stripe.com/apikeys) → Developers → API keys |
| `STRIPE_WEBHOOK_SECRET` | Stripe → Developers → Webhooks → crie um endpoint apontando para `https://<seu-projeto>.supabase.co/functions/v1/billing-webhook` → copie o *signing secret* |
| `STRIPE_PRICE_MONTH` | Stripe → Product catalog → crie o Price do plano mensal → copie o `price_...` |
| `STRIPE_PRICE_YEAR` | idem, para o plano anual |
| `STRIPE_PRICE_CREDITS_50` / `_150` / `_400` | idem, um Price avulso (pagamento único) por pacote de créditos |

Eventos que o webhook precisa receber: `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `checkout.session.expired`, `invoice.paid`, `invoice.payment_failed`, `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`.

O preço mostrado no app (tabela `plans`/`credit_products`) é só exibição — **o valor realmente cobrado é o do Price configurado no Stripe**. Se mudar um preço em um lugar, mude no outro.

### 2.4 Meta / Instagram — publicação

| Variável | Onde conseguir |
|---|---|
| `META_INSTAGRAM_APP_ID` / `META_INSTAGRAM_APP_SECRET` | [developers.facebook.com](https://developers.facebook.com/apps) → seu app → Configurações do app → Básico |
| `META_REDIRECT_URI` | você mesmo define: `https://<seu-projeto>.supabase.co/functions/v1/meta-oauth-callback` — cadastre esse mesmo valor exato no app da Meta |
| `META_GRAPH_VERSION` | versão atual suportada da Graph API (confira em developers.facebook.com/docs/graph-api/changelog) |

Escopos a solicitar/aprovar no app da Meta: `instagram_business_basic`, `instagram_business_content_publish`. A conta do usuário final precisa ser profissional (Business para Stories).

### 2.5 Worker de publicação agendada

| Variável | Onde conseguir |
|---|---|
| `PUBLISH_WORKER_SECRET` | gerado por você — string aleatória com no mínimo 32 bytes (ex. `openssl rand -hex 32`) |

Esse mesmo valor precisa existir em **dois lugares**: como Edge Function Secret (`PUBLISH_WORKER_SECRET`) e como segredo no **Supabase Vault** do banco (nome `publish_worker_secret`), usado pelo `pg_cron` para chamar `publish-due-jobs` a cada minuto. Passo a passo completo em [`docs/supabase/10-deploy-meta-stripe.md`, seção 5](docs/supabase/10-deploy-meta-stripe.md).

### 2.6 Aplicação

| Variável | Valor |
|---|---|
| `APP_URL` | URL pública do frontend, ex. `https://lumipost-ai.vercel.app` (local: `http://localhost:5173`) |
| `ALLOWED_ORIGINS` | origens permitidas por CORS, separadas por vírgula (mesma URL de `APP_URL`) |

### 2.7 Ainda não usado no código

| Variável | Status |
|---|---|
| `HIGGSFIELD_API_KEY` | Placeholder para geração de vídeo. **Não configure ainda** — o adapter continua fake/desabilitado até haver contrato server-to-server oficial documentado (ver `docs/claude/06-jobs-e-ia.md`). |

## 3. Configurações que ficam só no Supabase Dashboard (não são env vars)

Não existem no código — são ajustadas direto no painel:

| Onde | O que configurar | Por quê |
|---|---|---|
| **Authentication → Sign In / Providers → Google** | Client ID e Client Secret do OAuth (criados em [console.cloud.google.com](https://console.cloud.google.com/apis/credentials), com URI autorizada `https://<seu-projeto>.supabase.co/auth/v1/callback`) | Necessário para o botão "Entrar com Google" funcionar — hoje está desativado no projeto hospedado |
| **Authentication → Emails → SMTP Settings** | Um provedor de SMTP (Resend, SendGrid, Postmark...) | Sem isso, o Supabase usa o mailer embutido dele, com limite baixíssimo (2–4 e-mails/hora) — cadastros passam a falhar com `over_email_send_rate_limit` |
| **Authentication → Rate Limits** | Ajustar `email_sent` depois de configurar SMTP próprio | Libera volume real de cadastros |
| **Project Settings → Vault** | Segredo `publish_worker_secret` (ver seção 2.5) | Usado pelo `pg_cron` para autenticar o worker |

## 4. Checklist de deploy

1. `npx supabase login` → `npx supabase link --project-ref <seu-projeto>`.
2. Aplicar migrations: `npx supabase db push --include-seed` (ver ordem e avisos em `docs/supabase/10-deploy-meta-stripe.md`).
3. Configurar as duas variáveis públicas na Vercel (seção 1).
4. Configurar todos os secrets de Edge Functions (seção 2).
5. Configurar Google OAuth e SMTP no Dashboard (seção 3).
6. Criar os 5 Prices no Stripe e o endpoint de webhook.
7. Criar o app da Meta, solicitar escopos e cadastrar o redirect URI.
8. Agendar o `pg_cron` do worker (seção 2.5).
9. Rodar a verificação de segurança e billing descrita em `docs/supabase/10-deploy-meta-stripe.md`, seção 6, antes de liberar para usuários reais.

## Estrutura do projeto

```
src/
  domain/          regras e contratos, sem dependência de Supabase
  application/      casos de uso (ApplicationContainer)
  infrastructure/    adapters reais (Supabase) e mock (memória)
  presentation/      React, Redux, rotas, UI
  features/          telas por domínio (billing, calendar, content...)
supabase/
  migrations/        schema versionado + RLS
  functions/          Edge Functions (uma pasta por função)
  seed.sql            catálogo público (planos, pacotes de crédito)
docs/
  supabase/          arquitetura e runbooks de infraestrutura
  claude/            fases de execução para o Claude Code
```
