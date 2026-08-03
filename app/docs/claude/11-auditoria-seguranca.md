# 11 — Auditoria final de segurança

## Prompt da auditoria

Faça uma revisão adversarial completa do Lumipost antes do go-live. Não implemente novas features durante a auditoria, exceto correções necessárias. Liste achados com severidade, evidência reproduzível sem dados sensíveis, impacto, correção e teste de regressão.

## Regra de lançamento

- **Crítico/alto:** bloqueia lançamento.
- **Médio:** corrigir ou ter aceite de risco explícito com prazo/responsável.
- **Baixo:** registrar backlog.
- Não declarar “100% seguro”. Declare escopo, ferramentas, limitações e risco residual.

## Checklist

### Secrets e supply chain

- histórico Git e workspace sem secrets;
- `.env*` protegido;
- bundle/source map sem segredo;
- dependencies auditadas e lockfile;
- scripts de pacote revisados;
- CI não imprime env;
- rotação/revogação testada;
- packages de fonte confiável.

### Auth e sessão

- enumeração de e-mail;
- brute force/rate limit/CAPTCHA;
- senha forte/leaked passwords;
- refresh/logout/revogação;
- MFA AAL2 em admin;
- CSRF/state/PKCE em OAuth;
- open redirect;
- suspensão de usuário;
- sessão em múltiplas abas.

### Autorização/RLS

- inventário de toda tabela/view/function/bucket exposto;
- RLS habilitada e policies mínimas;
- testes A/B por CRUD;
- IDOR por UUID conhecido;
- `raw_user_meta_data` não autoriza;
- view não bypassa RLS;
- security definer/search_path/grants;
- service role somente servidor;
- admin não depende de frontend guard.

### Banco e lógica

- SQL injection/dynamic SQL;
- constraints e FK;
- race conditions;
- saldo/ledger/reconciliação;
- idempotência;
- outbox/jobs órfãos;
- timezone;
- audit append-only;
- migrations/rollback.

### Storage e mídia

- path traversal/tenant swap;
- MIME spoof/polyglot/SVG/XSS;
- tamanho/quota/decompression bomb;
- signed URL lifetime/cache/referrer;
- bucket público acidental;
- objeto órfão/purge;
- metadados EXIF/PII quando relevante.

### Edge Functions/API

- JWT/AAL/role;
- schema/mass assignment;
- CORS/method/content type;
- rate/size/timeouts;
- SSRF em URLs fornecidas;
- webhook signature/replay;
- erro/log redaction;
- headers de segurança;
- privilégios do admin client.

### IA

- prompt injection;
- exfiltração de prompt/segredo;
- output HTML/SVG/script;
- ferramentas privilegiadas inexistentes;
- moderação/consentimento de rosto/voz;
- budget/cost denial-of-wallet;
- provider response não confiável;
- arquivo remoto copiado com allowlist/limite.

### Billing/social

- preço do cliente ignorado;
- webhook duplicado/forjado;
- cartão/CVV não armazenado;
- refund/chargeback;
- token social criptografado;
- scopes mínimos;
- publicação duplicada;
- desconexão/revogação.

### Infra/privacidade

- projetos local/staging/prod separados;
- backups e restore real;
- Storage não incluído implicitamente no backup do banco;
- logs/retention/LGPD;
- alertas e incident response;
- CORS/CSP/HSTS;
- DNS/domínio/HTTPS;
- acesso humano ao Dashboard com MFA.

## Testes ofensivos mínimos

- usuário A usa IDs de B em REST, RPC, Storage e Edge Functions;
- altera `organization_id`, `role`, `price`, `credits` e `status` no payload;
- repete 20 vezes request/webhook;
- roda duas reservas/publicações simultâneas;
- envia URL localhost/metadata/private IP para detectar SSRF;
- envia SVG/HTML/MIME falso e arquivo excessivo;
- injeta instruções maliciosas em tema/brand/caption;
- tenta admin em AAL1;
- procura padrões de chave no bundle e logs.

## Relatório

Gerar `docs/security-audit-report.md` com:

- data/commit/ambiente;
- escopo e fora de escopo;
- resumo executivo;
- achados e correções;
- testes executados/resultados;
- risco residual;
- decisão `GO` ou `NO-GO`.

Se um teste não puder ser executado, marque “não verificado”, nunca “aprovado”.

## Referências

- [Supabase RLS](https://supabase.com/docs/guides/database/postgres/row-level-security)
- [Supabase database functions](https://supabase.com/docs/guides/database/functions)
- [Supabase MFA](https://supabase.com/docs/guides/auth/auth-mfa)

