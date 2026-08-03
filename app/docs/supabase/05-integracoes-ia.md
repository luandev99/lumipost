# 05 — Integrações de IA: texto, imagem e vídeo

## Resumo da estratégia

| Necessidade | Padrão inicial | Alternativa/fallback |
|---|---|---|
| plano semanal, legenda, hashtags | OpenAI `gpt-5-mini` | modelo econômico configurável |
| copy estruturada de slides | OpenAI Responses API + Structured Outputs | regra/template local |
| imagem fotográfica/ilustração | GPT Image 2 low/medium | outro provider por adapter |
| arte final com textos da marca | renderer dos 728 templates | nenhum texto “desenhado” na imagem da IA |
| roteiro/cenas de Reel | OpenAI texto estruturado | edição manual |
| vídeo generativo | `VideoGenerationProvider` com Higgsfield condicionado | outro provider com API pública |

ChatGPT é o produto de conversa; a integração do sistema deve usar a **OpenAI API**, com faturamento e chave próprios no servidor.

## Por que separar texto, imagem e render

Pedir à IA uma imagem final com título, legenda e identidade completa é caro e inconsistente. O fluxo mais econômico é:

1. modelo de texto gera JSON validado;
2. escolhe template compatível;
3. imagem de IA gera somente fundo/personagem/produto quando necessário;
4. renderer local aplica tipografia, cores, logo e texto;
5. gera PNG/ZIP/thumbnail determinísticos.

Posts tipográficos, listas, citações e anúncios simples podem usar apenas template + assets da marca, sem chamada de imagem.

## Contratos de provider

```ts
export interface TextGenerationProvider {
  generate<T>(input: {
    modelPolicy: string
    system: string
    prompt: string
    schema: Record<string, unknown>
    idempotencyKey: string
  }): Promise<{
    data: T
    providerRequestId: string
    usage: ProviderUsage
  }>
}

export interface ImageGenerationProvider {
  generate(input: {
    prompt: string
    references: AssetRef[]
    width: number
    height: number
    quality: 'low' | 'medium' | 'high'
    transparent?: boolean
  }): Promise<GeneratedAsset>
}

export interface VideoGenerationProvider {
  submit(input: VideoGenerationInput): Promise<{
    providerJobId: string
    status: 'queued' | 'processing' | 'completed'
    asset?: GeneratedAsset
  }>
  getStatus(providerJobId: string): Promise<VideoJobStatus>
  cancel?(providerJobId: string): Promise<void>
  verifyWebhook?(request: Request): Promise<VideoWebhookEvent>
}
```

Nenhum tipo de domínio deve mencionar `OpenAI` ou `Higgsfield`; estes nomes ficam nos adapters/configurações.

## OpenAI para texto

### Modelo

A configuração de produção usa `gpt-5-mini` para custo e volume, com Responses API e Structured Outputs. Use-o inicialmente para:

- plano semanal;
- título, legenda, hashtags e CTA;
- copy de carrossel;
- roteiro e cenas;
- classificação de formato/template.

Mantenha `model_policy` configurável em `prompt_versions`, por exemplo `economy_text_v1`, em vez de espalhar o nome do modelo pelo código. Uma policy pode fazer fallback em casos complexos.

### Saída estruturada

Cada tarefa possui Zod/JSON Schema. Exemplo conceitual:

```json
{
  "title": "string",
  "caption": "string",
  "hashtags": ["string"],
  "cta": "string",
  "slides": [
    { "type": "cover|content|closing", "headline": "string", "body": "string" }
  ]
}
```

Valide a resposta no servidor. Se inválida, tente uma correção curta no máximo uma vez; depois marque falha sem cobrar novamente ao usuário.

### Prompt versionado

Prompt efetivo combina:

- snapshot da marca;
- tarefa e formato;
- objetivo/assunto do usuário;
- regras da rede;
- variáveis permitidas;
- schema de saída;
- versão ativa do prompt;
- templates autorizados.

Salve hashes e IDs de versão, não exponha prompts administrativos completos ao usuário final.

## OpenAI para imagem

Use GPT Image 2 atrás do adapter, começando com qualidade `low` para rascunho/preview e `medium` para arte aprovada. Qualidade alta deve ser uma opção premium ou regeneração explícita.

Políticas de economia:

