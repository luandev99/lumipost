# 02 — Modelo de dados sugerido

## Convenções

- Chaves primárias UUID com `gen_random_uuid()`.
- Datas como `timestamptz` em UTC; fuso IANA separado (`America/Sao_Paulo`).
- `created_at`, `updated_at` e, quando necessário, `deleted_at`.
- `organization_id` em todas as entidades pertencentes ao cliente.
- Valores monetários em centavos inteiros e moeda ISO (`BRL`).
- Custos de provedor em micros de dólar ou centavos, nunca `float`.
- Enums apenas para estados realmente estáveis; tabelas para itens administráveis.
- Binários no Storage; banco guarda `bucket`, `object_path`, MIME, tamanho e hash.
- `jsonb` para payloads versionados, nunca como substituto universal de relacionamentos.

## Identidade e organizações

### `profiles`

Extensão pública mínima de `auth.users`.

| Coluna | Tipo | Observação |
|---|---|---|
| `id` | uuid PK/FK | referencia `auth.users(id)` com cascade |
| `display_name` | text | nome exibido |
| `avatar_path` | text | objeto no Storage |
| `locale` | text | padrão `pt-BR` |
| `system_role` | enum | `user` ou `system_admin`; só servidor altera |
| `status` | enum | `active`, `suspended`, `deleted` |
| `onboarding_completed_at` | timestamptz | nulo enquanto incompleto |

### `organizations`

`id`, `name`, `slug`, `status`, `timezone`, `owner_user_id`, timestamps.

### `organization_members`

`organization_id`, `user_id`, `role`, `status`, `invited_by`, `joined_at`. Chave única em `(organization_id, user_id)`.

### `brands`

Uma organização pode ter uma ou mais marcas.

`id`, `organization_id`, `name`, `description`, `industry`, `specialty`, `audience`, `goals text[]`, `content_formats text[]`, `personality text[]`, `tone text[]`, `primary_color`, `secondary_color`, `heading_font`, `body_font`, `visual_style`, `logo_asset_id`, `is_default`, timestamps.

### `brand_assets`

`id`, `organization_id`, `brand_id`, `kind` (`logo`, `reference`, `font`, `palette`, `product`), `storage_object_id`, `label`, `metadata jsonb`.

## Planos, assinatura, pagamentos e créditos

### `plans`

`id`, `code`, `name`, `billing_period`, `price_cents`, `currency`, `included_credits`, `duration_days`, `features jsonb`, `is_featured`, `is_available`, `version`, timestamps.

Não altere retroativamente o significado de um plano contratado. Use versão ou salve um snapshot em `subscriptions`.

### `subscriptions`

`id`, `organization_id`, `plan_id`, `status`, `provider`, `provider_customer_id`, `provider_subscription_id`, `current_period_start`, `current_period_end`, `cancel_at_period_end`, `plan_snapshot jsonb`, timestamps.

### `credit_wallets`

Uma linha por organização e moeda de crédito: `organization_id`, `balance`, `reserved`, `lifetime_granted`, `lifetime_spent`, `version`, `updated_at`.

### `credit_transactions`

Livro-razão imutável.

| Coluna | Uso |
|---|---|
| `id` | identificador |
| `organization_id` | proprietário |
| `type` | `grant`, `purchase`, `reserve`, `consume`, `release`, `refund`, `expire`, `adjustment` |
| `balance_delta` | positivo para entrada, negativo para consumo |
| `reserved_delta` | positivo ao reservar, negativo ao consumir/liberar |
| `balance_after` | auditoria |
| `reservation_key` | liga reserva e conclusão |
| `reference_type/id` | job, publicação, pagamento ou ajuste |
| `idempotency_key` | evita cobrança duplicada |
| `metadata` | modelo, estimativa, operador |
| `created_by` | usuário ou sistema |

Nunca confie somente no `balance`. O saldo em `credit_wallets` é um cache transacional do ledger. Separar os deltas de saldo e de reserva evita representar uma reserva como se já fosse consumo.

### `credit_products` e `credit_purchases`

