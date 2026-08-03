# 06 — API e Edge Functions

## Organização sugerida

```text
supabase/
  config.toml
  migrations/
  seed.sql
  functions/
    _shared/
      auth.ts
      cors.ts
      errors.ts
      idempotency.ts
      schemas.ts
      tracing.ts
      providers/
    generation-jobs/
    generation-webhook/
    weekly-plans-confirm/
    upload-authorize/
    upload-finalize/
    schedule-content/
    publishing-retry/
    billing-checkout/
    billing-webhook/
    social-connect/
    social-callback/
    admin-credit-adjust/
    worker-ai-text/
    worker-ai-image/
    worker-ai-video/
    worker-render/
    worker-publish/
```

Compartilhe apenas infraestrutura genérica em `_shared`. Casos de uso e schemas devem ter testes e versões claras.

## Convenção HTTP

- JSON UTF-8.
- `Authorization: Bearer <Supabase JWT>` para usuário.
- `Idempotency-Key` obrigatório em mutações cobradas ou que chamam terceiro.
- `X-Trace-Id` opcional; o servidor cria se ausente.
- Erros com `code`, `message`, `details` seguros e `traceId`.
- Jobs assíncronos retornam `202 Accepted`.

```json
{
  "error": {
    "code": "INSUFFICIENT_CREDITS",
    "message": "Saldo insuficiente para esta geração.",
    "details": { "required": 25, "available": 10 },
    "traceId": "..."
  }
}
```

Não retorne stack, prompt de sistema, token, resposta bruta sensível ou SQL.

## Endpoints de usuário

### `POST /functions/v1/generation-jobs`

Cria um job de texto/imagem/vídeo.

```json
{
  "brandId": "uuid",
  "contentId": "uuid opcional",
  "operation": "weekly_plan|visual_copy|caption|hashtags|image|reel_script|video",
  "format": "post|carousel|story|reel",
  "topic": "Lançamento da coleção",
  "objective": "conversão",
  "templateId": "uuid opcional",
  "options": {
    "slides": 5,
    "quality": "low",
    "maxCredits": 25
  }
}
```

Resposta `202`: `jobId`, `status`, `estimatedCredits`, `reservedCredits`.

Valida membership, marca, assinatura, prompt/template ativo, limites e idempotência. Reserva crédito, cria job e outbox.

### `POST /functions/v1/weekly-plans-confirm`

Recebe `weeklyPlanId`, `maxCredits` e chave idempotente. A função chama a rotina transacional; não insere slot a slot no cliente.

### `POST /functions/v1/schedule-content`

```json
{
  "contentId": "uuid",
  "contentVersionId": "uuid",
  "socialAccountId": "uuid",
  "scheduledLocal": "2026-08-10T19:30:00",
  "timezone": "America/Sao_Paulo",
  "approvalRequired": false
}
```

Retorna `publishingJobId`, UTC calculado e os **2 créditos** cobrados/reservados.

### `POST /functions/v1/upload-authorize`

Recebe nome normalizado, MIME, bytes, hash e tipo de recurso. Retorna bucket/path e URL assinada curta. Nunca aceite um path arbitrário enviado pelo cliente.

### `POST /functions/v1/upload-finalize`

Verifica a existência e metadados do objeto e cria `storage_objects`. Pode colocar validação pesada numa fila.

### `POST /functions/v1/publishing-retry`

Valida proprietário e estado, incrementa tentativa/reagenda e registra auditoria. Repetir o request com a mesma chave não cria uma segunda publicação.

## Pagamento

### `POST /functions/v1/billing-checkout`

Recebe `planId` ou `creditProductId`, cria sessão no gateway e retorna URL/identificador. Preço sempre vem do banco, nunca do payload do frontend.

### `POST /functions/v1/billing-webhook`

Função pública sem JWT de usuário, com assinatura específica do gateway. Insere inbox idempotente e processa:

- assinatura ativada/renovada/cancelada;
- pagamento de pacote aprovado/estornado;
- concessão ou reversão no ledger.

Supabase é backend e banco; não substitui um processador de pagamentos.

## Social

### `POST /functions/v1/social-connect`

Gera URL OAuth com `state` assinado e PKCE quando suportado.

### `GET /functions/v1/social-callback`

Valida state, troca code no servidor, guarda tokens no cofre, persiste apenas referência e redireciona à aplicação.

## Webhooks de IA/vídeo

Webhooks não devem usar JWT de usuário. Use segredo/assinatura do provedor, corpo bruto e deduplicação por ID externo. Se Higgsfield fornecer somente polling, não exponha endpoint fictício; worker consulta `getStatus`.

## Endpoints administrativos

- `POST admin-credit-adjust`: exige `system_admin`, motivo obrigatório e dupla confirmação para valores altos.
- `POST admin-user-status`: suspender/reativar com auditoria.
- `POST admin-plan-version`: cria versão; não sobrescreve contratos passados.
- `POST admin-template-publish`: valida schema e ativa versão.
- `POST admin-prompt-activate`: garante um ativo por tarefa/formato.
- `POST admin-job-retry`: reprocessamento com motivo.

Todas as ações administrativas passam por endpoint, mesmo que o dashboard consiga acessar a tabela.

## Leitura direta via Supabase

Com RLS, o frontend pode ler:

- perfil e organizações do usuário;
- marcas;
- conteúdos e versões;
- agenda e jobs próprios;
- catálogo ativo de planos/templates;
- saldo e extrato próprios em views seguras;
- notificações.

CRUD direto pode ser aceito para drafts e preferências simples. Ao aprovar, cobrar, agendar, publicar ou ativar versão, use endpoint transacional.

## Realtime

Assinaturas sugeridas:

```text
ai_jobs: id = <jobId>
ai_job_events: ai_job_id = <jobId>
publishing_jobs: organization_id = <orgId>
notifications: user_id = auth.uid()
```

Ao reconectar, busque o estado atual antes de continuar. Eventos Realtime podem ser perdidos durante desconexão; a tabela é a fonte de verdade.

## Segurança de Edge Functions

- Funções de usuário validam o JWT e usam cliente RLS-scoped para ownership.
- Cliente admin/service role só é usado depois dessa validação.
- Workers e Cron usam chave secreta nomeada, não chave pública.
- CORS permite apenas domínios conhecidos em produção.
- Rate limit por usuário, organização, IP e operação cara.
- Limite de payload e timeout.
- Zod valida corpo e descarta propriedades desconhecidas.
- Logs recebem IDs, nunca secrets ou dados de cartão.

## Versionamento da API

Comece com schemas compatíveis e acrescente campos opcionais. Para mudança incompatível, use function `v2-*` ou campo `apiVersion`. Jobs persistidos devem guardar a versão do payload, pois podem terminar depois de um deploy.

## Referências oficiais

- [Supabase Edge Functions](https://supabase.com/docs/guides/functions)
- [Autenticação de Edge Functions](https://supabase.com/docs/guides/functions/auth)
- [Secrets de Edge Functions](https://supabase.com/docs/guides/functions/secrets)
- [Storage](https://supabase.com/docs/guides/storage)

