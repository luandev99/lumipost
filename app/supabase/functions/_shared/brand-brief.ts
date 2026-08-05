// Antes, a identidade da marca ia pro prompt como um JSON solto
// (`{ brand: {...} }`), misturado com metadados técnicos e sem nenhuma
// hierarquia — o modelo lia tudo como "dado de contexto", não como
// instrução. Isto monta um texto único, rotulado e em português, que vira a
// base tanto do rascunho de texto quanto da geração de imagem.
export const buildBrandIdentityBrief = (
  brand: Record<string, unknown> | null,
): string => {
  if (!brand)
    return "Nenhuma identidade de marca configurada ainda: use um tom profissional e neutro, sem inventar nome, cores ou estilo específicos.";

  const name = String(brand.name ?? "").trim();
  const description = String(brand.description ?? "").trim();
  const industry = String(brand.industry ?? "").trim();
  const specialty = String(brand.specialty ?? "").trim();
  const businessType = String(brand.business_type ?? "").trim();
  const audience = String(brand.audience ?? "").trim();
  const personality = Array.isArray(brand.personality)
    ? (brand.personality as string[]).filter(Boolean)
    : [];
  const tone = Array.isArray(brand.tone) ? (brand.tone as string[]).filter(Boolean) : [];
  const visualStyle = String(brand.visual_style ?? "").trim();
  const primaryColor = String(brand.primary_color ?? "").trim();
  const secondaryColor = String(brand.secondary_color ?? "").trim();
  const headingFont = String(brand.heading_font ?? "").trim();
  const bodyFont = String(brand.body_font ?? "").trim();

  const lines: string[] = [`Identidade da marca "${name || "Sem nome definido"}":`];
  if (industry || specialty)
    lines.push(
      `- Segmento: ${industry}${specialty ? ` (${specialty})` : ""}`,
    );
  if (businessType) lines.push(`- Tipo de negócio: ${businessType}`);
  if (description) lines.push(`- Descrição: ${description}`);
  if (audience) lines.push(`- Público-alvo: ${audience}`);
  if (personality.length) lines.push(`- Personalidade: ${personality.join(", ")}`);
  if (tone.length) lines.push(`- Tom de voz: ${tone.join(", ")}`);
  if (visualStyle) lines.push(`- Estilo visual: ${visualStyle}`);
  // A regra forte de paleta (com a lista de cores proibidas) já vai
  // separadamente em buildPaletteInstruction, direto para a geração de
  // imagem — repeti-la aqui por inteiro só inflaria o prompt à toa. Aqui
  // basta o dado bruto, para a etapa de texto ter contexto.
  if (primaryColor || secondaryColor) {
    const colors = [primaryColor, secondaryColor].filter(Boolean);
    lines.push(`- Cores da marca: ${colors.join(" e ")}.`);
  }
  if (headingFont || bodyFont)
    lines.push(
      `- Tipografia de referência (não obrigatória — nenhum modelo de imagem garante reproduzir uma fonte exata): títulos em ${headingFont || "padrão"}, textos em ${bodyFont || "padrão"}.`,
    );
  return lines.join("\n");
};
