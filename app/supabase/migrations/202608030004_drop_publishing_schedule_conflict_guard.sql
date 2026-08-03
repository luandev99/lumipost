-- Decisão do produto: publicar mais de um conteúdo na mesma conta no mesmo
-- instante exato é permitido de propósito (ex.: post + story juntos). O
-- índice único anterior bloqueava isso; nenhum outro código depende dele.

drop index if exists public.publishing_jobs_unique_schedule_idx;
