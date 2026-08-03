# 10 — Testes, CI/CD e deploy

## Prompt da fase

Crie uma pipeline reproduzível que prove segurança e comportamento antes de staging/produção. Não faça deploy de produção sem autorização explícita.

## Matriz de testes

### Unitários

- regras de crédito e preço;
- máquinas de estado;
- validação de planner;
- schemas de provider/template;
- classificação de retry;
- timezone;
- adapters e casos de uso.

### Banco/pgTAP

- schema, constraints, FKs e índices;
- RLS CRUD para anon/A/B/roles;
- security definer/grants;
- ledger e concorrência;
- idempotência;
- transições;
- até cinco conteúdos por dia;
- views e Storage policies.

### Edge Functions

- JWT ausente/inválido/expirado;
- AAL/role;
- CORS e methods;
- schema/payload/rate limit;
- secret ausente;
- provider/webhook;
- redaction;
- timeout/retry.

### Integração/E2E

- cadastro → confirmação → onboarding → assinatura sandbox;
- upload → conteúdo → agenda manual com 2 créditos;
- semana com até 5 por dia;
- geração → refresh → conclusão;
- falha/retry/refund;
- compra adicional por webhook;
- admin AAL2;
- cross-tenant;
- viewport mobile/desktop.

## Pipeline mínima

1. checkout limpo;
2. secret scan;
3. dependency audit;
4. install lockfile;
5. typecheck/lint/unit;
6. Supabase local + migrations do zero;
7. `supabase db lint` e pgTAP;
8. Edge Function tests;
9. build;
10. scan de bundle por secrets;
11. E2E;
12. artifact/SBOM quando aplicável.

## Secrets no CI

Runtime secrets de IA/billing/social pertencem ao Supabase e não precisam ir ao build Vite. O CI pode precisar de credencial de deploy Supabase/Vercel; armazene-a no cofre criptografado do CI, com ambiente protegido e menor privilégio. Ela não deve ser reutilizada como runtime secret do app.

Preview Vercel contém somente:

- `VITE_SUPABASE_URL` de staging;
- `VITE_SUPABASE_PUBLISHABLE_KEY` de staging;
- configurações públicas estritamente necessárias.

Nunca injete `SUPABASE_SECRET_KEYS`, service role, OpenAI ou gateway no build.

## Deploy

Ordem:

1. backup/restore point quando aplicável;
2. migrations compatíveis para staging;
3. Edge Functions;
4. secrets cadastrados pelo operador;
5. smoke/API/RLS;
6. frontend staging;
7. E2E;
8. aprovação humana;
9. produção com estratégia expand/contract;
10. smoke, métricas e rollback pronto.

Migrations destrutivas são divididas: adicionar → migrar/backfill → trocar aplicação → observar → remover em release posterior.

## Vercel

- configurar headers CSP, HSTS, nosniff, referrer e permissions policy;
- SPA rewrite preservado;
- source maps privados ou controlados;
- preview não usa produção;
- cache correto para `index.html` e assets hasheados;
- nenhuma env secreta exposta pelo prefixo Vite.

## Gates de produção

- todos os testes verdes em commit limpo;
- auditoria da fase 11 sem crítico/alto;
- backup/restauração testados;
- budgets e alertas ativos;
- secrets presentes por nome e rotação documentada;
- gateway/IA/social em sandbox aprovados;
- autorização explícita do usuário.

## Referências

- [Supabase: testing overview](https://supabase.com/docs/guides/local-development/testing/overview)
- [Supabase: deploy de Edge Functions](https://supabase.com/docs/guides/functions/deploy)

