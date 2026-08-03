# 06 — Jobs, OpenAI, imagens e vídeo

## Prompt da fase

Implemente uma plataforma assíncrona de IA e render, sem acoplar domínio a fornecedores. Leia `docs/supabase/04-rotinas-filas-webhooks.md` e `05-integracoes-ia.md`.

## Infraestrutura

Criar:

- `ai_jobs`, `ai_job_events`, `provider_usage`, `outbox_events`, `webhook_events`;
- filas `ai_text`, `ai_image`, `ai_video`, `media_render`, `webhook_process`;
- dispatcher de outbox;
- workers idempotentes com visibility timeout/lease;
- retry com backoff/jitter e dead-letter;
- Realtime para status/eventos;
- cancelamento cooperativo;
- timeout e recuperação de job órfão.

Edge Function de entrada valida JWT/RLS, prompt, template, limites e saldo; reserva créditos, cria job/outbox e responde `202`. Ela não espera vídeo/imagem longa.

## Providers

Implementar contratos:

- `TextGenerationProvider`;
- `ImageGenerationProvider`;
- `VideoGenerationProvider`;
- `MediaRenderer`;
- adapters fake determinísticos para testes.

### OpenAI

- chave somente em Supabase Secrets;
- Responses API e Structured Outputs para texto;
- policy configurável começando por modelo econômico atual documentado;
- schema Zod/JSON por tarefa;
- GPT Image 2 atrás do adapter para imagem;
- preview low e final medium; high opcional/premium;
- salvar request ID, uso, latência e custo sem logar prompt sensível integralmente;
- timeout, 429/Retry-After e erros normalizados;
- moderação/política conforme documentação oficial atual.

Não use assinatura ChatGPT do usuário como API.

### Render econômico

1. IA gera copy JSON.
2. Motor escolhe um dos templates compatíveis.
3. Imagem de IA é opcional e não contém tipografia final.
4. Renderer aplica logo, fontes, cores e textos.
5. Salva PNGs/ZIP/thumbnail no Storage.

Alterar legenda/texto não deve regenerar imagem automaticamente.

### Higgsfield/vídeo

Implemente o contrato, fake e feature flag. Adapter real somente quando o usuário fornecer acesso comercial server-to-server e documentação oficial com autenticação, rate limits, preços, webhook/poll e termos multiusuário.

Proibido:

- scraping;
- automação do site;
- endpoint interno descoberto no DevTools;
- armazenar cookie pessoal do Higgsfield;
- afirmar que integração está pronta quando estiver fake.

O adapter suporta `submit`, `getStatus`, `cancel` opcional e `verifyWebhook` opcional. Copie a mídia final ao Storage próprio.

## Segurança de prompt

- dados do usuário são input não confiável;
- modelo não recebe ferramenta financeira/admin;
- output nunca executa SQL/HTML/script;
- templates/SVG são validados/sanitizados;
- schema rejeita propriedades extras perigosas;
- chaves/tokens não entram no contexto;
- prompt administrativo não é retornado ao frontend.

## Testes

- sucesso síncrono/assíncrono;
- schema inválido e uma correção limitada;
- 429, 5xx, timeout e provider offline;
- webhook duplicado/fora de ordem/inválido;
- polling e timeout de vídeo;
- cancelamento;
- job reiniciado após lease;
- custo acima do teto;
- erro libera reserva;
- resultado salva mídia e versão atomicamente;
- segredo ausente falha de modo seguro;
- prompt injection não altera autorização.

## Gate

Nenhum job pode ficar definitivamente preso em `processing`, cobrar duas vezes ou depender de uma conexão do navegador aberta.

## Referências

- [Supabase Queues](https://supabase.com/docs/guides/queues)
- [Supabase Edge Functions](https://supabase.com/docs/guides/functions)
- [OpenAI GPT-5 mini](https://developers.openai.com/api/docs/models/gpt-5-mini)
- [OpenAI GPT Image 1 mini](https://developers.openai.com/api/docs/models/gpt-image-1-mini)
- [Higgsfield MCP oficial](https://higgsfield.ai/claude-ai-video-generator)
