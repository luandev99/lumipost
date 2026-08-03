# 04 — Rotinas, filas, Cron e webhooks

## Princípios

- Toda operação externa pode repetir, atrasar ou falhar.
- “Exactly once” ponta a ponta não existe ao chamar terceiros; obtenha efeito único com idempotência.
- O banco decide crédito, versão aprovada e transição de estado.
- Mensagem só é removida/arquivada após persistir o resultado.
- Workers usam lease/visibility timeout e heartbeat em processos longos.
- O usuário acompanha um job persistido, não uma requisição HTTP aberta.

Supabase Queues é baseado em `pgmq` e fornece entrega durável com visibility timeout. Supabase Cron é baseado em `pg_cron` e pode executar SQL/funções ou invocar Edge Functions.

## Máquinas de estado

### `ai_jobs`

```text
pending -> queued -> processing -> waiting_provider -> processing -> succeeded
                               \-> retry_scheduled -> queued
                               \-> failed
pending/queued -> canceled
```

### `publishing_jobs`

```text
draft -> scheduled -> queued -> publishing -> published
                                  |-> retry_scheduled -> queued
                                  |-> failed
scheduled/retry_scheduled -> paused/canceled
```

Transições devem passar por função que compare o estado atual. Não aceite atualização arbitrária de status pelo cliente.

## Rotinas de banco sugeridas

### `reserve_credits`

Entrada: organização, valor estimado, chave idempotente e referência. Trava a wallet com `FOR UPDATE`, verifica disponível (`balance - reserved`), adiciona reserva no ledger e atualiza `reserved`.

### `finalize_credit_reservation`

Converte a reserva em consumo real. Se o custo real for menor, libera a diferença; se maior, respeita um teto previamente autorizado ou falha para revisão. Nunca cobra acima do limite sem consentimento.

### `release_credit_reservation`

Libera reserva quando job é cancelado ou falha antes de produzir valor. A política de reembolso após uma saída utilizável deve ser explícita.

### `confirm_weekly_plan`

Em uma transação:

1. valida plano, marca, membro e timezone;
2. exige datas futuras;
3. agrupa slots e limita a cinco conteúdos por dia selecionado;
4. impede conflitos exatos por conta social;
5. calcula custo com tabela de preços versionada;
6. reserva créditos;
7. cria conteúdos/jobs e snapshots;
8. marca o plano como confirmado;
9. cria outbox/mensagens.

Se uma etapa falhar, nada é confirmado.

### `schedule_content`

Valida versão aprovada, conta social, data, duração e saldo; consome/reserva os **2 créditos do agendamento manual** com idempotência e cria `publishing_job`.

### `claim_due_publishing_jobs`

Seleciona em lote com `FOR UPDATE SKIP LOCKED`, marca como `queued` e emite mensagens. Isso permite vários workers sem publicar duas vezes.

### `retry_job`

Somente `failed`/`retry_scheduled`, respeitando `max_attempts`, `next_attempt_at` e autorização. Gera auditoria.

## Outbox transacional

Uma gravação no banco e o envio à fila não formam uma única transação distribuída. Use uma tabela `outbox_events`:

1. transação cria entidade + `outbox_event`;
2. dispatcher lê eventos não publicados com `SKIP LOCKED`;
3. envia à Queue;
4. grava `published_at`;
5. consumidor continua idempotente, pois o dispatcher também pode repetir.

Colunas: `id`, `aggregate_type`, `aggregate_id`, `event_type`, `payload`, `attempts`, `next_attempt_at`, `published_at`, `last_error`, `created_at`.

## Cron sugerido

| Frequência | Job | Observação |
|---|---|---|
| a cada minuto | despachar publicações vencidas | lote pequeno e idempotente |
| a cada minuto | despachar outbox | sem chamadas longas |
| a cada 2–5 min | consultar vídeos pendentes | somente se provedor não tiver webhook |
| a cada 5 min | recuperar leases expirados | reprograma jobs abandonados |
| a cada hora | expirar uploads incompletos/exports | remove metadados temporários |
| diário | expirar créditos conforme regra | ledger, nunca update silencioso |
| diário | alertas de token social | avisar antes do vencimento |
| diário | agregação de custo/uso | dashboard e alerta |

Cron não deve renderizar vídeo nem ficar aguardando provedor. Ele apenas chama uma rotina curta/worker.

## Retry e backoff

Classifique erros:

- **transitório:** timeout, 429, 5xx, indisponibilidade; repetir;
- **autenticação:** token expirado; tentar refresh uma vez e pedir reconexão;
- **entrada inválida:** prompt, proporção ou mídia; falha definitiva;
- **moderação/política:** falha definitiva com mensagem segura;
- **saldo externo/cota:** pausar e alertar operador;
- **conflito/idempotência:** buscar resultado já criado.

Exemplo de backoff com jitter: 1 min, 5 min, 20 min, 1 h, 6 h. Respeitar `Retry-After` do provedor.

## Webhooks

Endpoint público deve:

1. ler o corpo bruto;
2. verificar assinatura e tolerância temporal conforme documentação do provedor;
3. inserir `webhook_events` com ID externo único;
4. responder 2xx rapidamente;
5. processar de forma assíncrona;
6. tornar o handler idempotente;
7. filtrar headers/tokens antes de gravar logs.

Não assuma que webhooks chegam em ordem. Consulte o estado atual e aceite apenas transições válidas.

### Higgsfield

Como não foi localizado um contrato HTTP/webhook público estável, o adapter deve suportar dois modos:

- `submit + webhook`, caso um contrato comercial forneça callback assinado; ou
- `submit + poll`, usando `provider_job_id`, intervalos e timeout configuráveis.

Não automatize a interface web do Higgsfield e não dependa de endpoints internos.

## Worker padrão

```ts
type JobMessage = { jobId: string; traceId: string }

async function process(message: JobMessage) {
  const job = await jobs.claim(message.jobId)
  if (!job || job.status === 'succeeded') return 'archive'

  try {
    const result = await provider.generate(job.normalizedInput)
    await jobs.completeAtomically(job.id, result)
    return 'archive'
  } catch (error) {
    const decision = classifyProviderError(error)
    await jobs.recordFailure(job.id, decision)
    return decision.retryable ? 'retry' : 'archive'
  }
}
```

O `completeAtomically` precisa salvar outputs, provider usage, versão do conteúdo e finalizar a reserva de créditos numa transação.

## Observabilidade operacional

Cada requisição/job possui `trace_id`. Grave:

- tempo na fila;
- duração do provedor;
- tentativas;
- modelo e operação;
- custo estimado e real;
- IDs externos;
- estado anterior e novo;
- erro normalizado, sem segredo nem mídia privada.

Métricas fundamentais: backlog por fila, idade da mensagem mais antiga, taxa de sucesso, P95 de geração, jobs órfãos, custo por conteúdo e publicação atrasada.

## Referências oficiais

- [Supabase Queues](https://supabase.com/docs/guides/queues)
- [Supabase pgmq](https://supabase.com/docs/guides/queues/pgmq)
- [Supabase Cron](https://supabase.com/docs/guides/cron)
- [Agendar Edge Functions](https://supabase.com/docs/guides/functions/schedule-functions)
- [Limites de Edge Functions](https://supabase.com/docs/guides/functions/limits)