Produtos adicionais (50, 150, 400 créditos) e suas compras. `credit_purchases` guarda provider, valor, status e IDs externos. Créditos só entram após webhook de pagamento verificado.

### `payment_events`

Inbox de webhooks: `provider`, `external_event_id`, `signature_valid`, `payload`, `status`, `processed_at`, `error`. Único em `(provider, external_event_id)`.

## Conteúdo e mídia

### `contents`

Entidade principal editável.

`id`, `organization_id`, `brand_id`, `title`, `format`, `source`, `status`, `topic`, `current_version_id`, `approved_version_id`, `folder`, `tags text[]`, `favorite`, `created_by`, timestamps e `deleted_at`.

Formatos iniciais: `post`, `carousel`, `story`, `reel`, `video`, `caption`.

### `content_versions`

Snapshot imutável sempre que IA ou usuário salva uma revisão:

`id`, `content_id`, `version`, `caption`, `hashtags text[]`, `cta`, `alt_text`, `location`, `link`, `first_comment`, `collaborators text[]`, `tagged_people text[]`, `copy_payload jsonb`, `prompt_version_id`, `template_version_id`, `created_by`, `created_at`.

Índice único `(content_id, version)`.

### `content_media`

`id`, `content_version_id`, `storage_object_id`, `role` (`primary`, `slide`, `cover`, `video`, `thumbnail`, `audio`), `position`, `duration_ms`, `width`, `height`, `metadata jsonb`.

### `carousel_slides`

Se for necessário editar cada slide semanticamente: `id`, `content_version_id`, `position`, `slide_type`, `headline`, `body`, `cta`, `template_version_id`, `render_payload jsonb`. Único em `(content_version_id, position)`.

### `reel_scenes`

`id`, `content_version_id`, `position`, `title`, `narration`, `visual_prompt`, `duration_ms`, `media_asset_id`, `metadata`.

### `storage_objects`

Catálogo próprio para não espalhar paths:

`id`, `organization_id`, `bucket`, `object_path`, `mime_type`, `size_bytes`, `sha256`, `width`, `height`, `duration_ms`, `source`, `created_by`, timestamps. Único em `(bucket, object_path)`.

## Planejamento semanal

### `weekly_plans`

`id`, `organization_id`, `brand_id`, `week_start date`, `timezone`, `status` (`draft`, `review`, `confirmed`, `canceled`), `objective`, `requested_by`, `confirmed_at`, timestamps.

Índice único parcial para impedir dois planos ativos da mesma marca/semana, se essa for a regra de produto.

### `weekly_slots`

`id`, `weekly_plan_id`, `day date`, `local_time time`, `scheduled_at timestamptz`, `format`, `source`, `topic`, `quantity`, `slides`, `content_id`, `library_content_id`, `estimated_credits`, `position`, `status`.

A regra atual pode permitir até **5 conteúdos por dia selecionado**. A restrição “até 5” depende do produto e deve ser validada na função de confirmação, agrupando por `day`; não usar uma regra antiga de cinco por semana.

## Geração por IA

### `ai_jobs`

`id`, `organization_id`, `brand_id`, `content_id`, `job_type`, `provider`, `model`, `status`, `progress`, `estimated_credits`, `reserved_credits`, `consumed_credits`, `provider_job_id`, `idempotency_key`, `input_payload`, `output_payload`, `error_code`, `error_message`, `attempts`, `started_at`, `finished_at`, timestamps.

Único em `(organization_id, idempotency_key)`.

### `ai_job_events`

Linha do tempo de progresso: `id`, `ai_job_id`, `sequence`, `stage`, `message`, `progress`, `metadata`, `created_at`. Serve para a animação de geração e auditoria.

### `provider_usage`

`id`, `organization_id`, `ai_job_id`, `provider`, `model`, `operation`, `input_units`, `output_units`, `provider_cost_microusd`, `latency_ms`, `provider_request_id`, `created_at`.

## Templates e prompts administrativos

### `visual_templates`

Catálogo: `id`, `template_key`, `name`, `format`, `package_id`, `aspect_ratio`, `width`, `height`, `status`, `active_version_id`, timestamps.

