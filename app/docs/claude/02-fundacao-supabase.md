# 02 — Fundação Supabase

## Prompt da fase

Implemente a fundação Supabase local da Lumipost.ai seguindo `CLAUDE.md`, a política de secrets e `docs/supabase/09-blueprint-sql.md`. Não conecte produção ainda.

## Entregáveis

1. Instalar `@supabase/supabase-js` e ferramentas necessárias sem atualizar dependências alheias.
2. Inicializar `supabase/` com CLI e configurações locais.
3. Criar migrations versionadas, pequenas e reversíveis para:
   - extensões necessárias;
   - enums;
   - `profiles`, `organizations`, `organization_members`, `brands`;
   - tabelas operacionais base e auditoria;
   - helpers de `updated_at` seguros;
   - grants/default privileges restritivos.
4. Criar seed apenas para ambiente local, com IDs previsíveis e nenhum secret.
5. Gerar tipos TypeScript do banco e integrá-los sem importar Supabase em componentes.
6. Criar `SupabaseClientFactory` com clientes distintos:
   - browser com publishable key;
   - usuário server-side propagando JWT/RLS;
   - admin apenas em Edge Functions.
7. Criar health check sem expor versão, env ou credenciais.
8. Documentar os comandos local, reset e geração de tipos.

## Regras SQL

- Objetos públicos têm owner/grants mínimos.
- Nenhuma tabela criada no schema exposto fica com RLS esquecida.
- FK para `auth.users` somente por `id`.
- `organization_id` em toda entidade de tenant.
- Índices em FK e colunas de policy.
- Timestamps UTC e timezone IANA separado.
- Migrations não contêm URLs/chaves reais.
- Não dependa de alterações manuais invisíveis no Dashboard.

## Estrutura esperada

```text
supabase/
  config.toml
  migrations/
  seed.sql
  tests/database/
  functions/_shared/
src/infrastructure/supabase/
  browserClient.ts
  types.ts
  repositories/
```

Adapte ao projeto quando necessário, sem quebrar as camadas existentes.

## Gates

```text
supabase start
supabase db reset
supabase db lint
supabase test db
npm run lint
npm run test
npm run build
```

Inclua testes que confirmem existência de PK, FK, RLS e índices essenciais.

## Não fazer

- não linkar/aplicar em produção;
- não usar Dashboard como única fonte do schema;
- não adicionar service role ao frontend;
- não implementar tabelas vazias sem policies/testes;
- não remover repositories mockados antes do adapter real ter paridade.

## Saída da fase

Atualize `docs/implementation-status.md` com migrations, testes e pendências externas. Não inclua output de env.

## Referências

- [Supabase: desenvolvimento local e migrations](https://supabase.com/docs/guides/local-development/overview)
- [Supabase: testes e lint](https://supabase.com/docs/guides/local-development/cli/testing-and-linting)

