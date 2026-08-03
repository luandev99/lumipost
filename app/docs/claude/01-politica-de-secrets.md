# 01 — Política de secrets e ambientes

Esta fase é pré-condição. Claude deve aplicá-la antes de instalar Supabase ou conectar um projeto remoto.

## Objetivo

Impedir que qualquer credencial real entre no Git, bundle Vite, logs, histórico de comandos, saída de ferramenta ou conversa.

## Classificação

| Variável/dado | Classificação | Local correto |
|---|---|---|
| `VITE_SUPABASE_URL` | pública | Vercel/frontend |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | pública, mas limitada por RLS | Vercel/frontend |
| `SUPABASE_URL` | configuração server-side | fornecida automaticamente à Edge Function |
| `SUPABASE_SECRET_KEYS` / service role legado | segredo crítico, ignora RLS | somente Edge Function/worker |
| `OPENAI_API_KEY` | segredo | Supabase Edge Function Secrets |
| `HIGGSFIELD_*` | segredo | Supabase Edge Function Secrets, se houver contrato oficial |
| gateway secret/webhook secret | segredo | Supabase Edge Function Secrets |
| SMTP/resend secret | segredo | Supabase Edge Function Secrets/Auth settings |
| token/refresh token social do cliente | segredo dinâmico | Vault/cofre por tenant, nunca env global |
| JWT de sessão do usuário | credencial efêmera | SDK Auth; nunca logar |
| `project-ref` | identificador não secreto | config/CI permitido |

Chave publicável não substitui RLS. Chave secreta/service role nunca pode ser tratada como fallback para corrigir policy.

## Tarefa para Claude

1. Inspecione nomes de arquivos e referências a env sem imprimir seus valores.
2. Atualize `.gitignore` para proteger pelo menos:

```gitignore
.env
.env.*
!.env.example
supabase/functions/.env
supabase/functions/.env.*
!supabase/functions/.env.example
*.pem
*.key
secrets*.json
```

3. Crie `.env.example` e `supabase/functions/.env.example` somente com placeholders como `replace_in_dashboard`, nunca chaves que pareçam reais.
4. Crie um módulo server-side `env.ts` que valide presença por Zod ou validação explícita e falhe sem exibir valor.
5. Crie um módulo frontend que aceite somente as duas variáveis públicas.
6. Adicione scanner de secrets ao CI e uma verificação que falhe se `SERVICE_ROLE`, `SECRET_KEY`, `OPENAI_API_KEY` ou credenciais de provider aparecerem em `src`, `public` ou `dist`.
7. Garanta redaction nos logs para `authorization`, `apikey`, `cookie`, `set-cookie`, `token`, `secret`, `password`, signed URLs e payloads de cartão.
8. Documente rotação e revogação sem valores reais.

## Inserção de secrets reais

Preferência: o usuário cadastra diretamente no Dashboard do Supabase em Edge Functions → Secrets.

Alternativa segura: o usuário cria manualmente um arquivo temporário **fora do workspace**, executa localmente:

```text
supabase secrets set --env-file <caminho-fora-do-repositorio>
```

Depois apaga o arquivo com mecanismo seguro do sistema. Claude não deve abrir, ler ou mostrar esse arquivo. Evite `supabase secrets set CHAVE=valor` em comando que possa ir para histórico/log.

Consultar apenas nomes com `supabase secrets list` é aceitável; nunca tente recuperar valores.

## Ambientes

- `local`: chaves falsas/sandbox em arquivo ignorado.
- `staging`: projeto Supabase separado e contas sandbox.
- `production`: projeto separado; secrets inseridos por operador; acesso mínimo.
- Preview da Vercel usa staging isolado, nunca secrets de produção.

Cada ambiente possui chaves independentes. Não copie dump de produção com PII para local.

## Tokens sociais por usuário

Não use Edge Function Secrets para milhares de tokens individuais. Crie um serviço `TokenVault`:

- `put(organizationId, accountId, tokenSet)`;
- `getForServer(accountId)`;
- `rotate(accountId, tokenSet)`;
- `revoke(accountId)`.

A implementação pode usar Supabase Vault ou cofre externo. A tabela pública guarda apenas `token_secret_ref`, expiração e scopes. Restrinja `vault.decrypted_secrets`; o browser e roles `anon/authenticated` nunca recebem acesso.

## Gates

- `git grep`/scanner sem secrets.
- build inspecionado sem chaves privadas.
- `.env.example` contém apenas nomes/placeholders.
- funções falham com `MISSING_SERVER_CONFIG`, sem revelar valor.
- logs testados com headers falsos e saída redigida.
- Vercel tem somente variáveis públicas de Supabase no frontend.

## Critério de conclusão

Claude relata nomes necessários e estado de configuração, nunca seus valores. Se encontrar um secret já versionado, deve parar, informar o caminho sem exibir o valor e recomendar revogação/rotação antes de continuar.

## Referências oficiais

- [Supabase: secrets de Edge Functions](https://supabase.com/docs/guides/functions/secrets)
- [Supabase: chave secret/service role ignora RLS](https://supabase.com/docs/guides/storage/security/access-control)
- [Supabase Vault](https://supabase.com/docs/guides/database/vault)