- não gerar imagem para conteúdo que pode usar template puro;
- gerar uma imagem por conceito e recortar/renderizar variações localmente;
- produzir preview barato antes do render final;
- limitar dimensões e quantidade por job;
- reutilizar assets aprovados com hash/consentimento;
- não regenerar tudo quando só a legenda mudar;
- cobrar por operação real e registrar uso do provedor;
- manter budget diário/mensal por organização.

O antigo `gpt-image-1-mini` aparece como deprecated na documentação atual; não deve ser a fundação nova, mesmo que preços históricos fossem atraentes. Confirme o preço corrente de GPT Image 2 na página oficial antes de definir a conversão de créditos.

## Higgsfield para vídeo

### O que está confirmado

As páginas oficiais atuais mostram acesso programático por MCP e CLI e uma plataforma com vários modelos. Os termos também abrangem API, MCP e CLI. Porém, a pesquisa pública não encontrou um contrato HTTP completo e estável com autenticação, endpoints, webhooks, limites e preços adequado para codificar diretamente o backend deste SaaS.

### Decisão

Antes de implementar:

1. solicitar acesso oficial/comercial para uso server-to-server;
2. obter documentação de autenticação, rate limit e ambiente de teste;
3. confirmar permissão de uso multiusuário/revenda;
4. confirmar direitos sobre uploads, voz, rosto e saída;
5. confirmar webhook assinado ou polling suportado;
6. obter tabela de créditos/preços e política de reembolso;
7. testar SLA, watermark, resolução, duração e retenção.

Até isso ocorrer, implemente `FakeVideoGenerationProvider` no staging e mantenha o adapter real desabilitado por feature flag.

### Fluxo futuro

1. OpenAI cria roteiro e prompts por cena.
2. Usuário aprova storyboard e custo máximo.
3. Backend reserva créditos.
4. Adapter envia referências por signed URL curta ou upload suportado.
5. Grava `provider_job_id` e espera webhook/poll.
6. Copia o resultado imediatamente para Storage próprio.
7. Gera thumbnail/capa, registra custo e finaliza créditos.
8. Apaga/revoga URLs temporárias conforme política.

Nunca faça scraping/automação da interface do Higgsfield nem use endpoints privados observados no navegador.

## Roteamento e conversão de créditos

Mantenha preços internos versionados em `ai_price_rules`:

`operation`, `provider`, `model_policy`, `unit`, `provider_cost_estimate`, `credit_price`, `effective_from`, `effective_to`, `is_active`.

Exemplo de unidade:

- `text_job` por requisição/faixa de tokens;
- `image_low`, `image_medium`, `image_high` por imagem;
- `video_second` por segundo/resolução/modelo;
- `manual_schedule` fixo em 2 créditos;
- `carousel_render` por slide somente se houver geração visual real.

O frontend exibe a estimativa retornada pelo servidor. O servidor reserva teto e finaliza custo real. Margem deve cobrir câmbio, impostos, falhas não reembolsadas e infraestrutura.

## Segurança e privacidade de IA

- Enviar somente os dados necessários.
- Não enviar access tokens sociais, dados de cartão ou segredos em prompts.
- Avisar o usuário sobre referências com pessoas e obter consentimento.
- Guardar prompt/output bruto por tempo limitado e configurável.
- Moderar entrada e saída conforme política de cada provedor.
- Tornar geração de voz/rosto uma permissão explícita.
- Registrar provider/model/version para rastreabilidade.

## Testes de contrato

Cada adapter deve passar pelo mesmo conjunto:

- sucesso síncrono;
- job assíncrono;
- timeout;
- 429 com `Retry-After`;
- erro 4xx não repetível;
- webhook duplicado e fora de ordem;
- retorno sem arquivo;
- schema inválido;
- cancelamento;
- custo acima do teto;
- idempotência.

## Referências oficiais

- [OpenAI GPT-5 mini](https://developers.openai.com/api/docs/models/gpt-5-mini)
- [OpenAI GPT Image 1 mini](https://developers.openai.com/api/docs/models/gpt-image-1-mini)
- [OpenAI: geração de imagens](https://developers.openai.com/api/docs/guides/image-generation)
- [OpenAI: orientação sobre modelos atuais](https://developers.openai.com/api/docs/guides/latest-model)
- [Higgsfield: conector MCP](https://higgsfield.ai/claude-ai-video-generator)
- [Higgsfield: guia oficial sobre MCP](https://higgsfield.ai/blog/Generate-AI-Videos-From-Claude-with-Higgsfield-MCP)
- [Higgsfield: termos de uso](https://higgsfield.ai/terms-of-use-agreement)
