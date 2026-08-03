import { z } from 'zod'

const positionSchema = z.object({ top: z.union([z.string(), z.number()]).optional(), left: z.union([z.string(), z.number()]).optional(), width: z.union([z.string(), z.number()]).optional(), height: z.union([z.string(), z.number()]).optional(), type: z.string().optional() }).passthrough()
const layerSchema = z.object({ id: z.string().min(1), type: z.string().min(1), position: positionSchema.optional(), styles: z.record(z.unknown()).optional(), content: z.union([z.string(), z.record(z.unknown())]).optional(), editorMeta: z.record(z.unknown()).optional() }).passthrough()
export const visualTemplateSchema = z.object({
  schemaVersion: z.string().optional(), templateId: z.string().min(1), templateName: z.string().min(1), templateType: z.string().min(1), packageId: z.string().min(1), aspectRatio: z.string().min(1), dimensions: z.object({ width: z.number().positive(), height: z.number().positive() }), props: z.record(z.unknown()).default({}), layers: z.array(layerSchema).min(1), carouselSlideType: z.enum(['cover', 'content', 'closing']).optional(),
}).passthrough().superRefine((value, context) => {
  const ids = new Set<string>()
  value.layers.forEach((layer, index) => { if (ids.has(layer.id)) context.addIssue({ code: z.ZodIssueCode.custom, path: ['layers', index, 'id'], message: `ID duplicado: ${layer.id}` }); ids.add(layer.id) })
})

export function validateTemplate(input: unknown) {
  return visualTemplateSchema.parse(input)
}
