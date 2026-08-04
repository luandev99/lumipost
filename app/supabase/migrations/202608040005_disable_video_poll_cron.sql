-- Reels/vídeo por IA (Higgsfield) não está em uso agora — desativa o polling
-- que rodava a cada minuto sem ter nada para processar. Reagendável depois
-- com o mesmo cron.schedule('lumipost-poll-video-jobs', ...) já versionado em
-- 202608030003_video_generation_jobs.sql, se a geração de vídeo voltar a ser usada.
select cron.unschedule('lumipost-poll-video-jobs');
