# 08 — Roadmap de implementação

## Estratégia

Migrar por fatias verticais e feature flags. Não substituir todos os repositories de uma vez. Cada fase deve deixar o app executável e permitir rollback do adapter novo.

## Fase 0 — decisões e contratos

Entregáveis:

- projeto Supabase local, staging e produção;
- escolha de gateway de pagamento;
- acesso comercial/documentação do provedor de vídeo;
- políticas de crédito e reembolso;
- contratos TypeScript dos providers;
- diagrama e threat model aprovados;
- definição de retenção/LGPD.

Critério de saída: não há dependência crítica apoiada em scraping ou endpoint não documentado.

## Fase 1 — fundação Supabase

1. Instalar Supabase CLI e `@supabase/supabase-js`.
2. Criar pasta `supabase/migrations`.
3. Criar enums, profiles, organizations, members, brands e audit.
4. Implementar RLS e testes com usuário A/B.
5. Configurar Auth, e-mails e recuperação de senha.
6. Criar `SupabaseAuthRepository`, `SupabaseUserRepository` e `SupabaseBrandRepository`.
7. Usar somente adapters Supabase no runtime; repositories em memória ficam restritos aos testes isolados.

Critério: login/cadastro/onboarding persistem após refresh e nenhum usuário lê outra organização.

## Fase 2 — Storage e biblioteca

1. Criar buckets privados e policies.
2. Implementar autorização/finalização de upload.
3. Criar `storage_objects`, `contents`, `content_versions` e `content_media`.
4. Migrar biblioteca, detalhe, edição e downloads.
5. Gerar signed URLs sob demanda.

Critério: post, carrossel, story e Reel enviados persistem, com validação por formato.

## Fase 3 — planos, pagamentos e ledger

1. Criar plans, subscriptions, products, purchases, wallets e ledger.
2. Implementar RPCs atômicas e invariantes.
3. Integrar checkout em sandbox e webhook assinado.
4. Migrar tela mensal/anual e compra extra.
5. Aplicar 2 créditos ao agendamento manual.

Critério: request/webhook repetido não duplica assinatura, compra ou débito; saldo nunca fica negativo.

## Fase 4 — templates e prompts

1. Importar catálogo e hashes dos 728 templates.
2. Armazenar specs imutáveis no Storage ou JSONB conforme decisão.
3. Criar versões/ativação e auditoria.
4. Migrar editor administrativo.
5. Validar round-trip dos ZIPs e schema legado.

Critério: importação/exportação preserva os campos e uma versão publicada não é sobrescrita.

## Fase 5 — IA de texto e renderer

1. Criar secrets da OpenAI no staging.
2. Implementar `OpenAITextGenerationProvider` com Responses API e schema.
3. Criar `ai_jobs`, events, usage, outbox e fila `ai_text`.
4. Renderizar template localmente/backend.
5. Conectar tela de progresso por Realtime.
6. Adicionar budgets, retry e cancelamento.

Critério: plano semanal/copy/legenda/hashtags/roteiro são determinísticos no schema, rastreáveis e cobrados uma vez.

## Fase 6 — imagens

1. Implementar GPT Image 2 no adapter.
2. Separar preview low do final medium/high.
3. Salvar outputs no Storage e registrar custo.
4. Reutilizar assets e regenerar apenas a peça necessária.
5. Moderar e validar dimensões.

Critério: saída final usa identidade/template; alterar texto não gera nova imagem desnecessariamente.

## Fase 7 — planejamento e agenda reais

1. Criar weekly plans/slots e função `confirm_weekly_plan`.
2. Aplicar limite de até 5 conteúdos **por dia selecionado**.
3. Validar data/fuso/conflito.
4. Confirmar plano e jobs em transação/outbox.
5. Exibir por semana, até cinco cards por dia e preview completo ao abrir.

Critério: confirmação parcialmente falha não cria conteúdo/cobrança órfã.

## Fase 8 — vídeo

1. Fechar acesso/termos do Higgsfield ou escolher provider com API pública.
2. Implementar adapter e testes de contrato.
3. Criar queue worker com polling/webhook.
4. Reservar teto de créditos e timeout.
5. Copiar output ao Storage e gerar capa/thumbnail.

Critério: provider pode ser trocado sem alterar UI/domínio; job longo sobrevive a deploy/reload.

## Fase 9 — publicação social

1. Registrar app na plataforma social e obter permissões necessárias.
2. Implementar OAuth e cofre de tokens.
3. Criar publishing jobs/attempts e fila.
4. Cron despacha jobs vencidos.
5. Retry, reautenticação e dead-letter.
6. Métricas/IDs externos e auditoria.

Critério: não há publicação duplicada sob concorrência/retry e o usuário recebe erro acionável.

## Fase 10 — produção

- E2E mobile completo em staging.
- Testes de carga nas filas e leitura semanal.
- Revisão de RLS/secrets.
- Alertas e dashboards.
- Backup/restauração.
- Termos/LGPD/suporte.
- Deploy progressivo com feature flags.

## Mapeamento dos repositories atuais

| Atual | Adapter real |
|---|---|
| `MemoryAuthRepository` | `SupabaseAuthRepository` |
| `MemoryUserRepository` | `SupabaseProfileRepository` |
| `MemorySubscriptionRepository` | `SupabaseBillingRepository` + Edge Functions |
| `MemoryContentRepository` | `SupabaseContentRepository` |
| `MemoryPlannerRepository` | `SupabasePlannerRepository` + RPC confirm |
| `BrowserTemplateRepository` | `SupabaseTemplateRepository` + Storage |
| `MemoryPromptRepository` | `SupabasePromptRepository` |
| `MemoryQueueRepository` | `SupabasePublishingRepository` + Queue |
| `MemoryAiGenerationRepository` | Edge Function + `AiJobRepository` |
| `MemorySocialAccountRepository` | `SupabaseSocialAccountRepository` + OAuth server |

O container escolhe adapters. Componentes continuam chamando thunk/caso de uso.

## Estratégia de testes

### Banco

- migrations sobem do zero;
- policies com anon, usuário A, usuário B, editor, admin e system admin;
- funções de crédito sob concorrência;
- transições inválidas;
- timezone/DST e conflitos;
- até cinco conteúdos por dia.

### Edge Functions

- auth ausente/inválida;
- schema e limite de payload;
- idempotência;
- provider timeout/429/5xx;
- webhook inválido/duplicado;
- rollback/release de créditos.

### Frontend

- repositories em memória para unit/component tests;
- adapters Supabase em integração local;
- Realtime desconectado e retomado;
- signed URL expirada;
- saldo alterado por outra aba.

### E2E

- cadastro → onboarding → pagamento sandbox → geração → agenda;
- semana com vários dias e cinco itens em um dia;
- manual debitando 2 créditos;
- falha e retry;
- vídeo assíncrono;
- admin ativa prompt/template;
- usuário B não acessa recursos de A.

## Primeira sprint recomendada

1. Adicionar Supabase CLI/SDK.
2. Aplicar o núcleo do blueprint SQL.
3. Criar RLS e testes de isolamento.
4. Implementar Auth/Profile/Brand adapters.
5. Persistir onboarding.
6. Criar ambientes e secrets vazios, sem integrar IA ainda.

Essa sprint entrega uma base segura antes de adicionar custo externo.
