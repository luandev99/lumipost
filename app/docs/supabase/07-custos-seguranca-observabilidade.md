# 07 — Custos, segurança e observabilidade

## Unidade econômica do produto

Crédito não deve equivaler rigidamente a um preço externo. Ele é uma unidade interna versionada que cobre:

- provedor de IA;
- tentativas e falhas não reembolsadas pelo provedor;
- Storage/egress/render;
- gateway de pagamento e impostos;
- suporte e margem;
- variação cambial.

Separe três valores:

1. custo estimado do provedor;
2. créditos cobrados do cliente;
3. receita reconhecida.

## Política inicial de custo

- Texto/planejamento: modelo econômico e saída estruturada curta.
- Imagem: preview `low`; final `medium`; `high` apenas premium.
- Template sem imagem generativa: custo muito baixo ou incluído no plano.
- Carrossel: reutilizar fundo/asset quando possível; render de texto é local.
- Vídeo: exigir aprovação do storyboard e teto de créditos antes de enviar.
- Agendamento manual: 2 créditos, conforme regra atual.
- Regeneração por erro técnico: não cobrar de novo.
- Regeneração por escolha criativa: cobrar conforme regra mostrada antes.

Defina budgets:

- por job (`maxCredits`);
- por dia e mês por organização;
- por modelo/provider;
- global por ambiente;
- alerta em 50%, 80% e 100%.

## Controle de custo técnico

### Texto

- prompts concisos e versionados;
- limite de tokens de saída;
- um request estruturado para título/legenda/hashtags em vez de três quando possível;
- cache somente quando entrada e políticas permitem;
- não reenviar JSON de template inteiro se só metadados bastam.

### Imagem

- deduplicar por hash de prompt normalizado + referências + opções;
- preview menor/barato;
- regenerar só o slide alterado;
- usar render local para texto, logo, formas e gradientes;
- salvar derivados e thumbnails para não transformar toda visualização.

### Vídeo

- storyboard obrigatório;
- limite de duração/resolução;
- preview curto antes de final;
- não gerar cinco variações simultâneas por padrão;
- copiar resultado para Storage e não depender de egress repetido do provedor.

## Segurança

### Principais ameaças

| Ameaça | Controle |
|---|---|
| acesso entre organizações | RLS + testes negativos |
| roubo de chave | secrets server-side, rotação e menor privilégio |
| saldo duplicado/negativo | ledger + transação + lock + idempotência |
| publicação duplicada | idempotency key externa + snapshot imutável |
| webhook falso/replay | assinatura, timestamp e external ID único |
| upload malicioso | allowlist MIME/tamanho, inspeção e bucket privado |
| prompt injection em conteúdo | não dar ferramentas privilegiadas ao modelo; validar schema |
| abuso de geração | rate limit, orçamento e moderação |
| admin indevido | papel protegido, MFA, auditoria e sessão curta |
| vazamento em logs | redaction e payloads resumidos |

### Chaves e rotação

- Chaves distintas para local/staging/produção.
- Nunca usar segredo de produção em preview da Vercel.
- Rotacionar secrets por procedimento testado.
- Criar alertas para chamadas após rotação/falha de autenticação.
- Chave secreta do Supabase nunca em `VITE_*`.

### LGPD e retenção

Mapeie base legal e finalidade para perfil, marca, uploads, rostos/vozes, logs e métricas. Disponibilize exportação e exclusão. Defina retenção, por exemplo:

- uploads não finalizados: horas/dias;
- exports temporários: poucos dias;
- prompt/output bruto: período curto configurável;
- auditoria financeira: conforme obrigação legal;
- webhooks brutos: somente o necessário, com redaction;
- conta excluída: workflow assíncrono verificável.

Consentimento para voz, rosto e referência de terceiros deve ser explícito.

## Observabilidade

### Logs estruturados

Campos mínimos: `timestamp`, `level`, `trace_id`, `organization_id`, `user_id`, `job_id`, `function`, `provider`, `model`, `duration_ms`, `result`, `error_code`.

Nunca logar senha, JWT, API key, cartão, token social, URL assinada completa ou mídia/base64.

### Métricas

- login/cadastro/onboarding concluído;
- geração solicitada/concluída/falha;
- latência P50/P95 por operação;
- tokens/imagens/segundos por provider;
- custo por organização, plano e conteúdo;
- saldo reservado por muito tempo;
- backlog e idade por fila;
- publicações no horário, atrasadas e falhas;
- webhooks inválidos/duplicados;
- conversão de assinatura e pacotes.

### Alertas

- wallet negativa ou invariantes quebradas: imediato;
- fila com mensagem antiga: urgente;
- taxa de falha do provedor acima do limite;
- gasto diário acima do orçamento;
- publicações atrasadas;
- segredo/token social próximo do vencimento;
- aumento de 401/403/429/5xx;
- job `processing` sem heartbeat.

### Auditoria

Eventos de admin, créditos, plano, prompt/template ativo, conexão social e publicação devem ser append-only. Registre before/after filtrado, motivo, ator e trace ID. Não permita alteração pelo cliente.

## Backups e recuperação

- Habilitar PITR de acordo com o plano/criticidade.
- Testar restauração, não apenas existência do backup.
- Versionar migrations e seed de catálogo.
- Storage crítico deve ter política de recuperação adequada.
- Guardar hashes dos 728 templates e validar importação após restauração.
- Documentar RPO/RTO e responsável por incidente.

## Painel operacional mínimo

- saldo e reservas totais;
- custo externo hoje/mês;
- jobs por estado e provider;
- fila e mensagem mais antiga;
- publicações das próximas 24h;
- tokens sociais vencendo;
- webhooks falhos;
- ações administrativas recentes.

## Pricing externo

Não codifique números de preço da OpenAI/Higgsfield em documentos de regra ou no frontend. Guarde-os em configuração versionada e valide com as páginas oficiais no momento do lançamento. A configuração atual usa `gpt-5-mini` para texto e `gpt-image-1-mini` para imagens; ambos devem continuar configuráveis no servidor.

## Go-live checklist

- RLS verificada em todas as tabelas expostas.
- Teste de invasão entre duas organizações.
- Idempotência testada com requests/webhooks duplicados.
- Limites/budgets ativados.
- Secrets revisados e rotacionáveis.
- Ambientes separados.
- Backup/restauração testados.
- Termos, privacidade e consentimentos atualizados.
- Contratos comerciais dos provedores aprovados.
- Plano de incidentes e status page definidos.
