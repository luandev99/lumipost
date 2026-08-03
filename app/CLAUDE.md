# Lumipost.ai — instruções permanentes para Claude Code

## Missão

Transformar a aplicação mockada em um SaaS completo com Supabase, mantendo React/Vite/TypeScript/Redux/React Router e as camadas `domain`, `application`, `infrastructure` e `presentation`.

Antes de alterar o projeto, leia integralmente:

1. `docs/supabase/README.md` e os nove documentos vinculados;
2. `docs/claude/README.md`;
3. a fase solicitada em `docs/claude`;
4. `docs/claude/01-politica-de-secrets.md` para qualquer ação com ambiente remoto.

## Regras não negociáveis

### Segurança

- Nunca escreva, leia, imprima, copie, registre ou peça em chat o valor de um secret real.
- Nunca grave secrets em Markdown, código, migration, seed, teste, screenshot, log ou commit.
- Nunca coloque secret key, service role, OpenAI, Higgsfield, gateway ou token social em variável `VITE_*`.
- O browser recebe somente `VITE_SUPABASE_URL` e `VITE_SUPABASE_PUBLISHABLE_KEY`; ambas são públicas por natureza e exigem RLS correta.
- Secrets de provedores ficam em Supabase Edge Function Secrets e são acessados apenas com `Deno.env.get`.
- Tokens dinâmicos de redes sociais pertencentes aos clientes ficam em cofre criptografado/Vault ou secret manager, nunca em texto puro.
- A secret/service key do Supabase ignora RLS. Use somente em Edge Functions/workers, depois de validar JWT, organização e papel.
- Toda tabela exposta deve ter RLS, policies explícitas e testes negativos entre duas organizações.
- Funções `security definer` usam `set search_path = ''`, nomes qualificados por schema, `REVOKE EXECUTE` por padrão e grants mínimos.
- Nunca implante em produção, altere DNS, cobre cartão ou publique numa rede social sem autorização explícita do usuário.

### Arquitetura

- Fluxo de UI: componente → thunk/action → caso de uso → contrato → adapter.
- Não importe Supabase diretamente em componentes.
- Redux é cache/estado de UI; Postgres é a fonte de verdade.
- Operações financeiras, geração, confirmação semanal, publicação, admin e webhooks passam por Edge Function/RPC segura.
- Operações longas viram jobs persistidos em Queues; não mantenha HTTP aberto esperando IA/vídeo.
- Imagens, vídeos e exports ficam no Storage. Banco guarda metadata/path, nunca base64 grande.
- Conteúdo, prompt e template publicados são versionados e imutáveis.
- Toda chamada externa e toda cobrança usam idempotência.

### Processo

- Preserve alterações existentes do usuário.
- Trabalhe por migrations versionadas, nunca apenas pelo Dashboard.
- Faça desenvolvimento local primeiro; staging antes de produção.
- Não invente endpoints ou preços de provedores. Use documentação oficial atual.
- Se Higgsfield não fornecer contrato server-to-server documentado, mantenha o adapter fake/desabilitado.
- Ao terminar uma fase, execute seus gates e registre apenas resultados sem segredos.
- Não afirme que algo está pronto sem teste correspondente.
- Se uma decisão externa for indispensável, pare somente naquele ponto e explique exatamente o que falta.

## Gates obrigatórios

Uma fase não está concluída até que os comandos aplicáveis passem:

```text
npm run typecheck (ou npm run build, se não houver script dedicado)
npm run lint
npm run test
npm run build
supabase db reset
supabase test db
supabase db lint
deno test supabase/functions --allow-env --allow-net (quando houver funções)
```

Adicione Playwright/E2E e scanner de secrets antes do go-live.

## Critérios globais de aceite

- Usuário A não consegue listar, ler, alterar, baixar nem inferir IDs do usuário B.
- Nenhuma chave secreta aparece no bundle Vite, Git, logs ou respostas HTTP.
- Requests/webhooks repetidos não duplicam crédito, pagamento, geração ou publicação.
- Wallet nunca fica negativa e o ledger reconcilia o saldo.
- Até cinco conteúdos por dia selecionado; não aplicar o limite antigo de cinco por semana.
- Agendamento manual cobra exatamente dois créditos uma única vez.
- Jobs sobrevivem a refresh, timeout e redeploy.
- Falhas liberam/resolvem reservas conforme política e deixam auditoria.
- MFA AAL2 é exigido para administração global e operações críticas de conta.
- Produção tem alertas, backup/restauração testada e runbook.

## Ordem de execução

Siga `docs/claude/00-prompt-mestre.md` ou execute as fases de `02` a `10` na ordem. A fase `11` é o gate final de segurança e pode bloquear o lançamento.

