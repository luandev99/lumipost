# 09 — Migração do frontend e UX real

## Prompt da fase

Migre o frontend mockado para os novos casos de uso/repositories Supabase sem importar cliente Supabase diretamente em páginas/componentes.

## Container e adapters

Substituir progressivamente:

| Mock | Produção |
|---|---|
| `MemoryAuthRepository` | `SupabaseAuthRepository` |
| `MemoryUserRepository` | `SupabaseProfileRepository` |
| `MemorySubscriptionRepository` | `SupabaseBillingRepository` + Edge Functions |
| `MemoryContentRepository` | `SupabaseContentRepository` |
| `MemoryPlannerRepository` | `SupabasePlannerRepository` + RPC |
| `BrowserTemplateRepository` | `SupabaseTemplateRepository` + Storage |
| `MemoryPromptRepository` | `SupabasePromptRepository` |
| `MemoryQueueRepository` | `SupabasePublishingRepository` |
| `MemoryAiGenerationRepository` | `AiJobRepository` + Edge Functions |
| `MemorySocialAccountRepository` | `SupabaseSocialAccountRepository` |

Mantenha mocks para testes/Storybook/local explícito; produção não pode cair silenciosamente para mock.

## Bootstrap

Após sessão válida, carregar em paralelo e com cancelamento:

- profile/memberships;
- organização/brand ativa;
- assinatura/wallet;
- semana corrente;
- notificações.

Redux guarda cache e estado de UI. Refresh reidrata do servidor. Logout limpa cache, canais Realtime, object URLs e dados de tenant anterior.

## Realtime

Assinar jobs selecionados, agenda da organização e notificações com filtros. Ao reconectar, refetch antes de processar novos eventos. Desinscrever ao trocar org/logout.

## UX obrigatória

- loading/skeleton, empty, erro e retry;
- progresso de geração persistente após refresh;
- até cinco cards por dia na semana;
- modal/drawer em portal acima de tudo, altura máxima da viewport e scroll interno;
- safe-area e padding acima da bottom nav no mobile;
- preview completo ao abrir conteúdo;
- signed URL expirada é renovada;
- conflito/saldo insuficiente apresenta ação concreta;
- tema não contém segredo e pode continuar preferência local/servidor conforme escolha.

## Segurança frontend

- sem dangerouslySetInnerHTML com output de IA;
- sanitize SVG/template;
- links externos com protocolo allowlist;
- não guardar provider response bruto no Redux;
- não logar objeto de sessão;
- não mostrar detalhes internos de erro;
- não usar service key para contornar 403;
- CSP e headers de segurança configurados na Vercel;
- dependências e uploads revisados.

## Compatibilidade

Preserve mobile-first e teste 390×844, 768, 1024 e 1440. Modais não podem exceder viewport nem criar scroll na página de fundo.

## Testes

- sessão expirada/refresh;
- troca de organização sem vazamento de cache;
- Realtime reconecta;
- job termina com tela fechada;
- modal/foco/escape/scroll lock;
- bottom nav/safe area;
- URL assinada expira;
- errors RLS/429/offline;
- acessibilidade teclado/labels/foco/contraste;
- bundle não contém padrões de secrets.

## Gate

Production build deve falhar se estiver configurado para repository mock ou se uma variável server-side for referenciada pelo código do browser.

