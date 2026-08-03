# 03 — Autenticação, RLS e Storage

## Autenticação

Use Supabase Auth para cadastro, login, recuperação de senha, confirmação de e-mail e sessão. A tabela `auth.users` é administrada pelo Supabase; dados de produto ficam em `public.profiles` referenciando somente `auth.users(id)`.

Um trigger `after insert` pode criar profile, organização, associação `owner` e wallet. Ele precisa ser mínimo e muito bem testado: uma falha nesse trigger pode impedir o cadastro.

### Fluxo de cadastro

1. `supabase.auth.signUp` cria o usuário.
2. Confirmação de e-mail, se habilitada.
3. Trigger cria apenas o conjunto mínimo seguro.
4. UI chama `CompleteOnboarding` para gravar marca.
5. Usuário escolhe plano; webhook do pagamento ativa assinatura e concede créditos.

### Autorização

Não coloque papel administrativo em `raw_user_meta_data`, pois o próprio usuário pode alterá-lo. Para autorização use:

- associação em `organization_members`; e
- `profiles.system_role` ou `raw_app_meta_data`, alterado somente por serviço privilegiado.

O frontend pode esconder rotas, mas a segurança real está na RLS e nas Edge Functions.

## Funções auxiliares de RLS

Evite repetir joins extensos em dezenas de policies.

```sql
create or replace function public.is_org_member(target_org uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.organization_members m
    where m.organization_id = target_org
      and m.user_id = (select auth.uid())
      and m.status = 'active'
  );
$$;

create or replace function public.has_org_role(target_org uuid, allowed text[])
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.organization_members m
    where m.organization_id = target_org
      and m.user_id = (select auth.uid())
      and m.status = 'active'
      and m.role::text = any(allowed)
  );
$$;
```

Revogue execução pública desnecessária e conceda somente a `authenticated`. Qualquer função `security definer` deve definir `search_path` explícito e validar todos os parâmetros.

## Matriz de acesso

| Recurso | Viewer | Editor | Admin/Owner | System admin |
|---|---:|---:|---:|---:|
| Ler conteúdos da organização | sim | sim | sim | via endpoint admin |
| Criar/editar drafts | não | sim | sim | via endpoint admin |
| Confirmar/agendar | não | sim | sim | via endpoint admin |
| Membros/cobrança | não | não | sim | via endpoint admin |
| Prompts/templates globais | leitura dos ativos | leitura dos ativos | leitura dos ativos | CRUD |
| Créditos/ledger | leitura resumida | leitura resumida | leitura completa | ajustes auditados |
| Segredos/tokens | nunca | nunca | nunca | somente processo servidor |

## Exemplos de policies

```sql
alter table public.contents enable row level security;

create policy contents_select_member
on public.contents
for select
to authenticated
using (public.is_org_member(organization_id));

create policy contents_insert_editor
on public.contents
for insert
to authenticated
with check (
  public.has_org_role(organization_id, array['owner', 'admin', 'editor'])
  and created_by = (select auth.uid())
);

create policy contents_update_editor
on public.contents
for update
to authenticated
using (public.has_org_role(organization_id, array['owner', 'admin', 'editor']))
with check (public.has_org_role(organization_id, array['owner', 'admin', 'editor']));
```

Não crie policies de escrita direta para `credit_wallets`, `credit_transactions`, `provider_usage`, `payment_events` ou `publishing_attempts`. O cliente pode ter `SELECT` filtrado, mas mutações passam por funções transacionais/servidor.

Views expostas devem usar `security_invoker = true` em Postgres 15+ ou permanecer em schema não exposto. Views criadas normalmente podem contornar RLS por padrão.

## Buckets do Storage

| Bucket | Visibilidade | Conteúdo |
|---|---|---|
| `brand-assets` | privado | logos, fontes e referências |
| `content-uploads` | privado | material original do usuário |
| `generated-media` | privado | imagens e vídeos gerados |
| `content-renders` | privado | PNGs, capas, thumbnails e ZIPs |
| `template-specs` | privado | JSONs versionados dos templates |
| `exports` | privado e temporário | downloads montados pelo backend |
| `public-assets` | público | somente ativos institucionais sem dados do cliente |

Estrutura de caminho:

```text
<organization_id>/<brand_id>/<resource_id>/<version>/<filename>
```

Exemplo:

```text
generated-media/85.../a1.../content-uuid/v3/slide-01.png
```

### Upload seguro

1. UI pede autorização para upload informando MIME, tamanho e hash.
2. Edge Function valida organização, plano, formato e limites.
3. Backend retorna signed upload URL ou autoriza path específico via RLS.
4. UI envia diretamente ao Storage.
5. `finalize-upload` verifica objeto e cria `storage_objects`.

Use TUS/resumable upload para vídeos grandes. Valide MIME real, extensão, tamanho, dimensões, duração e, em produção, malware/conteúdo proibido.

### Download e preview

Buckets privados exigem signed URL curta. Não persista signed URL no banco; persista o path e gere uma URL nova quando necessário.

## Segredos

Chaves `OPENAI_API_KEY`, credenciais de vídeo, pagamento e webhooks ficam nos secrets das Edge Functions. Tokens de contas sociais por cliente podem ficar criptografados em Vault ou em um cofre externo; a tabela guarda somente a referência.

Nunca enviar para o browser:

- chave secreta/service role do Supabase;
- chave da OpenAI/Higgsfield;
- secret de webhook;
- refresh/access token duradouro de rede social;
- conteúdo de `vault.decrypted_secrets`.

As chaves secretas do Supabase ignoram RLS. Use-as apenas em funções/serviços confiáveis e valide explicitamente propriedade e papel antes de qualquer alteração.

## Checklist de RLS

- RLS habilitada em toda tabela exposta no schema público.
- Policies especificam `to authenticated`.
- `SELECT`, `INSERT`, `UPDATE` e `DELETE` testados separadamente.
- `UPDATE` tem policy de `SELECT` correspondente.
- FKs e colunas usadas em policies têm índice.
- Nenhum papel vem de metadata editável pelo usuário.
- Nenhuma função `security definer` aceita `organization_id` sem validar membro.
- Testes tentam acessar outra organização e devem falhar.
- Admin global usa endpoint dedicado com auditoria; não uma policy ampla no cliente.

## Referências oficiais

- [Supabase RLS](https://supabase.com/docs/guides/database/postgres/row-level-security)
- [Supabase Auth: dados de usuário](https://supabase.com/docs/guides/auth/managing-user-data)
- [Supabase Storage Access Control](https://supabase.com/docs/guides/storage/security/access-control)
- [Supabase: buckets privados e signed URLs](https://supabase.com/docs/guides/storage/buckets/fundamentals)
- [Supabase Vault](https://supabase.com/docs/guides/database/vault)
- [Supabase Edge Function secrets](https://supabase.com/docs/guides/functions/secrets)

