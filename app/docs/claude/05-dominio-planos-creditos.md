# 05 — Conteúdo, planos, assinatura e créditos

## Prompt da fase

Implemente o modelo de domínio persistente descrito em `docs/supabase/02-modelo-de-dados.md`, com migrations, repositories, casos de uso e testes de concorrência.

## Conteúdo

Criar e integrar:

- `contents` como identidade editável;
- `content_versions` imutável;
- `content_media`, `carousel_slides` e `reel_scenes`;
- current/approved version;
- busca, filtros, folders, tags e favorite;
- duplicação criando nova identidade/versionamento;
- soft delete e purge controlado.

Publicação sempre aponta para versão aprovada imutável. Editar depois do agendamento cria nova versão e exige decisão explícita para atualizar o job.

## Planos e assinatura

Criar planos versionados mensal/anual e produtos de créditos adicionais. Preços são centavos inteiros e vêm do servidor. Uma assinatura salva snapshot do plano contratado; alteração administrativa não muda contratos anteriores silenciosamente.

Supabase não é processador de pagamento. Nesta fase prepare contratos e fake/sandbox até a fase de billing.

## Ledger

Implementar:

- `credit_wallets` como saldo materializado;
- `credit_transactions` append-only com `balance_delta` e `reserved_delta`;
- grants, purchase, reserve, consume, release, refund, expire, adjustment;
- idempotency key única por organização/escopo;
- `reservation_key` para ligar geração/publicação;
- reconciliação que recalcula wallet pelo ledger.

### RPCs internas

- `grant_credits`;
- `reserve_credits`;
- `finalize_credit_reservation`;
- `release_credit_reservation`;
- `adjust_credits_admin` com ator/motivo/AAL2;
- `reconcile_wallet` somente operador.

Use `FOR UPDATE`, constraints e transação. Não implemente read-then-write no JavaScript para saldo.

## Regras

- agendamento manual: exatamente 2 créditos;
- uploads e biblioteca: geração de mídia custa zero, mas agendamento manual ainda custa 2;
- geração reserva a estimativa e finaliza custo real dentro do teto aceito;
- falha técnica antes de resultado libera reserva;
- request repetido retorna a transação original;
- saldo disponível = `balance - reserved`;
- nenhuma operação pode deixar valores negativos;
- ajustes admin são auditados e não alteram linhas antigas.

## Testes de concorrência

- duas reservas simultâneas para o último saldo: apenas uma passa;
- 20 requests com mesma idempotency key: uma transação;
- finalizar duas vezes: um consumo;
- release após consume: rejeitado;
- webhook de compra duplicado: um grant;
- saldo insuficiente não cria job/conteúdo parcial;
- reconciliação encontra zero diferença;
- usuário não escreve ledger/wallet diretamente.

## Integração de repositories

Substitua gradualmente:

- `MemoryContentRepository`;
- partes de `MemorySubscriptionRepository`;
- bootstrap de planos/assinatura.

Componentes continuam usando thunks/casos de uso.

## Gate

Fase bloqueada se o saldo puder ficar negativo, se ledger for editável pelo cliente ou se concorrência/idempotência falhar.

