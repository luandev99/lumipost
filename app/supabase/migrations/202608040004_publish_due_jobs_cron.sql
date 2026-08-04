-- O job "lumipost-publish-due-jobs" já existia em produção (criado direto
-- pelo SQL Editor, fora de migration) chamando a mesma função publish-due-jobs
-- que processa a fila de publicação no Instagram a cada minuto. Esta migration
-- só registra formalmente o que já roda, para o histórico versionado bater
-- com o estado real do banco — cron.schedule faz upsert por nome de job, então
-- reaplicar isto não duplica nem interrompe o agendamento já ativo.
select cron.schedule(
  'lumipost-publish-due-jobs',
  '* * * * *',
  $cron$
  select net.http_post(
    url := 'https://djddjdjoarrwjiwqsnoa.supabase.co/functions/v1/publish-due-jobs',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-worker-secret', (
        select decrypted_secret
        from vault.decrypted_secrets
        where name = 'publish_worker_secret'
        limit 1
      )
    ),
    body := '{"batchSize":5}'::jsonb
  );
  $cron$
);
