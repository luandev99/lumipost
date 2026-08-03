# 00 — Prompt mestre para implementação ponta a ponta

Copie o bloco abaixo para Claude Code.

---

## Prompt

Você deve transformar este repositório Lumipost.ai mockado em um SaaS real com Supabase, de ponta a ponta.

Leia integralmente o `CLAUDE.md`, todos os arquivos em `docs/supabase` e todos os arquivos em `docs/claude` antes de implementar. Trate esses documentos como especificação e critérios de aceite.

Execute as fases `02-fundacao-supabase.md` até `10-testes-deploy.md` em ordem. Ao final, execute `11-auditoria-seguranca.md` e produza o runbook descrito em `12-runbook-operacional.md`.

Regras de execução:

1. Preserve a arquitetura `domain/application/infrastructure/presentation` e o fluxo componente → thunk → use case → repository.
2. Substitua repositories em memória por adapters Supabase gradualmente, com testes.
3. Use migrations versionadas e Supabase local antes de staging.
4. Nunca peça, leia, imprima ou grave o valor de secrets. Trabalhe somente com seus nomes.
5. Coloque no browser apenas URL e publishable key do Supabase. Nenhuma secret/service key pode estar em `VITE_*` ou no bundle.
6. Chaves OpenAI, vídeo, pagamento, webhook e serviços ficam em Supabase Edge Function Secrets.
7. Tokens sociais por cliente devem ficar criptografados em Vault/cofre, com acesso restrito ao servidor.
8. Habilite RLS e escreva testes pgTAP negativos para cada tabela exposta.
9. Use Queues/outbox, Cron e workers idempotentes para IA, render e publicação.
10. Não implemente Higgsfield por scraping ou endpoint privado. Só habilite adapter real com documentação e acesso oficial server-to-server; caso contrário entregue o adapter, fake e feature flag.
11. Não execute ação remota destrutiva, cobrança real, publicação social ou deploy de produção sem autorização explícita.
12. Faça progresso seguro sem pedir confirmação para decisões reversíveis já especificadas. Pare apenas quando faltar uma escolha externa, credencial inserida pelo usuário ou autorização de produção.

Para cada fase:

- faça inventário antes de editar;
- declare migrations/arquivos previstos;
- implemente a fatia completa;
- escreva testes unitários, integração e segurança;
- rode todos os gates aplicáveis;
- corrija falhas antes de seguir;
- registre um resumo em `docs/implementation-status.md`, sem secrets;
- não marque como concluída uma integração que ainda esteja fake ou bloqueada.

Entregáveis finais:

- Supabase Auth, organizations, brands e onboarding persistentes;
- RLS multi-tenant testada;
- Storage privado e uploads assinados;
- conteúdo/versionamento/biblioteca;
- planos, assinatura, compras adicionais e ledger atômico;
- dois créditos por agendamento manual;
- até cinco conteúdos por dia escolhido;
- jobs de texto, imagem, vídeo, render e publicação;
- OpenAI por adapter e saída estruturada;
- adapter de vídeo seguro;
- calendário, planner, previews e Realtime;
- templates/prompts versionados e admin protegido por MFA AAL2;
- billing/webhooks idempotentes;
- CI/CD sem secrets no repositório;
- auditoria de segurança sem achados críticos/altos;
- documentação de implantação, rollback, backup e incidentes.

Comece pela fase 01 de secrets como pré-condição, depois faça a fase 02. Não mostre conteúdo de arquivos `.env`; apenas diga se a proteção existe ou não.

---

## Checkpoints esperados

Claude pode precisar parar para:

- pedir que você faça login no Supabase CLI;
- pedir o `project-ref`, que não é secret;
- pedir que você configure nomes de secrets no Dashboard, sem revelar valores;
- obter escolha do gateway de pagamento;
- obter acesso/documentação do Higgsfield e Meta;
- pedir autorização explícita para staging/produção.

Uma pausa externa não autoriza reduzir testes ou inserir segredo temporariamente no código.

