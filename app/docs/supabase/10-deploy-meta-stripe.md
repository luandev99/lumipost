# 10 — Deploy real: Supabase, Meta e Stripe

Este runbook corresponde ao código em `supabase/migrations` e `supabase/functions`. Não coloque valores secretos em arquivos `VITE_*`, no Redux, no Git, em logs ou neste documento.

## Estado atual do ambiente (01/08/2026)

- As oito migrations e as políticas RLS já foram aplicadas ao projeto `djddjdjoarrwjiwqsnoa`.
- As 18 Edge Functions estão implantadas e ativas. JWT continua obrigatório nas funções de usuário; webhook Stripe, callback Meta e worker validam assinatura/segredo próprios.
- `APP_URL`, `ALLOWED_ORIGINS`, `META_REDIRECT_URI`, `OPENAI_IDENTITY_MODEL` e o segredo interno do worker já estão configurados.
- O worker foi agendado com `pg_cron` a cada minuto e seu segredo foi armazenado no Vault.
- A aplicação está publicada em `https://lumipost-ai.vercel.app` e usa o Supabase real.
- Ainda dependem de configuração pelo proprietário: chaves e Price IDs do Stripe, App ID/secret e versão do Graph API da Meta e a chave OpenAI. Esses valores devem ser inseridos diretamente em **Edge Functions → Secrets**.

As migrations iniciais foram executadas pelo SQL Editor. Antes do próximo `db push`, vincule o CLI e marque as versões já aplicadas para não tentar executá-las novamente:

```powershell
npx supabase login
npx supabase link --project-ref djddjdjoarrwjiwqsnoa
npx supabase migration repair --status applied 202608010001 202608010002 202608010003 202608010004 202608010005 --linked
```

Só depois confirme com `npx supabase migration list --linked`. Não execute `db push` enquanto as cinco versões não aparecerem como aplicadas no remoto.

## 1. Autenticar e aplicar o Supabase

O projeto de produção é `djddjdjoarrwjiwqsnoa`. A autenticação do CLI deve ser feita pelo proprietário no navegador:

```powershell
npx supabase login
npx supabase link --project-ref djddjdjoarrwjiwqsnoa
npx supabase migration list --linked
# Apenas quando o histórico local e remoto estiver alinhado:
npx supabase db push --include-seed
```

Depois, no painel em **Project Settings → API**, copie apenas a URL e a publishable key para as variáveis públicas da Vercel:

```text
VITE_SUPABASE_URL=https://djddjdjoarrwjiwqsnoa.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=<publishable key>
```

A secret key/service role nunca entra na Vercel nem no navegador. As Edge Functions recebem as credenciais internas do Supabase no runtime.

## 2. Secrets das Edge Functions

Cadastre os valores diretamente em **Edge Functions → Secrets** ou use `npx supabase secrets set` no seu próprio terminal. A lista de nomes está em `supabase/functions/.env.example`.

Obrigatórios para os fluxos deste documento:

- `APP_URL=https://lumipost-ai.vercel.app`
- `ALLOWED_ORIGINS=https://lumipost-ai.vercel.app`
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `STRIPE_PRICE_MONTH`, `STRIPE_PRICE_YEAR`
- `STRIPE_PRICE_CREDITS_50`, `STRIPE_PRICE_CREDITS_150`, `STRIPE_PRICE_CREDITS_400`
- `META_INSTAGRAM_APP_ID`, `META_INSTAGRAM_APP_SECRET`
- `META_REDIRECT_URI=https://djddjdjoarrwjiwqsnoa.supabase.co/functions/v1/meta-oauth-callback`
- `META_GRAPH_VERSION`, fixada numa versão ainda suportada e testada
- `OPENAI_API_KEY`, `OPENAI_IDENTITY_MODEL=gpt-5-mini`, `OPENAI_CONTENT_MODEL=gpt-5-mini`, `OPENAI_IMAGE_MODEL=gpt-image-1-mini`
- `PUBLISH_WORKER_SECRET`, aleatório e com no mínimo 32 bytes

Implante:

```powershell
npx supabase functions deploy account-bootstrap
npx supabase functions deploy credit-balance
npx supabase functions deploy schedule-content
npx supabase functions deploy billing-create-checkout
npx supabase functions deploy billing-create-portal
npx supabase functions deploy billing-webhook --no-verify-jwt
npx supabase functions deploy meta-oauth-start
npx supabase functions deploy meta-oauth-callback --no-verify-jwt
npx supabase functions deploy meta-disconnect
npx supabase functions deploy brand-analyze-instagram
npx supabase functions deploy publish-due-jobs --no-verify-jwt
```

