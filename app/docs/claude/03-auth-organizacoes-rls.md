# 03 — Auth, organizações, MFA e RLS

## Prompt da fase

Implemente autenticação real e isolamento multi-tenant. Nenhuma tela do app autenticado pode depender das contas seed quando `DATA_MODE=supabase`.

## Auth

- cadastro, confirmação de e-mail, login, logout, refresh, recuperação e troca de senha;
- profile público referenciando `auth.users(id)`;
- onboarding persistido em `brands`;
- bootstrap mínimo do usuário via trigger testado;
- usuário novo recebe organização e role `owner` sem aceitar role do payload;
- status suspenso bloqueia endpoints e dados sensíveis;
- MFA TOTP disponível e AAL2 obrigatório para `system_admin`, ajuste de créditos, members/billing e rotação de conexão social.

Configure requisitos fortes de senha, proteção contra senhas vazadas quando o plano permitir, rate limits e CAPTCHA em fluxos abusáveis. Não revele se um e-mail existe na recuperação.

## RLS

Crie schema privado `security` para helpers, quando adequado. Helpers `security definer`:

- `is_org_member(org_id)`;
- `has_org_role(org_id, roles[])`;
- `is_system_admin()`;
- `has_aal2()`.

Todos usam `set search_path = ''`, nomes totalmente qualificados e execução revogada por padrão. Não dependem de `raw_user_meta_data` para autorização.

Policies:

- `viewer`: select;
- `editor`: criar/editar drafts e solicitar geração/agendamento;
- `admin/owner`: configura marca/equipe/billing conforme regra;
- `system_admin`: apenas por endpoints administrativos auditados, não por policy client-side ampla.

Views expostas usam `security_invoker = true` ou ficam fora de schemas expostos.

## Testes obrigatórios

Crie usuários A e B, duas organizações e papéis diferentes. Para cada tabela:

- anon não lê dados privados;
- A vê dados de A;
- A não vê/insere/atualiza/apaga dados de B;
- editor não gerencia billing/members;
- viewer não escreve;
- usuário não promove a si próprio;
- metadata editável não concede role;
- sessão AAL1 não executa operação crítica;
- sessão AAL2 autorizada executa quando possui papel;
- usuário suspenso é bloqueado.

Use pgTAP e testes de integração com cliente Supabase, incluindo chamadas com IDs adivinhados.

## Frontend

- guards usam sessão real para UX;
- autorização nunca depende apenas do guard;
- onboarding incompleto redireciona corretamente;
- sessão expirada é tratada sem loop;
- logout limpa cache Redux e signed URLs;
- mensagens não vazam existência de conta.

## Gate

Fase bloqueada se qualquer teste cross-tenant conseguir retornar uma linha ou se alguma tabela exposta não tiver RLS.

## Referências

- [Supabase: User Management](https://supabase.com/docs/guides/auth/managing-user-data)
- [Supabase: RLS](https://supabase.com/docs/guides/database/postgres/row-level-security)
- [Supabase: MFA e AAL](https://supabase.com/docs/guides/auth/auth-mfa)
- [Supabase: segurança de senha](https://supabase.com/docs/guides/auth/password-security)
- [Supabase: segurança de database functions](https://supabase.com/docs/guides/database/functions)

