# 12 — Runbook operacional a ser preenchido

Claude deve transformar este template em instruções específicas após a implementação. Nunca incluir valores de secrets.

## Inventário

- URLs/refs não secretas de staging e produção;
- funções e versão implantada;
- filas, consumers e Cron;
- buckets;
- providers ativos e feature flags;
- dashboards e alertas;
- owners técnicos/negócio.

## Operações diárias

### Verificar saúde

- backlog e idade da mensagem mais antiga;
- jobs presos/retry/dead-letter;
- publicações atrasadas;
- webhooks falhos;
- custo diário/mensal;
- wallet/reconciliação;
- tokens sociais expirando;
- erros 401/403/429/5xx.

### Reprocessar job

Documentar endpoint/comando autorizado, roles, AAL2, idempotency key e auditoria. Nunca alterar status manualmente sem rotina.

### Cancelar

Documentar efeitos sobre provider, fila, conteúdo e reserva de crédito.

### Ajustar créditos

Somente endpoint admin AAL2, motivo/ticket e dupla revisão acima de limite. Nunca `UPDATE wallet` direto.

## Secrets

### Adicionar/rotacionar

1. criar nova credencial no provider;
2. cadastrar diretamente em Supabase Edge Function Secrets;
3. testar staging;
4. promover/atualizar produção com aprovação;
5. observar erros;
6. revogar antiga;
7. registrar apenas nome/data/responsável, nunca valor.

### Secret vazado

1. revogar imediatamente no provider;
2. criar novo secret;
3. atualizar Supabase;
4. investigar Git/logs/bundle/CI;
5. invalidar sessões/tokens relacionados;
6. avaliar impacto/notificação;
7. adicionar regressão no scanner.

## Incidentes

### Publicação duplicada

- pausar consumer;
- identificar idempotency/external IDs;
- impedir novos retries;
- avaliar remoção segura com autorização;
- corrigir e testar concorrência;
- reconciliar créditos.

### Gasto anormal de IA

- desabilitar provider/feature flag;
- reduzir budgets/rate limits;
- identificar org/job/chave;
- cancelar jobs externos quando possível;
- reconciliar custo e créditos;
- rotacionar key se houver abuso.

### Vazamento cross-tenant

- classificar como crítico;
- limitar acesso/desativar endpoint;
- preservar evidência sem ampliar exposição;
- corrigir policy/function/cache;
- testar todas as tabelas correlatas;
- seguir plano LGPD/comunicação.

### Fila parada

- verificar Cron/worker/visibility timeout;
- medir idade/backlog;
- evitar iniciar consumers demais;
- recuperar lease e processar em lotes;
- monitorar provider rate limit.

## Backup e restore

Documentar RPO/RTO, PITR, restore de banco em ambiente isolado e estratégia separada para objetos do Storage. A documentação do Supabase alerta que backups do banco não incluem automaticamente os objetos do Storage.

Testar restauração periodicamente e registrar resultado.

## Deploy e rollback

- checklist pré-deploy;
- migrations expand/contract;
- deploy functions/frontend;
- smoke/RLS/billing sandbox;
- rollback de frontend/function;
- compatibilidade do schema durante rollback;
- decisão e responsável.

## Exclusão/exportação LGPD

Documentar autenticação do solicitante, export, deleção de Auth/DB/Storage/Vault/providers, retenções legais, auditoria e confirmação final.

## Revisões periódicas

- mensal: acessos humanos, costs, dead-letter e secrets próximos de rotação;
- trimestral: restore, RLS, dependências e incident tabletop;
- a cada provider/model novo: termos, custo, privacy e testes de contrato;
- a cada mudança crítica: atualizar threat model e auditoria.

