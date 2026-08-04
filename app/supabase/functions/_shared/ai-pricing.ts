// Preço por milhão de tokens, em centavos de dólar (USD).
//
// A OpenAI não devolve custo junto com a resposta — só a contagem de tokens.
// O valor em dinheiro precisa ser calculado aqui, então esta tabela é a única
// fonte da verdade do custo mostrado no painel admin.
//
// Valores conferidos em https://developers.openai.com/api/docs/pricing
// (preço "Standard", em 04/08/2026). Precisam ser revistos quando a OpenAI
// mudar a tabela. Se um modelo não estiver listado aqui, o custo é gravado
// como 0 em vez de estimado por chute — melhor um zero visível do que um
// número inventado que parece confiável.

type ModelPrice = { inputCentsPerMillion: number; outputCentsPerMillion: number };

const PRICES: Record<string, ModelPrice> = {
  // Imagem
  "gpt-image-2": { inputCentsPerMillion: 800, outputCentsPerMillion: 3000 },
  "gpt-image-1.5": { inputCentsPerMillion: 800, outputCentsPerMillion: 3200 },
  "gpt-image-1-mini": { inputCentsPerMillion: 250, outputCentsPerMillion: 800 },
  "gpt-image-1": { inputCentsPerMillion: 1000, outputCentsPerMillion: 4000 },
  "chatgpt-image-latest": {
    inputCentsPerMillion: 800,
    outputCentsPerMillion: 3200,
  },
  // Texto
  "gpt-5.6-terra": { inputCentsPerMillion: 200, outputCentsPerMillion: 1200 },
  "gpt-5-mini": { inputCentsPerMillion: 25, outputCentsPerMillion: 200 },
  "gpt-5": { inputCentsPerMillion: 125, outputCentsPerMillion: 1000 },
  "gpt-4o-mini": { inputCentsPerMillion: 15, outputCentsPerMillion: 60 },
  "gpt-4o": { inputCentsPerMillion: 250, outputCentsPerMillion: 1000 },
};

const priceFor = (model?: string): ModelPrice | undefined => {
  if (!model) return undefined;
  if (PRICES[model]) return PRICES[model];
  // Modelos vêm com sufixo de data ("gpt-5-mini-2025-08-07"): casa pelo
  // prefixo mais longo para não perder o preço a cada nova revisão do modelo.
  const match = Object.keys(PRICES)
    .filter((key) => model.startsWith(key))
    .sort((left, right) => right.length - left.length)[0];
  return match ? PRICES[match] : undefined;
};

/**
 * Custo em milésimos de centavo. Uma única imagem custa frações de centavo,
 * então centavo inteiro arredondaria quase tudo para zero.
 * Retorna 0 quando o modelo é desconhecido — custo não estimado, não zero real.
 */
export const costMillicents = (input: {
  model?: string;
  inputTokens: number;
  outputTokens: number;
}): number => {
  const price = priceFor(input.model);
  if (!price) return 0;
  const inputCost = (input.inputTokens / 1_000_000) * price.inputCentsPerMillion;
  const outputCost = (input.outputTokens / 1_000_000) *
    price.outputCentsPerMillion;
  return Math.round((inputCost + outputCost) * 1000);
};

export const isPricedModel = (model?: string): boolean =>
  Boolean(priceFor(model));