### `visual_template_versions`

`id`, `visual_template_id`, `version`, `schema_version`, `slide_type`, `spec_path`, `spec_sha256`, `validation_status`, `validation_errors jsonb`, `created_by`, `created_at`, `published_at`.

Para os 728 JSONs existentes, recomenda-se armazenar metadados no Postgres e a especificação imutável no Storage privado. Um campo `spec jsonb` também é aceitável caso o tamanho médio seja pequeno e a edição transacional seja mais importante; escolha uma única estratégia.

### `prompt_templates`

Identidade lógica: `id`, `task`, `format`, `name`, `status`, `active_version_id`, timestamps. Restrição para um ativo por combinação de tarefa e formato.

### `prompt_versions`

`id`, `prompt_template_id`, `version`, `system_prompt`, `user_prompt`, `variables text[]`, `output_schema jsonb`, `allowed_packages text[]`, `allowed_template_ids uuid[]`, `model_policy jsonb`, `created_by`, `created_at`, `activated_at`.

Uma geração sempre guarda o `prompt_version_id` usado; ativar nova versão não altera jobs antigos.

## Redes sociais e publicação

### `social_accounts`

`id`, `organization_id`, `brand_id`, `network`, `external_account_id`, `handle`, `display_name`, `avatar_url`, `status`, `token_secret_ref`, `token_expires_at`, `scopes text[]`, `metadata`, timestamps.

`token_secret_ref` aponta para secret/Vault; nunca grave access token em texto puro nem exponha essa coluna ao cliente.

### `publishing_jobs`

`id`, `organization_id`, `content_id`, `content_version_id`, `social_account_id`, `scheduled_at`, `timezone`, `status`, `attempts`, `max_attempts`, `next_attempt_at`, `locked_at`, `locked_by`, `external_post_id`, `provider_response`, `last_error_code`, `last_error_message`, `published_at`, timestamps.

Restrição única adequada, por exemplo `(social_account_id, content_version_id, scheduled_at)`, e uma `idempotency_key` externa.

### `publishing_attempts`

`id`, `publishing_job_id`, `attempt`, `started_at`, `finished_at`, `http_status`, `request_summary`, `response_summary`, `error_code`, `retryable`.

## Operação, auditoria e confiabilidade

### `idempotency_keys`

`organization_id`, `key`, `scope`, `request_hash`, `response_status`, `response_body`, `expires_at`. Único em `(organization_id, scope, key)`.

### `webhook_events`

Inbox genérica para OpenAI/Higgsfield/pagamento/social. Armazena o corpo original, headers filtrados, assinatura, status e número de tentativas.

### `audit_logs`

Append-only: `organization_id` opcional, `actor_user_id`, `actor_type`, `action`, `entity_type`, `entity_id`, `before`, `after`, `ip_hash`, `user_agent`, `created_at`.

### `notifications`

`id`, `organization_id`, `user_id`, `type`, `title`, `body`, `data`, `read_at`, `created_at`.

## Índices mínimos

- Todas as FKs.
- `contents(organization_id, status, created_at desc)`.
- `contents` com GIN em `tags` e busca textual para título/legenda, se necessário.
- `weekly_plans(organization_id, week_start)`.
- `weekly_slots(weekly_plan_id, scheduled_at)`.
- `ai_jobs(status, created_at)` e `(provider, provider_job_id)`.
- `publishing_jobs(status, next_attempt_at, scheduled_at)`.
- `credit_transactions(organization_id, created_at desc)`.
- `webhook_events(provider, external_event_id)` único.
- `audit_logs(organization_id, created_at desc)`.

## O que não deve ser misturado

- `contents.status` representa ciclo editorial; `publishing_jobs.status` representa tentativa numa rede.
- `subscriptions` não deve conter o único saldo de créditos.
- Um upload não é uma URL solta; deve ser um objeto catalogado.
- Template publicado e prompt ativo são versões imutáveis, não linhas sobrescritas.
- Payload bruto de provedor não substitui campos normalizados necessários ao produto.
