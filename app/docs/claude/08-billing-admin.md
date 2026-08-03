# 08 — Billing, administração, templates e prompts

## Prompt da fase

Implemente billing real por adapter, painel administrativo seguro, versionamento de templates/prompts e auditoria.

## Gateway de pagamento

Peça ao usuário escolher Stripe, Mercado Pago ou Pagar.me antes do adapter real. Enquanto isso, use `FakeBillingProvider` somente local/staging.

Contrato:

- criar customer/checkout;
- consultar status quando necessário;
- cancelar/alterar assinatura;
- verificar webhook por corpo bruto;
- normalizar eventos;
- reembolso opcional e auditado.

Preço vem do banco por `planId`/`creditProductId`; nunca aceite valor do frontend.

Webhooks usam inbox idempotente. Somente pagamento confirmado concede crédito/ativa assinatura. Chargeback/reembolso cria transação compensatória, nunca apaga ledger.

Não armazene número de cartão/CVV. Use checkout/tokenização do gateway.

## Planos e créditos extras

- um plano com modalidades mensal/anual conforme produto atual;
- snapshots versionados;
- pacotes adicionais;
- disponibilidade/destaque administráveis;
- renovação concede créditos conforme regra versionada;
- webhook duplicado não concede duas vezes.

## Admin

Exigir `system_admin` + MFA AAL2 para:

- usuários e suspensão;
- planos/preços;
- ajustes de crédito;
- reprocessamento/cancelamento privilegiado;
- templates/prompts globais;
- inspeção de payloads filtrados.

Não use apenas rota escondida. Cada endpoint revalida role/AAL. Ações geram `audit_logs` append-only, motivo e before/after redigidos.

## Templates

- catálogo dos 728;
- versões imutáveis;
- draft/published/archived;
- validação Zod e IDs/bindings/canvas;
- import conflict `replace|rename|skip` com segurança;
- export sem metadata administrativa;
- JSON/SVG sanitizado;
- ativação transacional e auditoria;
- round-trip de todos os pacotes.

## Prompts

- identidade lógica + versions;
- apenas um ativo por tarefa/formato;
- ativação transacional;
- variáveis allowlist;
- output schema JSON;
- provider/model policy configurável;
- playground usa dados sintéticos ou consentidos;
- prompt de sistema não é enviado ao frontend comum;
- job grava `prompt_version_id`.

## Testes

- AAL1/admin comum bloqueado;
- AAL2/system admin permitido;
- usuário não promove a si próprio;
- ajuste de crédito exige motivo e é idempotente;
- webhook falso/duplicado/fora de ordem;
- preço adulterado no payload ignorado;
- cartão nunca chega ao banco;
- um prompt ativo por combinação;
- template inválido não publica;
- 728 templates passam e ZIP faz round-trip;
- auditoria não contém secret/token.

## Gate

Não habilite cobrança em produção sem sandbox/E2E, termos, webhook assinado e reconciliação financeira.