O `config.toml` já registra quais funções exigem JWT e quais fazem sua própria validação de assinatura/segredo.

## 3. Stripe

Crie cinco Prices no modo de teste e depois em produção:

| Variável                   | Tipo              | Catálogo Lumipost        |
| -------------------------- | ----------------- | ------------------------ |
| `STRIPE_PRICE_MONTH`       | recorrente mensal | R$ 47,90 / 120 créditos  |
| `STRIPE_PRICE_YEAR`        | recorrente anual  | R$ 247,90 / 500 créditos |
| `STRIPE_PRICE_CREDITS_50`  | pagamento único   | R$ 19,90                 |
| `STRIPE_PRICE_CREDITS_150` | pagamento único   | R$ 49,90                 |
| `STRIPE_PRICE_CREDITS_400` | pagamento único   | R$ 109,90                |

Webhook:

```text
https://djddjdjoarrwjiwqsnoa.supabase.co/functions/v1/billing-webhook
```

Eventos necessários:

- `checkout.session.completed`
- `checkout.session.async_payment_succeeded`
- `checkout.session.expired`
- `invoice.paid`
- `invoice.payment_failed`
- `customer.subscription.created`
- `customer.subscription.updated`
- `customer.subscription.deleted`

O webhook valida o corpo bruto e a assinatura Stripe, deduplica por `event.id`, sincroniza a assinatura e concede créditos pelo ledger idempotente. Número de cartão nunca passa pela Lumipost.

## 4. Meta / Instagram

No Meta for Developers, configure um app com Instagram API using Instagram Login e o redirect URI exato:

```text
https://djddjdjoarrwjiwqsnoa.supabase.co/functions/v1/meta-oauth-callback
```

Solicite e aprove os escopos:

- `instagram_business_basic`
- `instagram_business_content_publish`

A conta precisa ser profissional. Stories exigem conta Business. Durante desenvolvimento, adicione as contas de teste aos papéis do app; produção exige Live mode e, conforme o caso, App Review.

O token é trocado somente na Edge Function e armazenado criptografado no Supabase Vault. O frontend recebe apenas dados públicos da conta. O botão **Analisar Instagram e preencher identidade** envia ao OpenAI somente o perfil e posts recentes após ação explícita do usuário, com `store: false` e saída estruturada validada.

## 5. Worker automático a cada minuto

Guarde o mesmo valor de `PUBLISH_WORKER_SECRET` também no Vault do banco com o nome `publish_worker_secret`. Não escreva o valor no SQL. Ative `pg_cron` e `pg_net` e agende no SQL Editor:

```sql
select cron.schedule(
  'lumipost-publish-due-jobs',
  '* * * * *',
  $$
  select net.http_post(
    url := 'https://djddjdjoarrwjiwqsnoa.supabase.co/functions/v1/publish-due-jobs',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-worker-secret', (
        select decrypted_secret
        from vault.decrypted_secrets
        where name = 'publish_worker_secret'
        limit 1
      )
    ),
    body := '{"batchSize": 5}'::jsonb
  );
  $$
);
```

O worker reivindica jobs com `FOR UPDATE SKIP LOCKED`, cria e consulta containers da Meta, usa backoff, limita tentativas e registra auditoria. As mídias ficam em buckets privados; a URL assinada curta é produzida somente na hora da publicação.

## 6. Verificação antes de produção

1. Criar dois usuários de organizações diferentes e tentar leitura cruzada das tabelas e do Storage — todas devem falhar.
2. Comprar plano em Stripe Test; repetir o mesmo webhook e confirmar que créditos entram uma vez.
3. Comprar pacote adicional e verificar `credit_transactions` e atualização Realtime do Redux.
4. Conectar conta profissional de teste, analisar a identidade e conferir que nenhum token aparece no Network/Redux.
5. Enviar mídia ao Storage, agendar no futuro e disparar o worker em teste.
6. Testar token Meta expirado, mídia inválida, rate limit, webhook fora de ordem e retry.
7. Revisar logs sem secrets e configurar alertas para webhooks falhos, jobs atrasados e tokens próximos do vencimento.

## Limite de segurança

Nenhum sistema pode ser prometido como “sem falhas”. Este projeto usa RLS, Vault, validação de JWT no servidor, webhooks assinados, idempotência, CORS restrito, buckets privados e ledger transacional, mas produção ainda exige testes no projeto remoto, revisão independente e rotação periódica das credenciais.
