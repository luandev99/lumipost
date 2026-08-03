# Feature flag: geração de Reel/Vídeo por IA (Higgsfield)

## Status atual

**Oculta na interface** desde 2026-08-03. O backend continua implantado e funcional
(migração aplicada, Edge Functions deployadas, cron rodando) — só a opção de
*gerar* Reel/Vídeo por IA foi escondida dos formulários, para dar mais tempo
de teste em produção antes de expor a usuários finais.

Isso **não afeta**:
- upload manual de um MP4 real (`ContentUploader`, `ManualContentEditor`) —
  continua permitindo formato Reel/Vídeo normalmente;
- conteúdo Reel/Vídeo já existente no banco — continua sendo exibido,
  editado e publicado normalmente.

## O que foi escondido e onde

Um único flag controla os dois pontos de entrada de geração por IA:

- [`src/domain/featureFlags.ts`](../../src/domain/featureFlags.ts) —
  `AI_VIDEO_GENERATION_ENABLED = false`.
- [`src/features/aiGeneration/components/AiContentWizard.tsx`](../../src/features/aiGeneration/components/AiContentWizard.tsx) —
  o seletor de formato do assistente de criação avulsa não lista mais
  "Reels" nem "Vídeo" quando o flag está desligado.
- [`src/features/planning/pages/WeeklyPlanningPage.tsx`](../../src/features/planning/pages/WeeklyPlanningPage.tsx) —
  o seletor de formato do planejamento semanal (automático e manual) não
  lista mais "Reels" quando o flag está desligado.

## Como reativar

1. Em `src/domain/featureFlags.ts`, mude `AI_VIDEO_GENERATION_ENABLED` para
   `true`.
2. Rode os gates de sempre: `npm run typecheck && npm run lint && npm run test && npm run build`.
3. Deploy do frontend (`npx vercel deploy --prod --yes`). **Nenhuma migração
   ou função do Supabase precisa ser reimplantada** — o backend do
   Higgsfield já está no ar e não muda com este flag.

Não é necessário reverter nenhuma outra alteração: os guards de agendamento
automático (`VIDEO_UPLOAD_REQUIRED` em
`supabase/functions/_shared/content-generation.ts`) continuam ativos e devem
continuar — Reel/Vídeo gerado por IA nasce como rascunho e é agendado
manualmente depois de revisado, nunca publicado sem revisão humana.

## Antes de reativar para usuários reais

- Repetir o teste ponta a ponta: gerar um Reel de rascunho, confirmar que
  `video_generation_jobs` recebe uma linha e que em 1–3 min o vídeo real
  chega em `contents.media_paths` (ver `supabase/functions/poll-video-jobs`).
- Confirmar o custo real por vídeo no painel do Higgsfield e revisar se o
  preço cobrado ao usuário (créditos Lumipost) ainda faz sentido.
- Confirmar que agendar esse conteúdo continua bloqueado até o vídeo estar
  pronto (`VIDEO_UPLOAD_REQUIRED` no submit direto).
