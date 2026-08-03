# 07 — Planejamento semanal, agenda e publicação

## Prompt da fase

Implemente planejamento e fila reais com timezone correto, idempotência e snapshots aprovados.

## Planejamento

Persistir `weekly_plans` e `weekly_slots`. A UI deve:

- navegar por semana;
- exibir agendamentos existentes;
- selecionar dias da semana;
- gerar até cinco conteúdos para cada dia selecionado;
- permitir 1–5 conteúdos por dia, não por semana;
- editar formato, fonte, assunto, horário e quantidade;
- mostrar custo antes de confirmar;
- abrir card com preview completo, slides, legenda, hashtags e CTA.

### Confirmação atômica

`confirm_weekly_plan` deve:

1. validar usuário/role/brand;
2. travar o plano;
3. validar semana, datas, timezone e horários futuros;
4. somar `quantity` por dia e impedir mais de cinco;
5. impedir conflito exato por conta social;
6. validar uploads/biblioteca;
7. calcular/reservar custo com regra versionada;
8. criar conteúdos/jobs/outbox;
9. confirmar o plano;
10. fazer rollback integral em qualquer erro.

## Timezone

Receba horário local e timezone IANA, converta no servidor para UTC e guarde ambos. Teste virada de dia e horário de verão em fusos que o utilizam. Nunca concatene string e assuma timezone do servidor.

## Publicação

Criar `publishing_jobs`, `publishing_attempts`, fila `social_publish` e Cron curto. O dispatcher usa `FOR UPDATE SKIP LOCKED` e lote limitado.

Estados válidos e transições são controlados pelo servidor. Retry respeita `Retry-After`, backoff, max attempts e idempotency key externa.

### Conta social

- OAuth e troca de code no servidor;
- state/PKCE quando suportado;
- tokens no `TokenVault`;
- refresh no servidor;
- scopes mínimos;
- reconexão quando expirado/revogado.

Até Meta/Higgsfield estarem configurados, mantenha provider fake e UI claramente marcada em staging. Não publique usando token/cookie pessoal.

## Créditos

- conteúdo agendado manualmente consome 2 créditos uma única vez;
- confirmação por IA usa reserva da geração conforme itens;
- reagendar não cobra novamente se for o mesmo publishing job e regra assim definida;
- duplicar/criar novo job aplica regra exibida;
- cancelar publicação não reembolsa automaticamente sem política explícita.

## Testes

- 5 itens em cada um de 7 dias passa; 6 em um dia falha;
- limite antigo de 5/semana não existe;
- passado/conflito/timezone inválido falha;
- confirmação concorrente/idempotente;
- falha no item 3 faz rollback de todos;
- dois workers não publicam o mesmo job;
- retry/webhook duplicado não cria segundo post;
- token expirado pausa e notifica;
- versão publicada é a aprovada/agendada;
- manual debita 2 exatamente uma vez.

## Gate

Fase bloqueada se houver confirmação parcial, publicação duplicada ou cálculo de timezone dependente do navegador.

## Referências

- [Supabase Cron](https://supabase.com/docs/guides/cron)
- [Agendamento de Edge Functions](https://supabase.com/docs/guides/functions/schedule-functions)

